<?php

namespace App\Jobs;

use App\Models\TelegramBroadcast;
use App\Models\TelegramBroadcastDelivery;
use App\Models\TelegramUser;
use Illuminate\Bus\Batch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Bus;
use Throwable;

class DispatchTelegramBroadcastChunksJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $broadcastId, public bool $retryFailedOnly = false)
    {
    }

    public function handle(): void
    {
        $broadcast = TelegramBroadcast::find($this->broadcastId);
        if (!$broadcast) {
            return;
        }

        if (in_array($broadcast->status, ['cancelled', 'completed'], true)) {
            return;
        }

        $broadcast->update([
            'status' => 'processing',
            'started_at' => $broadcast->started_at ?? now(),
            'paused_at' => null,
            'completed_at' => null,
            'cancelled_at' => null,
            'last_error' => null,
            'processed_chunks' => 0,
            'total_chunks' => 0,
        ]);
        $chunkSize = max(1, min((int) config('services.telegram.broadcast_chunk_size', 100), 500));
        $totalRecipients = $this->prepareDeliveries($broadcast);

        if ($this->retryFailedOnly) {
            TelegramBroadcastDelivery::query()
                ->where('broadcast_id', $broadcast->id)
                ->where('status', 'failed')
                ->update([
                    'status' => 'pending',
                    'attempt_count' => 0,
                    'last_error' => null,
                    'sent_at' => null,
                    'updated_at' => now(),
                ]);
        }

        $pendingDeliveryIds = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('status', 'pending')
            ->orderBy('id')
            ->pluck('id')
            ->all();

        $chunks = array_chunk($pendingDeliveryIds, $chunkSize);
        $totalChunks = count($chunks);

        $broadcast->update([
            'total_recipients' => $totalRecipients,
            'total_chunks' => $totalChunks,
            'processed_chunks' => 0,
        ]);

        if ($broadcast->dry_run) {
            $broadcast->update([
                'status' => 'completed',
                'batch_id' => null,
                'completed_at' => now(),
            ]);
            return;
        }

        if ($totalChunks === 0) {
            $broadcast->update([
                'status' => 'completed',
                'batch_id' => null,
                'completed_at' => now(),
            ]);
            return;
        }

        $jobs = array_map(
            fn(array $deliveryIds) => new SendTelegramBroadcastChunkJob($broadcast->id, $deliveryIds),
            $chunks
        );

        $batch = Bus::batch($jobs)
            ->name("telegram-broadcast-{$broadcast->id}")
            ->allowFailures()
            ->finally(function (Batch $batch) {
                self::finalizeBroadcastAfterBatch($batch->id);
            })
            ->catch(function (Batch $batch, Throwable $e) {
                $failedBroadcast = TelegramBroadcast::query()->where('batch_id', $batch->id)->first();
                if ($failedBroadcast && !in_array($failedBroadcast->status, ['cancelled', 'paused'], true)) {
                    $failedBroadcast->update([
                        'status' => 'failed',
                        'last_error' => $e->getMessage(),
                    ]);
                }
            })
            ->dispatch();

        $broadcast->update([
            'batch_id' => $batch->id,
        ]);
    }

    private function prepareDeliveries(TelegramBroadcast $broadcast): int
    {
        $existingCount = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->count();

        if ($existingCount > 0) {
            return $existingCount;
        }

        $query = TelegramUser::query()->whereNotNull('chat_id');
        if ($broadcast->target === 'linked') {
            $query->whereNotNull('user_id');
        } elseif ($broadcast->target === 'unlinked') {
            $query->whereNull('user_id');
        }

        $users = $query->select(['id', 'chat_id'])->orderBy('id')->get();
        $deliveriesToInsert = [];
        foreach ($users as $user) {
            $deliveriesToInsert[] = [
                'broadcast_id' => $broadcast->id,
                'telegram_user_id' => $user->id,
                'chat_id' => $user->chat_id,
                'status' => 'pending',
                'attempt_count' => 0,
                'last_error' => null,
                'sent_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        if (!empty($deliveriesToInsert)) {
            TelegramBroadcastDelivery::upsert(
                $deliveriesToInsert,
                ['broadcast_id', 'telegram_user_id'],
                ['chat_id', 'updated_at']
            );
        }

        return count($deliveriesToInsert);
    }

    private static function finalizeBroadcastAfterBatch(string $batchId): void
    {
        $broadcast = TelegramBroadcast::query()->where('batch_id', $batchId)->first();
        if (!$broadcast) {
            return;
        }

        $sentCount = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('status', 'sent')
            ->count();
        $failedCount = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('status', 'failed')
            ->count();
        $pendingCount = TelegramBroadcastDelivery::query()
            ->where('broadcast_id', $broadcast->id)
            ->where('status', 'pending')
            ->count();

        $updates = [
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
            'processed_chunks' => $broadcast->total_chunks,
        ];

        if ($broadcast->status === 'cancelled') {
            $updates['completed_at'] = now();
        } elseif ($broadcast->status === 'paused') {
            $updates['completed_at'] = null;
        } elseif ($pendingCount > 0) {
            $updates['status'] = 'failed';
            $updates['last_error'] = 'Some chunk jobs ended before processing all pending deliveries.';
            $updates['completed_at'] = now();
        } else {
            $updates['status'] = ($failedCount > 0 && $sentCount === 0) ? 'failed' : 'completed';
            $updates['completed_at'] = now();
        }

        $broadcast->update($updates);
    }
}
