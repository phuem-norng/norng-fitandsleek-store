<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'user_id',
        'parent_order_id',
        'replacement_case_id',
        'sale_channel',
        'order_number',
        'status',
        'payment_status',
        'payment_method',
        'subtotal',
        'shipping',
        'discount',
        'total',
        'shipping_address',
        'billing_address',
        'pos_meta',
    ];

    protected $casts = [
        'total' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'shipping' => 'decimal:2',
        'discount' => 'decimal:2',
        'shipping_address' => 'array',
        'billing_address' => 'array',
        'pos_meta' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function shipment()
    {
        return $this->hasOne(Shipment::class);
    }

    public function replacementCases()
    {
        return $this->hasMany(ReplacementCase::class);
    }

    public function parentOrder()
    {
        return $this->belongsTo(Order::class, 'parent_order_id');
    }

    public function replacementCase()
    {
        return $this->belongsTo(ReplacementCase::class);
    }

    public function childReplacementOrders()
    {
        return $this->hasMany(Order::class, 'parent_order_id');
    }

    public static function findByPublicKey(string $key): ?self
    {
        $order = static::query()->where('order_number', $key)->first();
        if ($order) {
            return $order;
        }

        if (ctype_digit($key)) {
            return static::query()->find((int) $key);
        }

        return null;
    }
}
