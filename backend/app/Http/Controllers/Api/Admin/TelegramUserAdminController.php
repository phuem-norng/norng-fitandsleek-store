<?php

namespace App\Http\Controllers\Api\Admin;

use App\Jobs\DispatchTelegramBroadcastChunksJob;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\TelegramBroadcastResource;
use App\Http\Resources\Admin\TelegramUserResource;
use App\Models\TelegramBroadcast;
use App\Models\TelegramUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;

class TelegramUserAdminController extends Controller
{
    public function index(Request $request)
    {
        $query = TelegramUser::query()
            ->with('user')
            ->orderByDesc('last_interacted_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $status = strtolower((string) $request->input('status'));
            if ($status === 'linked') {
                $query->whereNotNull('user_id');
            } elseif ($status === 'unlinked') {
                $query->whereNull('user_id');
            }
        }

        if ($request->filled('search')) {
            $search = (string) $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('username', 'ilike', "%{$search}%")
                    ->orWhere('first_name', 'ilike', "%{$search}%")
                    ->orWhere('last_name', 'ilike', "%{$search}%")
                    ->orWhere('last_message_text', 'ilike', "%{$search}%")
                    ->orWhere('telegram_user_id', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('name', 'ilike', "%{$search}%")
                            ->orWhere('email', 'ilike', "%{$search}%")
                            ->orWhere('phone', 'ilike', "%{$search}%");
                    });
            });
        }

        $perPage = (int) $request->input('per_page', 15);
        $perPage = max(1, min($perPage, 100));

        $telegramUsers = $query->paginate($perPage);

        $total = TelegramUser::count();
        $linked = TelegramUser::whereNotNull('user_id')->count();
        $unlinked = max(0, $total - $linked);
        $linkedRate = $total > 0 ? round(($linked / $total) * 100, 2) : 0;

        return TelegramUserResource::collection($telegramUsers)->additional([
            'metrics' => [
                'total_telegram_users' => $total,
                'linked_users' => $linked,
                'unlinked_users' => $unlinked,
                'linked_rate' => $linkedRate,
            ],
        ]);
    }

    public function broadcast(Request $request)
    {
        $validated = $request->validate([
            'target' => 'required|string|in:all,linked,unlinked',
            'message' => 'required|string|min:1|max:4096',
            'parse_mode' => 'nullable|string|in:HTML,Markdown,MarkdownV2',
            'dry_run' => 'sometimes|boolean',
        ]);

        $broadcast = TelegramBroadcast::create([
            'created_by' => $request->user()?->id,
            'target' => $validated['target'],
            'message' => trim($validated['message']),
            'parse_mode' => $validated['parse_mode'] ?? null,
            'dry_run' => (bool) ($validated['dry_run'] ?? false),
            'status' => 'pending',
        ]);

        DispatchTelegramBroadcastChunksJob::dispatch($broadcast->id, false);

        return response()->json([
            'message' => 'Broadcast queued successfully.',
            'data' => new TelegramBroadcastResource($broadcast->load('creator')),
        ], 202);
    }

    public function broadcasts(Request $request)
    {
        $perPage = (int) $request->input('per_page', 15);
        $perPage = max(1, min($perPage, 100));

        $query = TelegramBroadcast::query()
            ->with('creator')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        $broadcasts = $query->paginate($perPage);

        return TelegramBroadcastResource::collection($broadcasts);
    }

    public function cancel(int $broadcastId)
    {
        $broadcast = TelegramBroadcast::findOrFail($broadcastId);

        if (in_array($broadcast->status, ['completed', 'failed', 'cancelled'], true)) {
            return response()->json([
                'message' => "Broadcast already {$broadcast->status}.",
                'data' => new TelegramBroadcastResource($broadcast->load('creator')),
            ]);
        }

        $broadcast->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'completed_at' => now(),
        ]);

        if (!empty($broadcast->batch_id)) {
            $batch = Bus::findBatch($broadcast->batch_id);
            if ($batch) {
                $batch->cancel();
            }
        }

        return response()->json([
            'message' => 'Broadcast cancelled successfully.',
            'data' => new TelegramBroadcastResource($broadcast->load('creator')),
        ]);
    }

    public function pause(int $broadcastId)
    {
        $broadcast = TelegramBroadcast::findOrFail($broadcastId);

        if (in_array($broadcast->status, ['completed', 'failed', 'cancelled'], true)) {
            return response()->json([
                'message' => "Broadcast already {$broadcast->status}.",
                'data' => new TelegramBroadcastResource($broadcast->load('creator')),
            ]);
        }

        if ($broadcast->status === 'paused') {
            return response()->json([
                'message' => 'Broadcast is already paused.',
                'data' => new TelegramBroadcastResource($broadcast->load('creator')),
            ]);
        }

        $broadcast->update([
            'status' => 'paused',
            'paused_at' => now(),
            'completed_at' => null,
        ]);

        if (!empty($broadcast->batch_id)) {
            $batch = Bus::findBatch($broadcast->batch_id);
            if ($batch) {
                $batch->cancel();
            }
        }

        return response()->json([
            'message' => 'Broadcast paused successfully.',
            'data' => new TelegramBroadcastResource($broadcast->load('creator')),
        ]);
    }

    public function resume(int $broadcastId)
    {
        $broadcast = TelegramBroadcast::findOrFail($broadcastId);

        if (in_array($broadcast->status, ['completed', 'failed', 'cancelled'], true)) {
            return response()->json([
                'message' => "Cannot resume a {$broadcast->status} broadcast.",
                'data' => new TelegramBroadcastResource($broadcast->load('creator')),
            ], 422);
        }

        if (!in_array($broadcast->status, ['paused', 'pending'], true)) {
            return response()->json([
                'message' => "Broadcast is currently {$broadcast->status}.",
                'data' => new TelegramBroadcastResource($broadcast->load('creator')),
            ]);
        }

        $broadcast->update([
            'status' => 'pending',
            'paused_at' => null,
            'completed_at' => null,
            'cancelled_at' => null,
        ]);

        DispatchTelegramBroadcastChunksJob::dispatch($broadcast->id, false);

        return response()->json([
            'message' => 'Broadcast resumed and queued successfully.',
            'data' => new TelegramBroadcastResource($broadcast->load('creator')),
        ]);
    }

    public function retryFailed(int $broadcastId)
    {
        $broadcast = TelegramBroadcast::findOrFail($broadcastId);

        if ($broadcast->status === 'cancelled') {
            return response()->json([
                'message' => 'Cannot retry a cancelled broadcast.',
            ], 422);
        }

        DispatchTelegramBroadcastChunksJob::dispatch($broadcast->id, true);

        return response()->json([
            'message' => 'Retry failed deliveries queued successfully.',
            'data' => new TelegramBroadcastResource($broadcast->fresh()->load('creator')),
        ], 202);
    }

    public function progress(int $broadcastId)
    {
        $broadcast = TelegramBroadcast::findOrFail($broadcastId);
        $batch = !empty($broadcast->batch_id) ? Bus::findBatch($broadcast->batch_id) : null;

        $totalRecipients = (int) $broadcast->total_recipients;
        $sentCount = (int) $broadcast->sent_count;
        $failedCount = (int) $broadcast->failed_count;
        $processedRecipients = $sentCount + $failedCount;
        $completionPercentage = $totalRecipients > 0
            ? round(($processedRecipients / $totalRecipients) * 100, 2)
            : ($broadcast->status === 'completed' ? 100.0 : 0.0);

        $batchProgress = $batch ? (float) $batch->progress() : null;

        return response()->json([
            'broadcast_id' => $broadcast->id,
            'status' => $broadcast->status,
            'batch_id' => $broadcast->batch_id,
            'progress' => [
                'completion_percentage' => $completionPercentage,
                'batch_progress_percentage' => $batchProgress,
                'processed_recipients' => $processedRecipients,
                'total_recipients' => $totalRecipients,
                'sent_count' => $sentCount,
                'failed_count' => $failedCount,
                'remaining_recipients' => max(0, $totalRecipients - $processedRecipients),
            ],
            'batch' => $batch ? [
                'total_jobs' => $batch->totalJobs,
                'pending_jobs' => $batch->pendingJobs,
                'failed_jobs' => $batch->failedJobs,
                'processed_jobs' => $batch->processedJobs(),
                'is_finished' => $batch->finished(),
                'is_cancelled' => $batch->cancelled(),
                'created_at' => optional($batch->createdAt)?->toISOString(),
                'finished_at' => optional($batch->finishedAt)?->toISOString(),
            ] : null,
        ]);
    }

    public function stats(int $broadcastId)
    {
        $broadcast = TelegramBroadcast::findOrFail($broadcastId);
        $batch = !empty($broadcast->batch_id) ? Bus::findBatch($broadcast->batch_id) : null;

        $total = (int) $broadcast->total_recipients;
        $sent = (int) $broadcast->sent_count;
        $failed = (int) $broadcast->failed_count;
        $successRate = $total > 0 ? round(($sent / $total) * 100, 2) : 0.0;
        $failureRate = $total > 0 ? round(($failed / $total) * 100, 2) : 0.0;

        $failedDeliveries = $broadcast->deliveries()
            ->where('status', 'failed')
            ->whereNotNull('last_error')
            ->get(['last_error']);

        $errorSummary = [];
        foreach ($failedDeliveries as $delivery) {
            $error = trim((string) $delivery->last_error);
            if ($error === '') {
                continue;
            }

            $signature = $this->errorSignature($error);
            if (!isset($errorSummary[$signature])) {
                $errorSummary[$signature] = [
                    'signature' => $signature,
                    'count' => 0,
                ];
            }
            $errorSummary[$signature]['count']++;
        }

        usort($errorSummary, fn(array $a, array $b) => $b['count'] <=> $a['count']);

        return response()->json([
            'broadcast_id' => $broadcast->id,
            'batch_id' => $broadcast->batch_id,
            'status' => $broadcast->status,
            'totals' => [
                'total_recipients' => $total,
                'sent_count' => $sent,
                'failed_count' => $failed,
                'success_rate' => $successRate,
                'failure_rate' => $failureRate,
            ],
            'batch' => $batch ? [
                'total_jobs' => $batch->totalJobs,
                'pending_jobs' => $batch->pendingJobs,
                'failed_jobs' => $batch->failedJobs,
                'is_finished' => $batch->finished(),
                'is_cancelled' => $batch->cancelled(),
            ] : null,
            'error_summary' => array_slice($errorSummary, 0, 10),
        ]);
    }

    private function errorSignature(string $error): string
    {
        $normalized = strtolower($error);

        if (str_contains($normalized, 'blocked')) {
            return 'bot blocked by user';
        }
        if (str_contains($normalized, 'timeout')) {
            return 'network timeout';
        }
        if (str_contains($normalized, 'forbidden')) {
            return 'forbidden';
        }
        if (str_contains($normalized, 'chat not found')) {
            return 'chat not found';
        }
        if (str_contains($normalized, 'too many requests') || str_contains($normalized, '429')) {
            return 'rate limited';
        }

        return mb_substr($error, 0, 120);
    }

    public function maintenanceStats()
    {
        $stats = Cache::get(\App\Console\Commands\TelegramMaintenanceCommand::CACHE_KEY, [
            'ran_at' => null,
            'pretend' => null,
            'retention_days' => (int) config('services.telegram.broadcast_retention_days', 30),
            'batch_prune_hours' => (int) config('services.telegram.broadcast_retention_days', 30) * 24,
            'broadcasts_pruned' => 0,
            'deliveries_pruned' => 0,
            'batches_pruned' => null,
            'model_prune_output' => null,
            'batch_prune_output' => null,
        ]);

        return response()->json([
            'ok' => true,
            'data' => $stats,
        ]);
    }
}
