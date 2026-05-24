<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserDeviceSession extends Model
{
    protected $fillable = [
        'user_id',
        'personal_access_token_id',
        'device_id',
        'device_name',
        'browser',
        'os',
        'user_agent',
        'ip_address',
        'last_login_at',
        'last_used_at',
        'device_verified_at',
        'ip_city',
        'ip_region',
        'ip_country',
        'ip_country_code',
    ];

    protected function casts(): array
    {
        return [
            'last_login_at' => 'datetime',
            'last_used_at' => 'datetime',
            'device_verified_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
