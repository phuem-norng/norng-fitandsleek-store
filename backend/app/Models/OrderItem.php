<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'product_id',
        'inventory_lot_id',
        'size',
        'color',
        'name',
        'sku',
        'price',
        'unit_cost_at_sale',
        'listing_status_at_sale',
        'lot_tier_at_sale',
        'lot_number_at_sale',
        'qty',
        'line_total',
    ];

    protected $casts = [
        'qty' => 'integer',
        'price' => 'decimal:2',
        'unit_cost_at_sale' => 'decimal:2',
        'line_total' => 'decimal:2',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function inventoryLot()
    {
        return $this->belongsTo(InventoryLot::class);
    }
}
