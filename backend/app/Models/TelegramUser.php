<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TelegramUser extends Model
{
    protected $fillable = [
        'telegram_user_id',
        'user_id',
        'chat_id',
        'username',
        'first_name',
        'last_name',
        'language_code',
        'last_interacted_at',
    ];

    protected function casts(): array
    {
        return [
            'telegram_user_id' => 'integer',
            'chat_id' => 'integer',
            'last_interacted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orderSubscriptions(): HasMany
    {
        return $this->hasMany(TelegramOrderSubscription::class);
    }
}
