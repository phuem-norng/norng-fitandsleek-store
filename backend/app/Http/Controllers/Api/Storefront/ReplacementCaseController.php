<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\ReplacementCase;
use App\Services\ReplacementCaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReplacementCaseController extends Controller
{
    public function __construct(
        private readonly ReplacementCaseService $replacementCaseService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $cases = ReplacementCase::query()
            ->whereHas('order', fn ($q) => $q->where('user_id', $user->id))
            ->with(ReplacementCaseService::defaultEagerLoad())
            ->orderByDesc('id')
            ->paginate($request->get('per_page', 10));

        return response()->json(["data" => $cases]);
    }

    public function byOrder(Request $request, int $orderId): JsonResponse
    {
        $user = $request->user();

        $cases = ReplacementCase::query()
            ->where('order_id', $orderId)
            ->whereHas('order', fn ($q) => $q->where('user_id', $user->id))
            ->with(ReplacementCaseService::defaultEagerLoad())
            ->orderByDesc('id')
            ->get();

        return response()->json(["data" => $cases]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => ['required', 'integer', 'exists:orders,id'],
            'reason' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1'],
            'items.*.requested_size' => ['nullable', 'string', 'max:50'],
            'items.*.requested_color' => ['nullable', 'string', 'max:50'],
            'items.*.note' => ['nullable', 'string', 'max:500'],
        ]);

        $order = Order::with('items')->findOrFail($validated['order_id']);
        if ($order->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $case = $this->replacementCaseService->createCase(
            $order,
            $validated['reason'],
            $validated['notes'] ?? null,
            $validated['items'],
        );

        return response()->json([
            'message' => 'Replacement case submitted',
            'data' => $case,
        ], 201);
    }
}
