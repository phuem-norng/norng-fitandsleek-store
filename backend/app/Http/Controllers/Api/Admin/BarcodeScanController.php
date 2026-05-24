<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\BarcodeScanStockService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BarcodeScanController extends Controller
{
    /**
     * Resolve a scanned URL / slug / barcode to a display name and price (no stock change).
     */
    public function lookup(Request $request): JsonResponse
    {
        $code = trim((string) $request->query('code', ''));
        if ($code === '') {
            return response()->json(['message' => 'Query parameter "code" is required.'], 422);
        }

        $data = BarcodeScanStockService::lookupDisplay($code);
        if ($data === null) {
            return response()->json(['message' => 'No Barcode & QR label or linked product matches this code.'], 422);
        }

        return response()->json(['data' => $data]);
    }

    /**
     * Scan a label code (barcode / slug) and reduce inventory — same logic as after payment, for walk-in or manual pickup.
     */
    public function sale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:120'],
            'qty' => ['nullable', 'integer', 'min:1', 'max:9999'],
        ]);

        $qty = (int) ($validated['qty'] ?? 1);
        $result = BarcodeScanStockService::applyScanDeduction($validated['code'], $qty);

        return response()->json([
            'message' => 'Stock updated.',
            'data' => $result,
        ]);
    }
}
