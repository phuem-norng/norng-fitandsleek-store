<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Prunable;

class TelegramBroadcast extends Model
{
    use HasFactory;
    use Prunable;

    protected $fillable = [
        'created_by',
        'batch_id',
        'target',
        'message',
        'parse_mode',
        'dry_run',
        'status',
        'total_recipients',
        'sent_count',
        'failed_count',
        'total_chunks',
        'processed_chunks',
        'started_at',
        'completed_at',
        'cancelled_at',
        'paused_at',
        'last_error',
    ];

    protected $casts = [
        'dry_run' => 'boolean',
        'total_recipients' => 'integer',
        'sent_count' => 'integer',
        'failed_count' => 'integer',
        'total_chunks' => 'integer',
        'processed_chunks' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'paused_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function deliveries(): HasMany
    {
        return $this->hasMany(TelegramBroadcastDelivery::class, 'broadcast_id');
    }

    public function prunable()
    {
        $retentionDays = max(1, (int) config('services.telegram.broadcast_retention_days', 30));

        return static::query()
            ->whereIn('status', ['completed', 'failed', 'cancelled'])
            ->where('created_at', '<=', now()->subDays($retentionDays));
    }
}
