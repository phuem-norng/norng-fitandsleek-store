<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TelegramController extends Controller
{
    public function __construct(private TelegramService $telegram)
    {
    }

    public function settings(): JsonResponse
    {
        return response()->json([
            'enabled' => $this->telegram->isEnabled(),
            'bot_username' => $this->telegram->botUsername(),
            'bot_url' => $this->telegram->botUsername()
                ? 'https://t.me/'.$this->telegram->botUsername()
                : null,
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['connected' => false, 'enabled' => $this->telegram->isEnabled()]);
        }

        return response()->json([
            'enabled' => $this->telegram->isEnabled(),
            'connected' => $this->telegram->isUserConnected((int) $user->id),
            'bot_username' => $this->telegram->botUsername(),
            'connect_url' => $this->telegram->buildAccountConnectLink((int) $user->id),
        ]);
    }

    public function orderLink(Request $request, string $orderNumber): JsonResponse
    {
        $user = $request->user();
        $order = Order::findByPublicKey($orderNumber);

        if (! $order) {
            return response()->json(['message' => 'Order not found'], 404);
        }

        if ((int) $order->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json([
            'enabled' => $this->telegram->isEnabled(),
            'connected' => $this->telegram->isUserConnected((int) $user->id),
            'order_number' => $order->order_number,
            'connect_url' => $this->telegram->buildOrderConnectLink($order),
            'account_connect_url' => $this->telegram->buildAccountConnectLink((int) $user->id),
        ]);
    }
}
