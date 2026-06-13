<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Discount extends Model
{
    protected $table = 'discounts';

    protected $fillable = [
        'product_id',
        'discount_type',
        'discount_value',
        'sale_price',
        'quantity',
        'start_date',
        'end_date',
        'is_active',
        'description',
    ];

    protected $casts = [
        'discount_value' => 'decimal:2',
        'sale_price' => 'decimal:2',
        'quantity' => 'integer',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
