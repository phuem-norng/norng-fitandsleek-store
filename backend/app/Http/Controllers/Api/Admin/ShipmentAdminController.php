<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Order;
use App\Models\Shipment;
use App\Models\ShipmentTrackingEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShipmentAdminController extends BaseAdminController
{
    private function transformShipment(Shipment $shipment): array
    {
        $shipment->loadMissing(['order.user', 'trackingEvents.updatedBy']);

        $data = $shipment->toArray();
        $data['tracking_number'] = $shipment->tracking_code;
        $data['external_tracking_url'] = $shipment->external_tracking_url;
        $data['internal_tracking_url'] = $shipment->tracking_url;
        $data['tracking_events'] = $shipment->trackingEvents->map(function ($event) {
            return [
                'id' => $event->id,
                'status' => $event->status,
                'location' => $event->location,
                'description' => $event->note,
                'note' => $event->note,
                'created_at' => $event->created_at,
                'event_time' => $event->event_time,
            ];
        })->values();

        return $data;
    }

    /**
     * Get all shipments
     */
    public function index(Request $request): JsonResponse
    {
        $query = Shipment::with(['order.user', 'trackingEvents']);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by provider
        if ($request->has('provider')) {
            $query->where('provider', $request->provider);
        }

        // Search by tracking code
        if ($request->has('tracking_code')) {
            $query->where('tracking_code', 'like', '%' . $request->tracking_code . '%');
        }

        $shipments = $query->paginate($request->get('per_page', 15));
        $shipments->setCollection(
            $shipments->getCollection()->map(fn ($s) => $this->transformShipment($s))
        );

        return response()->json([
            'message' => 'Shipments retrieved successfully',
            'data' => $shipments,
        ]);
    }

    /**
     * Get shipment by order
     */
    public function byOrder(int $orderId): JsonResponse
    {
        $shipment = Shipment::where('order_id', $orderId)
            ->with(['order.user', 'trackingEvents.updatedBy'])
            ->first();

        if (!$shipment) {
            return response()->json([
                'message' => 'Shipment not found for this order',
            ], 404);
        }

        // Admins can only view shipments for customer orders
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if ($shipment->order && !$shipment->order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to view this shipment',
                ], 403);
            }
        }

        return response()->json([
            'message' => 'Shipment retrieved successfully',
            'data' => $this->transformShipment($shipment),
        ]);
    }

    /**
     * Create or update shipment
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
            'provider' => 'required|string|max:100',
            'tracking_code' => 'required|string|max:100',
            'external_tracking_url' => 'nullable|url|max:500',
            'mark_shipped' => 'sometimes|boolean',
        ]);

        $shipment = Shipment::firstOrNew(['order_id' => $validated['order_id']]);
        $wasShipped = $shipment->exists && in_array($shipment->status, ['shipped', 'in_transit', 'delivered'], true);

        $shipment->provider = $validated['provider'];
        $shipment->tracking_code = $validated['tracking_code'];

        if (array_key_exists('external_tracking_url', $validated)) {
            $shipment->external_tracking_url = $validated['external_tracking_url'] ?: null;
        }

        $shouldMarkShipped = ! empty($validated['external_tracking_url'])
            || ($validated['mark_shipped'] ?? false);

        if ($shouldMarkShipped) {
            $shipment->status = 'shipped';
            if (! $shipment->shipped_at) {
                $shipment->shipped_at = now();
            }
        } elseif (! $shipment->exists) {
            $shipment->status = 'pending';
        }

        $shipment->save();

        if ($shouldMarkShipped && ! $wasShipped) {
            ShipmentTrackingEvent::create([
                'shipment_id' => $shipment->id,
                'status' => 'shipped',
                'note' => 'Package handed to courier.',
                'updated_by' => auth()->guard('sanctum')->id(),
                'event_time' => now(),
            ]);

            $order = Order::find($validated['order_id']);
            if ($order && ! in_array($order->status, ['completed', 'cancelled', 'delivered'], true)) {
                $order->update(['status' => 'shipped']);
            }
        }

        return response()->json([
            'message' => 'Shipment created/updated successfully',
            'data' => $this->transformShipment($shipment->fresh()),
        ]);
    }

    /**
     * Update shipment status
     */
    public function updateStatus(Request $request, Shipment $shipment): JsonResponse
    {
        // Admins can only update shipments for customer orders
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if ($shipment->order && !$shipment->order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to update this shipment',
                ], 403);
            }
        }

        $validated = $request->validate([
            'status' => 'required|in:pending,processing,shipped,in_transit,delivered,failed,returned',
            'shipped_at' => 'nullable|date',
            'delivered_at' => 'nullable|date',
        ]);

        $status = $validated['status'];
        $shippedAt = $validated['shipped_at'] ?? $shipment->shipped_at;
        $deliveredAt = $validated['delivered_at'] ?? $shipment->delivered_at;
        if (in_array($status, ['shipped', 'in_transit', 'delivered'], true) && !$shippedAt) {
            $shippedAt = now();
        }
        if ($status === 'delivered' && !$deliveredAt) {
            $deliveredAt = now();
        }

        $shipment->update([
            'status' => $status,
            'shipped_at' => $shippedAt,
            'delivered_at' => $deliveredAt,
        ]);

        // Add tracking event
        ShipmentTrackingEvent::create([
            'shipment_id' => $shipment->id,
            'status' => $validated['status'],
            'updated_by' => auth()->guard('sanctum')->user()->id,
            'event_time' => now(),
        ]);

        return response()->json([
            'message' => 'Shipment status updated successfully',
            'data' => $this->transformShipment($shipment),
        ]);
    }

    /**
     * Add tracking event
     */
    public function addTrackingEvent(Request $request, Shipment $shipment): JsonResponse
    {
        // Admins can only add events for customer order shipments
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if ($shipment->order && !$shipment->order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to add tracking events for this shipment',
                ], 403);
            }
        }

        $validated = $request->validate([
            'status' => 'required|string',
            'location' => 'nullable|string|max:255',
            'note' => 'nullable|string',
            'description' => 'nullable|string',
        ]);

        $note = $validated['note'] ?? $validated['description'] ?? null;

        $event = ShipmentTrackingEvent::create([
            'shipment_id' => $shipment->id,
            'status' => $validated['status'],
            'location' => $validated['location'],
            'note' => $note,
            'updated_by' => auth()->guard('sanctum')->user()->id,
            'event_time' => now(),
        ]);

        return response()->json([
            'message' => 'Tracking event added successfully',
            'data' => $event,
        ]);
    }

    /**
     * Get available providers
     */
    public function providers(): JsonResponse
    {
        $providers = [
            'J&T Express',
            'Vireak Buntham Express',
            'Grab Express',
            'Ninja Van',
            'Kerry Express',
            'Other',
        ];

        return response()->json([
            'message' => 'Providers retrieved',
            'data' => $providers,
        ]);
    }
}
