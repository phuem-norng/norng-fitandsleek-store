<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\InventoryLotService;
use Illuminate\Http\Request;

class InventorySettingsAdminController extends Controller
{
    public function show(InventoryLotService $lots)
    {
        return response()->json([
            'data' => [
                'sell_old_first' => $lots->sellOldFirst(),
            ],
        ]);
    }

    public function update(Request $request, InventoryLotService $lots)
    {
        $data = $request->validate([
            'sell_old_first' => ['required', 'boolean'],
        ]);

        Setting::query()->updateOrCreate(
            ['key' => 'inventory_sell_old_first'],
            [
                'value' => $data['sell_old_first'] ? 'true' : 'false',
                'type' => 'boolean',
                'group' => 'inventory',
            ],
        );

        return response()->json([
            'data' => [
                'sell_old_first' => $lots->sellOldFirst(),
            ],
            'message' => 'Inventory settings saved.',
        ]);
    }
}
