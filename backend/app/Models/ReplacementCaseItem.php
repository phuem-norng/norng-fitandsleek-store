<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReplacementCaseItem extends Model
{
    protected $fillable = [
        'replacement_case_id',
        'order_item_id',
        'fulfillment_lot_id',
        'return_lot_id',
        'returned_qty',
        'quantity',
        'requested_size',
        'requested_color',
        'note',
    ];

    protected $casts = [
        'quantity' => 'integer',
    ];

    public function replacementCase(): BelongsTo
    {
        return $this->belongsTo(ReplacementCase::class);
    }

    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    public function fulfillmentLot(): BelongsTo
    {
        return $this->belongsTo(InventoryLot::class, 'fulfillment_lot_id');
    }

    public function returnLot(): BelongsTo
    {
        return $this->belongsTo(InventoryLot::class, 'return_lot_id');
    }
}
