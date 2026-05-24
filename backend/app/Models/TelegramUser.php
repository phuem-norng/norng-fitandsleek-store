<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelegramUser extends Model
{
    use HasFactory;

    protected $fillable = [
        'telegram_user_id',
        'user_id',
        'chat_id',
        'username',
        'first_name',
        'last_name',
        'language_code',
        'is_bot',
        'last_message_text',
        'last_interacted_at',
        'raw_update',
    ];

    protected $casts = [
        'is_bot' => 'boolean',
        'last_interacted_at' => 'datetime',
        'raw_update' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function broadcastDeliveries(): HasMany
    {
        return $this->hasMany(TelegramBroadcastDelivery::class, 'telegram_user_id');
    }
}
