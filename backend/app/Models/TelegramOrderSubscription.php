<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelegramOrderSubscription extends Model
{
    protected $fillable = [
        'order_id',
        'telegram_user_id',
        'chat_id',
    ];

    protected function casts(): array
    {
        return [
            'chat_id' => 'integer',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function telegramUser(): BelongsTo
    {
        return $this->belongsTo(TelegramUser::class);
    }
}
