<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Services\DeliveryFeeService;
use Illuminate\Http\Request;

class DeliveryFeeController extends Controller
{
    public function rates(DeliveryFeeService $deliveryFees)
    {
        return response()->json([
            'data' => $deliveryFees->getRates(),
        ]);
    }

    public function quote(Request $request, DeliveryFeeService $deliveryFees)
    {
        $validated = $request->validate([
            'province' => 'nullable|string|max:120',
        ]);

        return response()->json([
            'data' => $deliveryFees->quote($validated['province'] ?? null),
        ]);
    }
}
