<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'email_verified_at',
        'password',
        'facebook_id',
        'social_type',
        'role',
        'admin_permissions',
        'phone',
        'address',
        'profile_image_path',
        'profile_image_updated_at',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'admin_permissions',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'profile_image_updated_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'admin_permissions' => 'array',
        ];
    }

    public function hasAdminPermission(string $resource, string $action = 'view'): bool
    {
        return app(\App\Services\AdminPermissionService::class)->has($this, $resource, $action);
    }

    public function getEffectiveAdminPermissionsAttribute(): ?array
    {
        if (! $this->isAdmin()) {
            return null;
        }

        return app(\App\Services\AdminPermissionService::class)->getEffectivePermissions($this);
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_confirmed_at !== null
            && ! empty($this->two_factor_secret);
    }

    // Relationships
    public function carts()
    {
        return $this->hasMany(Cart::class);
    }

    public function wishlists()
    {
        return $this->hasMany(Wishlist::class);
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function loyaltyProfile()
    {
        return $this->hasOne(LoyaltyProfile::class);
    }

    public function paymentsVerified()
    {
        return $this->hasMany(Payment::class, 'verified_by');
    }

    public function shipmentTrackingEvents()
    {
        return $this->hasMany(ShipmentTrackingEvent::class, 'updated_by');
    }

    public function replacementCasesHandled()
    {
        return $this->hasMany(ReplacementCase::class, 'handled_by');
    }

    public function deviceSessions()
    {
        return $this->hasMany(UserDeviceSession::class);
    }

    // Helper methods
    public function isSuperAdmin(): bool
    {
        return $this->role === 'superadmin';
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin' || $this->role === 'superadmin';
    }

    public function isCustomer(): bool
    {
        return $this->role === 'customer';
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Relationships
     */
    public function addresses()
    {
        return $this->hasMany(Address::class);
    }

    /**
     * Get the profile image URL
     */
    public function getProfileImageUrlAttribute(): ?string
    {
        try {
            return \App\Support\Media::url($this->profile_image_path);
        } catch (\Throwable) {
            return null;
        }
    }

    protected $appends = ['profile_image_url', 'effective_admin_permissions'];
}