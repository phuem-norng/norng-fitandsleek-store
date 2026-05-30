<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockInventory extends Model
{
    protected $table = 'stock_inventory';

    protected $fillable = [
        'category_id',
        'name',
        'slug',
        'sku',
        'stock',
        'stock_received',
        'min_stock',
        'manage_stock',
        'cost',
        'price',
        'unit',
        'origin',
        'brand_id',
        'product_condition',
        'is_active',
    ];

    protected $casts = [
        'stock' => 'integer',
        'stock_received' => 'integer',
        'min_stock' => 'integer',
        'manage_stock' => 'boolean',
        'cost' => 'float',
        'price' => 'float',
        'is_active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function receives(): HasMany
    {
        return $this->hasMany(StockReceived::class, 'stock_inventory_id');
    }
}
