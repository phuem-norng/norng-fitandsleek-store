<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryLot extends Model
{
    public const LISTING_ACTIVE = 'active';

    public const LISTING_CLEARANCE = 'clearance';

    public const LISTING_ON_HOLD = 'on_hold';

    public const LISTING_DISCONTINUED = 'discontinued';

    public const TIER_OLDER = 'older';

    public const TIER_NEWER = 'newer';

    public const LOT_TIERS = [
        self::TIER_OLDER,
        self::TIER_NEWER,
    ];

    public const LISTING_STATUSES = [
        self::LISTING_ACTIVE,
        self::LISTING_CLEARANCE,
        self::LISTING_ON_HOLD,
        self::LISTING_DISCONTINUED,
    ];

    public const PRICE_FIXED = 'fixed';

    public const PRICE_PERCENT_OF_STANDARD = 'percent_of_standard';

    /** Older-stock discount: % off this lot's own unit price (baseline kept in unit_price). */
    public const PRICE_PERCENT_OFF_LOT = 'percent_off_lot';

    public const PRICE_FOLLOW_STANDARD = 'follow_standard';

    public const PRICE_RULES = [
        self::PRICE_FIXED,
        self::PRICE_PERCENT_OF_STANDARD,
        self::PRICE_PERCENT_OFF_LOT,
        self::PRICE_FOLLOW_STANDARD,
    ];

    protected $fillable = [
        'product_id',
        'sku',
        'size',
        'color',
        'lot_number',
        'season',
        'collection_code',
        'listing_status',
        'lot_tier',
        'quantity_on_hand',
        'quantity_received',
        'unit_cost',
        'unit_price',
        'price_rule',
        'price_percent',
        'barcode',
        'is_sellable',
        'purchase_order_item_id',
        'stock_received_id',
        'notes',
        'received_at',
    ];

    protected $casts = [
        'quantity_on_hand' => 'integer',
        'quantity_received' => 'integer',
        'unit_cost' => 'decimal:2',
        'unit_price' => 'decimal:2',
        'price_percent' => 'decimal:2',
        'is_sellable' => 'boolean',
        'received_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function stockReceived(): BelongsTo
    {
        return $this->belongsTo(StockReceived::class);
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function priceEvents(): HasMany
    {
        return $this->hasMany(InventoryLotPriceEvent::class, 'inventory_lot_id');
    }

    public function latestPriceEvent(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(InventoryLotPriceEvent::class, 'inventory_lot_id')->latestOfMany();
    }

    public function detailEvents(): HasMany
    {
        return $this->hasMany(InventoryLotDetailEvent::class, 'inventory_lot_id');
    }

    public function latestDetailEvent(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(InventoryLotDetailEvent::class, 'inventory_lot_id')->latestOfMany();
    }

    public function isAvailableForSale(): bool
    {
        return $this->is_sellable
            && $this->quantity_on_hand > 0
            && ! in_array($this->listing_status, [self::LISTING_ON_HOLD, self::LISTING_DISCONTINUED], true);
    }
}
