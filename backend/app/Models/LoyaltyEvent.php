<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyEvent extends Model
{
    protected $fillable = [
        'user_id',
        'order_id',
        'event_type',
        'points_delta',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}

