<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PurchaseOrder extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING = 'pending';

    public const STATUS_RECEIVED = 'received';

    protected $fillable = [
        'supplier_id',
        'po_number',
        'status',
        'order_date',
        'expected_delivery',
        'notes',
        'purchaser',
        'received_at',
    ];

    protected $casts = [
        'order_date' => 'date',
        'expected_delivery' => 'date',
        'received_at' => 'datetime',
    ];

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }

    public function productLimits(): HasMany
    {
        return $this->hasMany(PurchaseOrderProductLimit::class);
    }
}
