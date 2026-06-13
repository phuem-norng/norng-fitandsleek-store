<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PurchaseOrderItem extends Model
{
    protected $fillable = [
        'purchase_order_id',
        'product_id',
        'size',
        'color',
        'qty',
        'cost_per_unit',
        'sell_price',
        'line_total_cost',
        'line_subtotal_sell',
    ];

    protected $casts = [
        'qty' => 'integer',
        'cost_per_unit' => 'decimal:2',
        'sell_price' => 'decimal:2',
        'line_total_cost' => 'decimal:2',
        'line_subtotal_sell' => 'decimal:2',
    ];

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
