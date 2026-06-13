<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryLotDetailEvent extends Model
{
    public const ACTION_CREATE = 'create';

    public const ACTION_RECEIVE_PO = 'receive_po';

    public const ACTION_UPDATE = 'update';

    public const ACTION_SET_ON_HOLD = 'set_on_hold';

    public const ACTION_SET_SELLABLE = 'set_sellable';

    public const ACTION_MARK_CLEARANCE = 'mark_clearance';

    public const ACTION_REVERT_CLEARANCE = 'revert_clearance';

    protected $fillable = [
        'inventory_lot_id',
        'user_id',
        'action',
        'changes',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
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
