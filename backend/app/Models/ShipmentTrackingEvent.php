<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShipmentTrackingEvent extends Model
{
    use HasFactory;

    /** Table only has `created_at` (see migration), not `updated_at`. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'shipment_id',
        'updated_by',
        'status',
        'location',
        'note',
        'event_time',
    ];

    protected function casts(): array
    {
        return [
            'event_time' => 'datetime',
        ];
    }

    // Relationships
    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
