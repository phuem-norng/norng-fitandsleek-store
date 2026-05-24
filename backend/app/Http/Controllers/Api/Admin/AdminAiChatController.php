<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AdminDashboardContextService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
class AdminAiChatController extends Controller
{
    public function __construct(
        private readonly AdminDashboardContextService $dashboardContext,
    ) {
    }

    public function chat(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:4000',
            'conversation_id' => 'nullable|string|max:128',
        ]);

        $baseUrl = $this->normalizeDifyBaseUrl((string) config('services.dify.base_url'));
        $apiKey = (string) config('services.dify.api_key');
        $appId = (string) config('services.dify.app_id');

        if ($baseUrl === '' || $apiKey === '') {
            return response()->json([
                'error' => 'ai_not_configured',
                'message' => 'Admin AI is not configured. Set DIFY_BASE_URL and DIFY_API_KEY in your backend .env file.',
            ], 503);
        }

        $user = $request->user();
        $userTag = $user ? 'admin-' . $user->id : 'admin-guest';

        $conversationId = trim((string) ($validated['conversation_id'] ?? ''));
        $isFollowUp = $conversationId !== '';

        $payload = [
            'inputs' => array_merge(
                $this->dashboardContext->toDifyInputs(),
                $this->dashboardContext->enrichInputsForMessage($validated['message']),
                ['reply_mode' => $isFollowUp ? 'concise' : 'overview'],
            ),
            'query' => $this->buildQuery($validated['message'], $isFollowUp),
            'response_mode' => 'blocking',
            'conversation_id' => $conversationId,
            'user' => $userTag,
            'files' => [],
        ];

        $endpoint = $baseUrl . '/chat-messages';
        $timeout = (int) config('services.dify.timeout', 120);

        try {
            $response = Http::timeout($timeout)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->when($appId !== '', fn ($http) => $http->withHeaders(['X-App-Id' => $appId]))
                ->post($endpoint, $payload);
        } catch (ConnectionException $e) {
            report($e);

            return response()->json([
                'error' => 'ai_unreachable',
                'message' => 'The AI server is not responding. Check that Dify and your local LLM (Ollama/Llama) are running.',
            ], 503);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'error' => 'ai_error',
                'message' => 'Could not reach the AI service. Please try again shortly.',
            ], 500);
        }

        if ($response->failed()) {
            $body = $response->json() ?? [];
            $remoteMessage = (string) ($body['message'] ?? $body['code'] ?? $response->reason());

            return response()->json([
                'error' => 'ai_upstream_error',
                'message' => $this->friendlyUpstreamMessage($remoteMessage, $response->status()),
                'status' => $response->status(),
            ], $response->status() >= 500 ? 503 : 502);
        }

        $data = $response->json() ?? [];
        $answer = $data['answer'] ?? null;

        if (! is_string($answer) || trim($answer) === '') {
            return response()->json([
                'error' => 'ai_empty_response',
                'message' => 'The AI returned an empty reply. Check your Dify workflow and model connection.',
            ], 502);
        }

        $reply = trim($answer);

        if ($this->looksLikeProviderFailure($reply)) {
            return response()->json([
                'error' => 'ai_quota_exceeded',
                'message' => $this->friendlyUpstreamMessage($reply, 429),
            ], 429);
        }

        $reply = $this->substituteUnresolvedDifyPlaceholders($reply, $payload['inputs']);

        return response()->json([
            'reply' => $reply,
            'conversation_id' => $data['conversation_id'] ?? ($validated['conversation_id'] ?? null),
            'message_id' => $data['message_id'] ?? null,
        ]);
    }

    private function looksLikeProviderFailure(string $text): bool
    {
        $hay = strtolower($text);

        return str_contains($hay, 'plugininvokeerror')
            || str_contains($hay, 'run failed')
            || str_contains($hay, 'resource_exhausted')
            || str_contains($hay, 'quota exceeded')
            || str_contains($text, '429');
    }

    private function friendlyUpstreamMessage(string $raw, int $status): string
    {
        $hay = strtolower($raw);

        if ($status === 404 || str_contains($hay, 'not found')) {
            return 'Dify API not found. Check DIFY_BASE_URL=https://api.dify.ai (no trailing /v1) and publish your app.';
        }

        if ($status === 429
            || str_contains($hay, 'resource_exhausted')
            || str_contains($hay, 'quota exceeded')
            || str_contains($hay, '429')) {
            return 'Gemini free quota exceeded (≈20 requests/day per model on free tier). '
                . 'Wait 15–60 minutes, switch model in Dify to gemini-2.0-flash or gemini-1.5-flash, '
                . 'or enable billing at Google AI Studio (aistudio.google.com).';
        }

        if (str_contains($hay, '503') && str_contains($hay, 'high demand')) {
            return 'Gemini is temporarily busy. Retry in a minute or pick another model in Dify.';
        }

        if (str_contains($hay, 'model_not_found') || str_contains($hay, 'does not exist')) {
            return 'Dify model not found. In Dify LLM node, switch to a valid model (e.g. Groq: llama-3.3-70b-versatile or llama-3.1-8b-instant) and Publish.';
        }

        if (str_contains($hay, 'plugininvokeerror') || str_contains($hay, 'run failed')) {
            if (preg_match('/"message"\s*:\s*"([^"]{1,200})"/', $raw, $m)) {
                return 'Dify workflow error: ' . stripcslashes($m[1]);
            }
        }

        if (strlen($raw) > 280) {
            return 'AI provider error. Check Dify model settings and API quota, then try again.';
        }

        return $raw !== '' ? $raw : 'The AI service returned an error.';
    }

    /** If the model echoes unreplaced {{total_users}}, fill from live inputs. */
    private function substituteUnresolvedDifyPlaceholders(string $reply, array $inputs): string
    {
        return (string) preg_replace_callback(
            '/\{\{\s*([a-z0-9_]+)\s*\}\}/i',
            function (array $m) use ($inputs) {
                $key = $m[1];
                if (isset($inputs[$key]) && is_scalar($inputs[$key])) {
                    return (string) $inputs[$key];
                }

                return $m[0];
            },
            $reply,
        );
    }

    /**
     * Every message includes live DB facts in `query` so the LLM cannot hallucinate
     * when Dify workflow variables are missing on follow-up turns.
     */
    private function buildQuery(string $message, bool $isFollowUp): string
    {
        $facts = $this->dashboardContext->toCompactQueryContext($message);

        $style = $isFollowUp
            ? "Reply in 1–3 short sentences. Answer ONLY what was asked. Do NOT repeat unrelated metrics.\n\n"
            : '';

        if (! config('services.dify.use_inputs_only', true)) {
            $facts = $this->dashboardContext->toPromptBlock() . "\n\n" . $facts;
        }

        return $style
            . "[Live database facts — use ONLY this data; never invent numbers, emails, or dates]\n"
            . $facts
            . "\n\n[Admin question]\n"
            . $message;
    }

    /** Accept https://api.dify.ai or https://api.dify.ai/v1 — always return …/v1 base. */
    private function normalizeDifyBaseUrl(string $url): string
    {
        $url = rtrim(trim($url), '/');
        if ($url === '') {
            return '';
        }
        if (str_ends_with($url, '/v1')) {
            return $url;
        }

        return $url . '/v1';
    }
}
