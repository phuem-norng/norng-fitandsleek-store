<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryLotPriceEvent extends Model
{
    public const ACTION_MARK_CLEARANCE = 'mark_clearance';

    public const ACTION_UPDATE_CLEARANCE = 'update_clearance';

    public const ACTION_REVERT_CLEARANCE = 'revert_clearance';

    public const ACTION_APPLY_LOT_DISCOUNT = 'apply_lot_discount';

    public const ACTION_UPDATE_LOT_DISCOUNT = 'update_lot_discount';

    public const ACTION_REMOVE_LOT_DISCOUNT = 'remove_lot_discount';

    public const ACTION_UPDATE_SKU_PRICING = 'update_sku_pricing';

    protected $fillable = [
        'inventory_lot_id',
        'user_id',
        'action',
        'unit_price_before',
        'unit_price_after',
        'listing_status_before',
        'listing_status_after',
        'price_rule_before',
        'price_rule_after',
        'discount_percent_off',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'unit_price_before' => 'decimal:2',
            'unit_price_after' => 'decimal:2',
            'discount_percent_off' => 'decimal:2',
            'metadata' => 'array',
        ];
    }

    public function lot(): BelongsTo
    {
        return $this->belongsTo(InventoryLot::class, 'inventory_lot_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
