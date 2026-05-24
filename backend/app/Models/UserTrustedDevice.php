<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTrustedDevice extends Model
{
    protected $fillable = [
        'user_id',
        'device_id',
        'verified_at',
        'last_seen_at',
        'device_name',
        'browser',
        'os',
    ];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
            'last_seen_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
