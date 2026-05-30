<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\User;
use App\Services\StorefrontChatContextService;
use Illuminate\Http\Request;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\PersonalAccessToken;

class ChatbotController extends Controller
{
    public function __construct(
        private readonly StorefrontChatContextService $storeContext,
    ) {
    }

    private function fetchAvailableModel(?string $apiKey): ?string
    {
        if (!$apiKey)
            return null;

        $verifyOption = $this->verifyOption();

        try {
            /** @var Response $resp */
            $resp = Http::timeout(10)
                ->withOptions(['verify' => $verifyOption])
                ->withQueryParameters(['key' => $apiKey])
                ->get('https://generativelanguage.googleapis.com/v1beta/models');

            if ($resp->status() < 200 || $resp->status() >= 300) {
                return null;
            }

            $data = json_decode($resp->body(), true) ?: [];
            $models = $data['models'] ?? [];

            $supported = array_filter($models, function ($m) {
                $methods = $m['supportedGenerationMethods'] ?? [];
                return in_array('generateContent', $methods, true);
            });

            $names = array_values(array_map(fn($m) => $m['name'] ?? '', $supported));
            if (!$names)
                return null;

            $preferred = [
                'models/gemini-1.5-flash',
                'models/gemini-1.5-pro',
                'models/gemini-1.0-pro',
                'models/gemini-pro',
            ];

            foreach ($preferred as $pref) {
                if (in_array($pref, $names, true)) {
                    return str_replace('models/', '', $pref);
                }
            }

            return str_replace('models/', '', $names[0]);
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function verifyOption(): bool|string
    {
        $verify = config('services.gemini.verify', true);
        $caBundle = config('services.gemini.ca_bundle');

        if ($caBundle && file_exists($caBundle)) {
            return $caBundle;
        }

        // allow explicit opt-out via env GEMINI_VERIFY_SSL=false
        if (is_string($verify)) {
            $verify = filter_var($verify, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($verify === null) {
                $verify = true;
            }
        }

        return (bool) $verify;
    }
    private function buildStoreContext(string $message, ?User $user = null): string
    {
        return $this->storeContext->toPromptContext($message, $user);
    }

    private function polishReply(string $reply, array $products): string
    {
        if ($products === []) {
            return trim($reply);
        }

        $clean = preg_replace('/^\|.+\|\s*\r?\n\|[-:\s|]+\|\s*\r?\n(?:\|.+\|\s*\r?\n?)+/m', '', $reply) ?? $reply;
        $clean = preg_replace('/^#{1,6}\s+.+$/m', '', $clean) ?? $clean;
        $clean = preg_replace("/\n{3,}/", "\n\n", trim($clean));

        if ($clean === '') {
            return 'Here are some picks from our store:';
        }

        if (strlen($clean) > 280) {
            $parts = preg_split('/(?<=[.!?។])\s+/u', $clean) ?: [$clean];

            return trim(implode(' ', array_slice($parts, 0, 2)));
        }

        return $clean;
    }

    private function resolveUser(Request $request): ?User
    {
        $token = $request->bearerToken();
        if (! $token) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($token);
        $user = $accessToken?->tokenable;

        return $user instanceof User ? $user : null;
    }

    private function defaults(): array
    {
        return [
            'enabled' => true,
            'greeting' => 'Hi there 👋',
            'welcome' => 'How can we help you today?',
            'messenger_url' => '',
            'telegram_url' => '',
            'instagram_url' => '',
            'social_links' => [],
        ];
    }

    public function settings()
    {
        $row = Setting::where('key', 'chatbot')->first();
        $value = is_array($row?->value) ? $row->value : [];

        return response()->json([
            'data' => array_merge($this->defaults(), $value),
        ]);
    }

    public function message(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'history' => 'sometimes|array',
            'history.*.role' => 'required_with:history|string',
            'history.*.content' => 'required_with:history|string',
        ]);

        $apiKey = config('services.gemini.api_key');
        $model = config('services.gemini.model', 'gemini-1.0-pro');
        $verifyOption = $this->verifyOption();

        if (!$apiKey) {
            return response()->json([
                'error' => 'Gemini API key not configured.',
            ], 500);
        }

        $contents = [];
        $history = $validated['history'] ?? [];
        foreach ($history as $item) {
            $role = $item['role'] === 'assistant' ? 'model' : 'user';
            $contents[] = [
                'role' => $role,
                'parts' => [
                    ['text' => $item['content']],
                ],
            ];
        }

        $contents[] = [
            'role' => 'user',
            'parts' => [
                ['text' => $validated['message']],
            ],
        ];

        $user = $this->resolveUser($request);
        $context = $this->buildStoreContext($validated['message'], $user);
        $systemText = 'You are Fit & Sleek customer support assistant. Be friendly, professional, and concise (1–3 sentences). '
            . 'Help with products, orders, shipping, returns, sizing, discounts, and store navigation. '
            . 'If the user writes in Khmer, respond in Khmer. Otherwise respond in English. '
            . 'Do NOT use markdown tables — product cards appear in the chat UI.';
        if ($context) {
            $systemText .= "\n\n[Live store database — use ONLY this data]\n" . $context;
        }

        $payload = [
            'systemInstruction' => [
                'parts' => [
                    ['text' => $systemText],
                ],
            ],
            'contents' => $contents,
            'generationConfig' => [
                'temperature' => 0.55,
                'maxOutputTokens' => 512,
            ],
        ];

        /** @var callable(string): Response $callModel */
        $callModel = function (string $modelName) use ($apiKey, $payload, $verifyOption): Response {
            $url = "https://generativelanguage.googleapis.com/v1beta/models/{$modelName}:generateContent";
            /** @var Response $resp */
            $resp = Http::timeout(15)
                ->withOptions(['verify' => $verifyOption])
                ->withQueryParameters(['key' => $apiKey])
                ->post($url, $payload);
            return $resp;
        };

        /** @var Response $response */
        $response = $callModel($model);

        if ($response->status() === 404) {
            $fallbacks = ['gemini-1.0-pro', 'gemini-pro'];
            foreach ($fallbacks as $fallback) {
                if ($fallback === $model)
                    continue;
                $response = $callModel($fallback);
                if ($response->status() >= 200 && $response->status() < 300) {
                    break;
                }
            }

            if ($response->status() === 404) {
                $available = $this->fetchAvailableModel($apiKey);
                if ($available) {
                    $response = $callModel($available);
                }
            }
        }

        if ($response->status() < 200 || $response->status() >= 300) {
            $details = json_decode($response->body(), true) ?: null;
            return response()->json([
                'error' => 'Chatbot request failed.',
                'details' => $details,
            ], 500);
        }

        $data = json_decode($response->body(), true) ?: [];
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (!$text) {
            return response()->json([
                'error' => 'No response from chatbot.',
            ], 500);
        }

        $products = $this->storeContext->buildRichProductsForMessage($validated['message']);
        $reply = $this->polishReply(trim($text), $products);

        return response()->json([
            'reply' => $reply,
            'products' => $products,
        ]);
    }
}