<?php

namespace App\Http\Controllers\Api\Admin;

use App\Services\DeliveryFeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DeliveryFeeAdminController extends BaseAdminController
{
    public function show(DeliveryFeeService $deliveryFees): JsonResponse
    {
        return response()->json([
            'data' => $deliveryFees->getRates(),
        ]);
    }

    public function update(Request $request, DeliveryFeeService $deliveryFees): JsonResponse
    {
        $validated = $request->validate([
            'phnom_penh' => 'required|numeric|min:0|max:9999',
            'province' => 'required|numeric|min:0|max:9999',
        ]);

        $rates = $deliveryFees->updateRates(
            (float) $validated['phnom_penh'],
            (float) $validated['province'],
        );

        return response()->json([
            'message' => 'Delivery fees updated successfully',
            'data' => $rates,
        ]);
    }
}
