<?php

namespace App\Jobs;

use App\Models\TelegramBroadcast;
use App\Models\TelegramBroadcastDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendTelegramBroadcastChunkJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $broadcastId, public array $deliveryIds)
    {
    }

    public function handle(): void
    {
        $broadcast = TelegramBroadcast::find($this->broadcastId);
        if (!$broadcast) {
            return;
        }

        if (in_array($broadcast->status, ['cancelled', 'paused', 'completed'], true)) {
            return;
        }

        $botToken = (string) config('services.telegram.bot_token');
        if ($botToken === '') {
            $broadcast->update([
                'status' => 'failed',
                'last_error' => 'Missing TELEGRAM_BOT_TOKEN.',
                'completed_at' => now(),
            ]);
            return;
        }

        $messagesPerSecond = (int) config('services.telegram.broadcast_messages_per_second', 25);
        $messagesPerSecond = max(1, min($messagesPerSecond, 30));
        $microDelay = (int) floor(1000000 / $messagesPerSecond);
        $maxRetries = max(1, min((int) config('services.telegram.broadcast_retry_attempts', 3), 5));

        $deliveries = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->whereIn('id', $this->deliveryIds)
            ->where('status', 'pending')
            ->orderBy('id')
            ->get();

        foreach ($deliveries as $delivery) {
            $broadcast->refresh();
            if (in_array($broadcast->status, ['cancelled', 'paused'], true)) {
                return;
            }

            $attempt = 0;
            $sent = false;
            $lastError = null;

            while ($attempt < $maxRetries && !$sent) {
                $attempt++;

                $payload = [
                    'chat_id' => $delivery->chat_id,
                    'text' => $broadcast->message,
                ];
                if (!empty($broadcast->parse_mode)) {
                    $payload['parse_mode'] = $broadcast->parse_mode;
                }

                try {
                    $resp = Http::asJson()
                        ->timeout(10)
                        ->post("https://api.telegram.org/bot{$botToken}/sendMessage", $payload);

                    if ($resp->successful()) {
                        $sent = true;
                        break;
                    }

                    $lastError = "HTTP {$resp->status()}";
                } catch (\Throwable $e) {
                    $lastError = $e->getMessage();
                    Log::warning('Telegram chunk send attempt failed.', [
                        'broadcast_id' => $broadcast->id,
                        'delivery_id' => $delivery->id,
                        'attempt' => $attempt,
                        'error' => $lastError,
                    ]);
                }

                usleep(200000 * $attempt);
            }

            if ($sent) {
                $delivery->update([
                    'status' => 'sent',
                    'attempt_count' => $attempt,
                    'last_error' => null,
                    'sent_at' => now(),
                ]);
            } else {
                $delivery->update([
                    'status' => 'failed',
                    'attempt_count' => $attempt,
                    'last_error' => $lastError,
                    'sent_at' => null,
                ]);
            }

            usleep($microDelay);
        }

        $sentCount = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('status', 'sent')
            ->count();
        $failedCount = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('status', 'failed')
            ->count();

        $broadcast->increment('processed_chunks');
        $broadcast->update([
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
        ]);

        $broadcast->refresh();
        if ($broadcast->status === 'processing' && $broadcast->processed_chunks >= $broadcast->total_chunks) {
            $status = $failedCount > 0 && $sentCount === 0 ? 'failed' : 'completed';
            $broadcast->update([
                'status' => $status,
                'completed_at' => now(),
            ]);
        }
    }
}
