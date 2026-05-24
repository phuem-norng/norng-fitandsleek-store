<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Cart;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Services\ProductVariantInventory;
use App\Services\SecurityAuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    public function __construct(private SecurityAuditService $securityAudit)
    {
    }

    private function resolveUnitPrice($cartItem): float
    {
        if ($cartItem->product) {
            return (float) ($cartItem->product->final_price ?? $cartItem->product->price ?? $cartItem->unit_price ?? 0);
        }

        return (float) ($cartItem->unit_price ?? 0);
    }

    private function generateOrderNumber(): string
    {
        // Generate a unique order number like "ORD-2026-001234"
        $date = now()->format('Y');
        $uniqueId = strtoupper(Str::random(6));
        return "ORD-{$date}-{$uniqueId}";
    }

    public function myOrders(Request $request)
    {
        $orders = Order::with(['items.product.category'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->paginate(10);

        return response()->json($orders);
    }

    public function trackOrder($orderNumber, Request $request)
    {
        $order = Order::with(['items.product'])
            ->where('order_number', $orderNumber)
            ->first();

        if (!$order) {
            // Also check by ID
            $order = Order::with(['items.product'])
                ->where('id', (int) $orderNumber)
                ->first();
        }

        if (!$order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        return response()->json([
            'order' => [
                'id' => $order->order_number ?: $order->id,
                'status' => $order->status,
                'total' => $order->total,
                'created_at' => $order->created_at,
                'shipping_address' => $order->shipping_address ?? 'N/A',
                'tracking_number' => $order->tracking_number,
                'items' => $order->items->map(function ($item) {
                    $qty = $item->qty ?? $item->quantity ?? 0;
                    $price = $item->price ?? $item->unit_price ?? 0;
                    $subtotal = $item->line_total ?? ((float) $price * (int) $qty);
                    return [
                        'name' => $item->product->name ?? $item->name ?? 'Product',
                        'quantity' => (int) $qty,
                        'price' => (float) $price,
                        'subtotal' => round((float) $subtotal, 2),
                        'image_url' => $item->product->image_url ?? null,
                    ];
                }),
            ],
        ]);
    }

    public function checkout(Request $request)
    {
        $validated = $request->validate([
            'payment_method' => 'required|in:bakong_khqr,card_visa',
            'shipping_address' => 'nullable|array',
            'billing_address' => 'nullable|array',
        ]);

        $userId = (int) $request->user()->id;

        $cart = Cart::with('items.product.activeDiscount')->where('user_id', $userId)->first();

        if (! $cart || $cart->items->isEmpty()) {
            return response()->json(['message' => 'Cart is empty.'], 422);
        }

        foreach ($cart->items as $ci) {
            $product = Product::with('activeDiscount')->find((int) $ci->product_id);
            if (! $product || ! (bool) $product->is_active) {
                throw ValidationException::withMessages([
                    'cart' => ['One or more products are unavailable. Please refresh your cart and try again.'],
                ]);
            }
            if (is_numeric($product->stock)) {
                $cap = ProductVariantInventory::effectiveCapForCartLine($product, $ci->color, $ci->size);
                if ((int) $ci->quantity > $cap) {
                    throw ValidationException::withMessages([
                        'cart' => ['Not enough stock for: '.$product->name.'.'],
                    ]);
                }
            }
        }

        $order = DB::transaction(function () use ($userId, $cart, $validated) {
            $total = 0;
            $validatedProducts = [];
            $validatedUnitPrices = [];

            foreach ($cart->items as $i) {
                $productId = (int) $i->product_id;
                if (!isset($validatedProducts[$productId])) {
                    $product = Product::with('activeDiscount')->find($productId);
                    if (! $product || ! (bool) $product->is_active) {
                        throw ValidationException::withMessages([
                            'cart' => ['One or more products are unavailable. Please refresh your cart and try again.'],
                        ]);
                    }

                    $validatedProducts[$productId] = $product;
                    $validatedUnitPrices[$productId] = (float) ($product->final_price ?? $product->price ?? 0);
                }

                $unitPrice = (float) $validatedUnitPrices[$productId];
                $total += $unitPrice * (int) $i->quantity;
            }

            $order = Order::create([
                'user_id' => $userId,
                'order_number' => $this->generateOrderNumber(),
                'status' => 'pending_payment',
                'payment_status' => 'pending',
                'subtotal' => round($total, 2),
                'total' => round($total, 2),
                'payment_method' => $validated['payment_method'],
                'shipping_address' => $validated['shipping_address'] ?? null,
                'billing_address' => $validated['billing_address'] ?? null,
            ]);

            foreach ($cart->items as $ci) {
                $productId = (int) $ci->product_id;
                $product = $validatedProducts[$productId] ?? $ci->product;
                $unitPrice = (float) ($validatedUnitPrices[$productId] ?? $this->resolveUnitPrice($ci));
                $line = $unitPrice * (int) $ci->quantity;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $ci->product_id,
                    'size' => $ci->size ?? null,
                    'color' => $ci->color ?? null,
                    'name' => $product->name ?? 'Product',
                    'sku' => $product->sku ?? '',
                    'price' => $unitPrice,
                    'qty' => $ci->quantity,
                    'line_total' => round($line, 2),
                ]);
            }

            // Create pending payment record
            \App\Models\Payment::create([
                'order_id' => $order->id,
                'provider' => $validated['payment_method'] === 'bakong_khqr' ? 'bakong' : 'card',
                'amount' => $order->total,
                'currency' => config('services.bakong.currency', 'KHR'),
                'method' => $validated['payment_method'],
                'status' => 'pending',
            ]);

            return $order->load(['items.product.category']);
        });

        $shipping = $validated['shipping_address'] ?? [];
        $hasDeliveryGps = ! empty($shipping['latitude']) && ! empty($shipping['longitude']);

        $this->securityAudit->record($request, 'checkout.placed', $request->user(), [
            'order_id' => $order->id,
            'order_number' => $order->order_number,
            'payment_method' => $validated['payment_method'],
            'delivery_gps_provided' => $hasDeliveryGps,
        ]);

        return response()->json([
            'message' => 'Checkout successful. Please complete payment.',
            'order' => $order,
        ], 201);
    }
}
