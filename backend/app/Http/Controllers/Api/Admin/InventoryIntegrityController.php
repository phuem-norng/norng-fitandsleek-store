<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\InventoryIntegrityService;
use Illuminate\Http\Request;

class InventoryIntegrityController extends Controller
{
    public function index(InventoryIntegrityService $integrity)
    {
        return response()->json(['data' => $integrity->audit()]);
    }

    public function repair(Request $request, InventoryIntegrityService $integrity)
    {
        $validated = $request->validate([
            'master_id' => ['nullable', 'integer', 'exists:categories,id'],
        ]);

        $result = $integrity->repair(
            isset($validated['master_id']) ? (int) $validated['master_id'] : null,
        );

        return response()->json([
            'data' => $result,
            'audit' => $integrity->audit(),
        ]);
    }
}
