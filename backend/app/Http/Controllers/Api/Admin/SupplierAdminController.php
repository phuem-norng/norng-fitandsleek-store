<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Supplier;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupplierAdminController extends BaseAdminController
{
    private function normalizeSupplierRequest(Request $request): void
    {
        if ($request->has('is_active')) {
            $request->merge(['is_active' => $this->bool($request->input('is_active'))]);
        }

        if ($request->has('supplier_code')) {
            $code = trim((string) $request->input('supplier_code'));
            $request->merge(['supplier_code' => $code !== '' ? strtoupper($code) : null]);
        }
    }

    private function supplierRules(?int $ignoreId = null): array
    {
        $uniqueCode = Rule::unique('suppliers', 'supplier_code');
        if ($ignoreId !== null) {
            $uniqueCode = $uniqueCode->ignore($ignoreId);
        }

        return [
            'supplier_code' => ['required', 'string', 'min:2', 'max:32', $uniqueCode],
            'name' => ['required', 'string', 'max:160'],
            'contact_person' => ['nullable', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:2000'],
            'city' => ['nullable', 'string', 'max:120'],
            'country' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    private function nextSupplierCode(): string
    {
        $existing = Supplier::query()
            ->whereNotNull('supplier_code')
            ->pluck('supplier_code')
            ->map(fn ($code) => strtoupper(trim((string) $code)))
            ->filter()
            ->flip();

        $n = 1;
        do {
            $candidate = 'SUP-'.str_pad((string) $n, 3, '0', STR_PAD_LEFT);
            $n++;
        } while (isset($existing[$candidate]) && $n < 100000);

        return $candidate;
    }

    private function serialize(Supplier $supplier): array
    {
        $purchaseOrderCount = (int) ($supplier->purchase_orders_count
            ?? $supplier->purchaseOrders()->count());
        $productCount = (int) ($supplier->products_count
            ?? $supplier->products()->count());

        return [
            'id' => $supplier->id,
            'supplier_code' => $supplier->supplier_code,
            'name' => $supplier->name,
            'contact_person' => $supplier->contact_person,
            'email' => $supplier->email,
            'phone' => $supplier->phone,
            'address' => $supplier->address,
            'city' => $supplier->city,
            'country' => $supplier->country,
            'notes' => $supplier->notes,
            'is_active' => (bool) $supplier->is_active,
            'purchase_order_count' => $purchaseOrderCount,
            'product_count' => $productCount,
            'can_delete' => $purchaseOrderCount === 0 && $productCount === 0,
            'created_at' => $supplier->created_at,
            'updated_at' => $supplier->updated_at,
        ];
    }

    private function deletionBlockMessage(Supplier $supplier): ?string
    {
        $purchaseOrderCount = $supplier->purchaseOrders()->count();
        $productCount = $supplier->products()->count();

        if ($purchaseOrderCount === 0 && $productCount === 0) {
            return null;
        }

        $parts = [];
        if ($purchaseOrderCount > 0) {
            $parts[] = $purchaseOrderCount === 1
                ? '1 purchase order'
                : "{$purchaseOrderCount} purchase orders";
        }
        if ($productCount > 0) {
            $parts[] = $productCount === 1
                ? '1 product'
                : "{$productCount} products";
        }

        return 'Cannot delete this supplier because it is linked to '
            .implode(' and ', $parts)
            .'. Set the supplier to Inactive instead, or remove those links first.';
    }

    public function index(Request $request)
    {
        $query = Supplier::query()->orderBy('name');

        if ($request->filled('search')) {
            $search = (string) $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('supplier_code', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('country', 'like', "%{$search}%");
            });
        }

        if ($request->has('is_active') && $request->input('is_active') !== '') {
            $query->where('is_active', $this->bool($request->input('is_active')));
        }

        $items = $query
            ->withCount(['purchaseOrders', 'products'])
            ->get()
            ->map(fn (Supplier $s) => $this->serialize($s));

        return response()->json([
            'data' => $items,
            'next_supplier_code' => $this->nextSupplierCode(),
        ]);
    }

    public function show(Supplier $supplier)
    {
        return response()->json(['data' => $this->serialize($supplier)]);
    }

    public function store(Request $request)
    {
        $this->normalizeSupplierRequest($request);
        $validated = $request->validate(
            $this->supplierRules(),
            ['supplier_code.unique' => 'This Supplier ID is already in use. Please choose a different one.']
        );

        $supplier = Supplier::create([
            ...$validated,
            'supplier_code' => strtoupper(trim((string) $validated['supplier_code'])),
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json(['data' => $this->serialize($supplier)], 201);
    }

    public function update(Request $request, Supplier $supplier)
    {
        $this->normalizeSupplierRequest($request);
        $validated = $request->validate(
            $this->supplierRules($supplier->id),
            ['supplier_code.unique' => 'This Supplier ID is already in use. Please choose a different one.']
        );

        if (array_key_exists('supplier_code', $validated)) {
            $validated['supplier_code'] = strtoupper(trim((string) $validated['supplier_code']));
        }

        $supplier->fill($validated);
        $supplier->save();

        return response()->json(['data' => $this->serialize($supplier)]);
    }

    public function destroy(Supplier $supplier)
    {
        $message = $this->deletionBlockMessage($supplier);
        if ($message !== null) {
            return response()->json(['message' => $message], 422);
        }

        $supplier->delete();

        return response()->json(['message' => 'Supplier deleted.']);
    }
}
