<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LoyaltyProfile extends Model
{
    protected $fillable = [
        'user_id',
        'points',
        'tier',
        'orders_count',
        'lifetime_spend',
        'last_earned_at',
    ];

    protected $casts = [
        'lifetime_spend' => 'decimal:2',
        'last_earned_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

