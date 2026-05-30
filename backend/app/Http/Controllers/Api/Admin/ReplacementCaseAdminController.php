<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\ReplacementCase;
use App\Models\Order;
use App\Services\ReplacementCaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReplacementCaseAdminController extends BaseAdminController
{
    public function __construct(
        private readonly ReplacementCaseService $replacementCaseService,
    ) {}

    /**
     * Get all replacement cases
     */
    public function index(Request $request): JsonResponse
    {
        $query = ReplacementCase::with(ReplacementCaseService::defaultEagerLoad());

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by reason
        if ($request->has('reason')) {
            $query->where('reason', 'like', '%' . $request->reason . '%');
        }

        // Filter by handler
        if ($request->has('handled_by')) {
            $query->where('handled_by', $request->handled_by);
        }

        $cases = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Replacement cases retrieved successfully',
            'data' => $cases,
        ]);
    }

    /**
     * Get replacement cases for order
     */
    public function byOrder(int $orderId): JsonResponse
    {
        $cases = ReplacementCase::where('order_id', $orderId)
            ->with(ReplacementCaseService::defaultEagerLoad())
            ->get();

        return response()->json([
            'message' => 'Replacement cases retrieved',
            'data' => $cases,
        ]);
    }

    /**
     * Create replacement case
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order_id' => 'required|exists:orders,id',
            'reason' => 'required|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'items' => 'required|array|min:1',
            'items.*.order_item_id' => 'required|integer|exists:order_items,id',
            'items.*.quantity' => 'nullable|integer|min:1',
            'items.*.requested_size' => 'nullable|string|max:50',
            'items.*.requested_color' => 'nullable|string|max:50',
            'items.*.note' => 'nullable|string|max:500',
        ]);

        // Admins can only create cases for customer orders
        $order = Order::with('items')->findOrFail($validated['order_id']);
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if (!$order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to create replacement case for this order',
                ], 403);
            }
        }

        $case = $this->replacementCaseService->createCase(
            $order,
            $validated['reason'],
            $validated['notes'] ?? null,
            $validated['items'],
        );

        return response()->json([
            'message' => 'Replacement case created successfully',
            'data' => $case,
        ], 201);
    }

    /**
     * Update replacement case
     */
    public function update(Request $request, ReplacementCase $case): JsonResponse
    {
        // Admins can only update cases for customer orders
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if ($case->order && !$case->order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to update this replacement case',
                ], 403);
            }
        }

        $validated = $request->validate([
            'status' => 'nullable|in:pending,approved,rejected,completed',
            'notes' => 'nullable|string|max:1000',
        ]);

        $case->update([
            'status' => $validated['status'] ?? $case->status,
            'notes' => $validated['notes'] ?? $case->notes,
            'handled_by' => auth()->guard('sanctum')->user()->id,
        ]);

        return response()->json([
            'message' => 'Replacement case updated successfully',
            'data' => $case,
        ]);
    }

    /**
     * Approve replacement case
     */
    public function approve(Request $request, ReplacementCase $case): JsonResponse
    {
        // Admins can only approve cases for customer orders
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if ($case->order && !$case->order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to approve this replacement case',
                ], 403);
            }
        }

        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        $case->update([
            'status' => 'approved',
            'notes' => $validated['notes'] ?? $case->notes,
            'handled_by' => auth()->guard('sanctum')->user()->id,
        ]);

        return response()->json([
            'message' => 'Replacement case approved',
            'data' => $case->load(ReplacementCaseService::defaultEagerLoad()),
        ]);
    }

    /**
     * Reject replacement case
     */
    public function reject(Request $request, ReplacementCase $case): JsonResponse
    {
        // Admins can only reject cases for customer orders
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if ($authUser && $authUser->isAdmin() && !$authUser->isSuperAdmin()) {
            if ($case->order && !$case->order->user->isCustomer()) {
                return response()->json([
                    'message' => 'Unauthorized to reject this replacement case',
                ], 403);
            }
        }

        $validated = $request->validate([
            'notes' => 'required|string|max:1000',
        ]);

        $case->update([
            'status' => 'rejected',
            'notes' => $validated['notes'],
            'handled_by' => auth()->guard('sanctum')->user()->id,
        ]);

        return response()->json([
            'message' => 'Replacement case rejected',
            'data' => $case->load(ReplacementCaseService::defaultEagerLoad()),
        ]);
    }

    /**
     * Mark as completed
     */
    public function complete(Request $request, ReplacementCase $case): JsonResponse
    {
        $validated = $request->validate([
            'notes' => 'nullable|string|max:1000',
        ]);

        $case->update([
            'status' => 'completed',
            'notes' => $validated['notes'] ?? $case->notes,
        ]);

        return response()->json([
            'message' => 'Replacement case marked as completed',
            'data' => $case->load(ReplacementCaseService::defaultEagerLoad()),
        ]);
    }

    /**
     * Get replacement case statistics
     */
    public function statistics(): JsonResponse
    {
        $stats = [
            'total_pending' => ReplacementCase::where('status', 'pending')->count(),
            'total_approved' => ReplacementCase::where('status', 'approved')->count(),
            'total_rejected' => ReplacementCase::where('status', 'rejected')->count(),
            'total_completed' => ReplacementCase::where('status', 'completed')->count(),
        ];

        return response()->json([
            'message' => 'Replacement case statistics retrieved',
            'data' => $stats,
        ]);
    }
}
