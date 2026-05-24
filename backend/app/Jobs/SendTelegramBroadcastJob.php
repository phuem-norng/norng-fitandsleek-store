<?php

namespace App\Jobs;

use App\Models\TelegramBroadcast;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendTelegramBroadcastJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $broadcastId)
    {
    }

    public function handle(): void
    {
        $broadcast = TelegramBroadcast::find($this->broadcastId);
        if (!$broadcast || in_array($broadcast->status, ['cancelled', 'completed'], true)) {
            return;
        }

        DispatchTelegramBroadcastChunksJob::dispatch($broadcast->id);
    }
}
