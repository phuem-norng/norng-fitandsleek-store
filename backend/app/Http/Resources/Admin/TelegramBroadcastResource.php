<?php

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TelegramBroadcastResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $total = (int) ($this->total_recipients ?? 0);
        $processed = (int) ($this->sent_count ?? 0) + (int) ($this->failed_count ?? 0);
        $completion = $total > 0 ? round(($processed / $total) * 100, 2) : ($this->status === 'completed' ? 100.0 : 0.0);
        $pending = max(0, $total - $processed);
        $mps = max(1, (int) config('services.telegram.broadcast_messages_per_second', 25));
        $workers = max(1, (int) config('services.telegram.broadcast_estimated_workers', 1));
        $etaMinutes = $pending > 0 ? (int) ceil(($pending / ($mps * $workers)) / 60) : 0;

        return [
            'id' => $this->id,
            'batch_id' => $this->batch_id,
            'target' => $this->target,
            'message' => $this->message,
            'parse_mode' => $this->parse_mode,
            'dry_run' => (bool) $this->dry_run,
            'status' => $this->status,
            'total_recipients' => $this->total_recipients,
            'sent_count' => $this->sent_count,
            'failed_count' => $this->failed_count,
            'total_chunks' => $this->total_chunks,
            'processed_chunks' => $this->processed_chunks,
            'started_at' => optional($this->started_at)?->toISOString(),
            'completed_at' => optional($this->completed_at)?->toISOString(),
            'cancelled_at' => optional($this->cancelled_at)?->toISOString(),
            'paused_at' => optional($this->paused_at)?->toISOString(),
            'completion_percentage' => $completion,
            'eta_minutes' => $etaMinutes,
            'last_error' => $this->last_error,
            'created_by' => $this->whenLoaded('creator', function () {
                if (!$this->creator) {
                    return null;
                }

                return [
                    'id' => $this->creator->id,
                    'name' => $this->creator->name,
                    'email' => $this->creator->email,
                ];
            }),
            'created_at' => optional($this->created_at)?->toISOString(),
            'updated_at' => optional($this->updated_at)?->toISOString(),
        ];
    }
}
