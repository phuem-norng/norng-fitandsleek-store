<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Prunable;

class TelegramBroadcastDelivery extends Model
{
    use HasFactory;
    use Prunable;

    protected $fillable = [
        'broadcast_id',
        'telegram_user_id',
        'chat_id',
        'status',
        'attempt_count',
        'last_error',
        'sent_at',
    ];

    protected $casts = [
        'attempt_count' => 'integer',
        'sent_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(TelegramBroadcast::class, 'broadcast_id');
    }

    public function telegramUser(): BelongsTo
    {
        return $this->belongsTo(TelegramUser::class, 'telegram_user_id');
    }

    public function prunable()
    {
        $retentionDays = max(1, (int) config('services.telegram.broadcast_retention_days', 30));

        return static::query()
            ->whereIn('status', ['sent', 'failed', 'skipped'])
            ->whereHas('broadcast', function ($query) {
                $query->whereIn('status', ['completed', 'failed', 'cancelled']);
            })
            ->where('created_at', '<=', now()->subDays($retentionDays));
    }
}
