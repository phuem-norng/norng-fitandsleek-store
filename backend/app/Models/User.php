<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
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
        ];
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

    public function telegramUser(): HasOne
    {
        return $this->hasOne(TelegramUser::class);
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
    public function getProfileImageUrlAttribute()
    {
        $rawPath = trim((string) $this->profile_image_path);
        if ($rawPath === '') {
            return null;
        }

        // Legacy rows may store full URLs (including localhost/127.0.0.1). Normalize
        // storage URLs to relative paths to avoid mixed-content on HTTPS storefronts.
        if (filter_var($rawPath, FILTER_VALIDATE_URL)) {
            $parsedPath = (string) (parse_url($rawPath, PHP_URL_PATH) ?? '');
            $storagePos = strpos($parsedPath, '/storage/');
            if ($storagePos !== false) {
                return substr($parsedPath, $storagePos);
            }

            // Keep external URLs as-is (e.g., Cloudinary CDN URLs).
            return $rawPath;
        }

        $normalizedPath = ltrim($rawPath, '/');
        if ($normalizedPath === '') {
            return null;
        }

        if (str_starts_with($normalizedPath, 'storage/')) {
            return '/' . $normalizedPath;
        }

        $defaultDisk = (string) config('filesystems.default', 'public');

        if ($defaultDisk !== 'public' && Storage::disk($defaultDisk)->exists($normalizedPath)) {
            return Storage::disk($defaultDisk)->url($normalizedPath);
        }

        if (Storage::disk('public')->exists($normalizedPath)) {
            return '/storage/' . $normalizedPath;
        }

        return null;
    }

    /**
     * Append profile_image_url to the model's array representation
     */
    protected $appends = ['profile_image_url'];
}