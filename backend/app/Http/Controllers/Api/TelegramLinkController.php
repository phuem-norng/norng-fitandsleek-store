<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TelegramUser;
use App\Services\TelegramWebAppDataValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelegramLinkController extends Controller
{
    public function link(Request $request, TelegramWebAppDataValidator $validator): JsonResponse
    {
        $initData = trim((string) $request->input('init_data', ''));
        $botToken = (string) config('services.telegram.bot_token');

        if ($botToken === '') {
            return response()->json(['message' => 'Telegram bot is not configured.'], 503);
        }

        if (!$validator->validate($initData, $botToken)) {
            return response()->json(['message' => 'Invalid or expired Telegram session. Open the store from the bot and try again.'], 422);
        }

        $telegramFrom = $validator->parseUser($initData);
        $telegramUserId = $telegramFrom['id'] ?? null;
        if (!is_numeric($telegramUserId)) {
            return response()->json(['message' => 'Telegram user data is missing.'], 422);
        }

        $authUser = $request->user();
        if (!$authUser) {
            return response()->json(['message' => 'Authentication required.'], 401);
        }

        $existing = TelegramUser::query()
            ->where('telegram_user_id', (int) $telegramUserId)
            ->first();

        if ($existing && $existing->user_id && (int) $existing->user_id !== (int) $authUser->id) {
            return response()->json([
                'message' => 'This Telegram account is already linked to another Fit & Sleek profile.',
            ], 409);
        }

        $otherLink = TelegramUser::query()
            ->where('user_id', $authUser->id)
            ->where('telegram_user_id', '!=', (int) $telegramUserId)
            ->exists();

        if ($otherLink) {
            TelegramUser::query()
                ->where('user_id', $authUser->id)
                ->where('telegram_user_id', '!=', (int) $telegramUserId)
                ->update(['user_id' => null]);
        }

        TelegramUser::updateOrCreate(
            ['telegram_user_id' => (int) $telegramUserId],
            [
                'user_id' => $authUser->id,
                'username' => $telegramFrom['username'] ?? null,
                'first_name' => $telegramFrom['first_name'] ?? null,
                'last_name' => $telegramFrom['last_name'] ?? null,
                'language_code' => $telegramFrom['language_code'] ?? null,
                'is_bot' => (bool) ($telegramFrom['is_bot'] ?? false),
                'last_interacted_at' => now(),
            ]
        );

        return response()->json([
            'message' => 'Your Telegram account is linked successfully.',
            'linked' => true,
        ]);
    }
}
