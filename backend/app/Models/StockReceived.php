<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReceived extends Model
{
    protected $table = 'stock_received';

    protected $fillable = [
        'stock_inventory_id',
        'category_id',
        'product_id',
        'created_by',
        'corrects_stock_received_id',
        'entry_type',
        'quantity',
        'unit_cost',
        'total_cost',
        'supplier_name',
        'invoice_number',
        'date_in',
        'received_at',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'unit_cost' => 'float',
        'total_cost' => 'float',
        'date_in' => 'date',
        'received_at' => 'datetime',
    ];

    public function stockInventory(): BelongsTo
    {
        return $this->belongsTo(StockInventory::class, 'stock_inventory_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
