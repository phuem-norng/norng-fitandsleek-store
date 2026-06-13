<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StorefrontEvent extends Model
{
    protected $fillable = [
        'user_id',
        'session_id',
        'event_type',
        'product_id',
        'order_id',
        'meta',
        'occurred_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'occurred_at' => 'datetime',
    ];
}

