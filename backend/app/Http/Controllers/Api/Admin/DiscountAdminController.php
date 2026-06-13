<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Discount;
use App\Models\Product;
use App\Services\InventoryLotService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class DiscountAdminController extends Controller
{
    public function __construct(
        private readonly InventoryLotService $inventoryLots,
    ) {
    }

    private function assertDiscountQuantityWithinStock(Product $product, ?int $quantity): void
    {
        if ($quantity === null) {
            return;
        }

        $maxStock = $this->inventoryLots->productSellableStock($product);
        if ($quantity > $maxStock) {
            throw ValidationException::withMessages([
                'quantity' => [
                    "Discount quantity cannot exceed available stock ({$maxStock} units).",
                ],
            ]);
        }
    }

    public function index(Request $request)
    {
        $query = Discount::query();

        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        if ($request->has('start_date')) {
            $query->whereDate('start_date', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('end_date', '<=', $request->end_date);
        }

        if ($request->has('search')) {
            $query->whereHas('product', function ($q) {
                $q->where('name', 'like', '%' . request('search') . '%');
            });
        }

        $discounts = $query->with('product.brand')
            ->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 15));

        return response()->json($discounts);
    }

    public function show($id)
    {
        $discount = Discount::with('product.brand')->findOrFail($id);

        return response()->json($discount);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => 'required|exists:products,id',
            'discount_type' => 'required|in:percentage,fixed',
            'discount_value' => 'required|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'quantity' => 'nullable|integer|min:1',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after:start_date',
            'is_active' => 'boolean',
            'description' => 'nullable|string|max:500',
        ]);

        $product = Product::findOrFail($validated['product_id']);

        if (empty($validated['sale_price'])) {
            if ($validated['discount_type'] === 'percentage') {
                $validated['sale_price'] = $product->price * (1 - $validated['discount_value'] / 100);
            } else {
                $validated['sale_price'] = max(0, $product->price - $validated['discount_value']);
            }
        }

        $this->assertDiscountQuantityWithinStock($product, $validated['quantity'] ?? null);

        $discount = Discount::create($validated);

        return response()->json([
            'message' => 'Discount created successfully',
            'data' => $discount->load('product.brand'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $discount = Discount::findOrFail($id);

        $validated = $request->validate([
            'product_id' => 'sometimes|exists:products,id',
            'discount_type' => 'sometimes|in:percentage,fixed',
            'discount_value' => 'sometimes|numeric|min:0',
            'sale_price' => 'nullable|numeric|min:0',
            'quantity' => 'nullable|integer|min:1',
            'start_date' => 'sometimes|date',
            'end_date' => 'sometimes|date|after_or_equal:start_date',
            'is_active' => 'boolean',
            'description' => 'nullable|string|max:500',
        ]);

        $product = Product::findOrFail($validated['product_id'] ?? $discount->product_id);

        if (isset($validated['discount_value']) || isset($validated['discount_type'])) {
            if (empty($validated['sale_price'])) {
                $discountType = $validated['discount_type'] ?? $discount->discount_type;
                $discountValue = $validated['discount_value'] ?? $discount->discount_value;

                if ($discountType === 'percentage') {
                    $validated['sale_price'] = $product->price * (1 - $discountValue / 100);
                } else {
                    $validated['sale_price'] = max(0, $product->price - $discountValue);
                }
            }
        }

        $nextQuantity = array_key_exists('quantity', $validated)
            ? $validated['quantity']
            : $discount->quantity;
        $this->assertDiscountQuantityWithinStock($product, $nextQuantity !== null ? (int) $nextQuantity : null);

        $discount->update($validated);

        return response()->json([
            'message' => 'Discount updated successfully',
            'data' => $discount->load('product.brand'),
        ]);
    }

    public function destroy($id)
    {
        $discount = Discount::findOrFail($id);
        $discount->delete();

        return response()->json([
            'message' => 'Discount deleted successfully',
        ]);
    }

    public function getActiveDiscounts()
    {
        $discounts = Discount::where('is_active', true)
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now())
            ->with('product.brand')
            ->get();

        return response()->json($discounts);
    }

    public function bulkToggle(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:discounts,id',
            'is_active' => 'required|boolean',
        ]);

        Discount::whereIn('id', $validated['ids'])->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'message' => 'Discounts updated successfully',
            'count' => count($validated['ids']),
        ]);
    }
}
