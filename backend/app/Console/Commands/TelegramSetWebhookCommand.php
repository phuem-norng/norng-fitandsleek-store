<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TelegramSetWebhookCommand extends Command
{
    protected $signature = 'telegram:set-webhook {--remove : Remove the current webhook}';

    protected $description = 'Register or remove the Telegram bot webhook URL';

    public function handle(): int
    {
        $token = config('services.telegram.bot_token');
        $secret = config('services.telegram.webhook_secret');

        if (! filled($token)) {
            $this->error('TELEGRAM_BOT_TOKEN is not configured.');

            return self::FAILURE;
        }

        if ($this->option('remove')) {
            $response = Http::post("https://api.telegram.org/bot{$token}/deleteWebhook");
            $this->line($response->body());

            return $response->successful() ? self::SUCCESS : self::FAILURE;
        }

        if (! filled($secret)) {
            $this->error('TELEGRAM_WEBHOOK_SECRET is not configured.');

            return self::FAILURE;
        }

        $baseUrl = trim((string) (config('services.telegram.webhook_url') ?: config('app.url')));
        if ($baseUrl === '') {
            $this->error('Set TELEGRAM_WEBHOOK_URL or APP_URL to your public HTTPS origin.');

            return self::FAILURE;
        }

        $url = rtrim($baseUrl, '/').'/api/telegram/webhook/'.$secret;

        if (! str_starts_with($url, 'https://')) {
            $this->error('Telegram requires HTTPS. Set TELEGRAM_WEBHOOK_URL=https://your-domain in .env');
            $this->line("Current URL would be: {$url}");

            return self::FAILURE;
        }

        $response = Http::post("https://api.telegram.org/bot{$token}/setWebhook", [
            'url' => $url,
            'allowed_updates' => ['message'],
            'secret_token' => $secret,
        ]);

        $this->line($response->body());

        if ($response->successful()) {
            $this->info("Webhook set to: {$url}");
        }

        return $response->successful() ? self::SUCCESS : self::FAILURE;
    }
}
