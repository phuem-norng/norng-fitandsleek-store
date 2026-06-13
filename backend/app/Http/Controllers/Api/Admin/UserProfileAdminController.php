<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Address;
use App\Models\LoyaltyProfile;
use App\Models\Order;
use App\Models\User;
use App\Models\UserDeviceSession;
use App\Services\AdminPermissionService;
use App\Services\LoyaltyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class UserProfileAdminController extends BaseAdminController
{
    public function __construct(
        private readonly AdminPermissionService $permissions,
        private readonly LoyaltyService $loyaltyService,
    ) {}

    public function show(Request $request, User $user): JsonResponse
    {
        /** @var User $viewer */
        $viewer = $request->user();

        if (! $this->canViewProfile($viewer, $user)) {
            return response()->json([
                'message' => 'You do not have permission to view this profile.',
            ], 403);
        }

        $payload = [
            'user' => $this->formatUser($user),
            'stats' => $this->buildStats($user),
            'loyalty' => null,
            'addresses' => null,
            'recent_orders' => null,
            'activity' => null,
            'permissions' => null,
            'sessions' => null,
        ];

        if ($this->isStorefrontUser($user)) {
            $payload['loyalty'] = $this->buildLoyalty($user);
            $payload['addresses'] = $this->buildAddresses($user);
            $payload['recent_orders'] = $this->buildRecentOrders($user);
            $payload['activity'] = $this->buildActivity($user);
        }

        if ($user->isAdmin()) {
            $payload['permissions'] = $this->permissions->buildMatrixPayload($user);
        }

        if ($viewer->isSuperAdmin() && ($user->isAdmin() || $user->isSuperAdmin())) {
            $payload['sessions'] = $this->buildSessions($user);
        }

        return response()->json([
            'message' => 'User profile retrieved successfully',
            'data' => $payload,
        ]);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        /** @var User $viewer */
        $viewer = $request->user();

        if (! $viewer->isSuperAdmin()) {
            return response()->json(['message' => 'Only superadmins can reset passwords.'], 403);
        }

        if ($user->isSuperAdmin() && (int) $viewer->id !== (int) $user->id) {
            return response()->json(['message' => 'Cannot reset another superadmin password.'], 403);
        }

        $validated = $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user->update(['password' => Hash::make($validated['password'])]);

        return response()->json([
            'message' => 'Password reset successfully',
        ]);
    }

    private function canViewProfile(User $viewer, User $target): bool
    {
        if ((int) $viewer->id === (int) $target->id) {
            return true;
        }

        if ($target->isAdmin() || $target->isSuperAdmin()) {
            return $viewer->isSuperAdmin();
        }

        return $this->permissions->has($viewer, 'customers', 'view');
    }

    private function isStorefrontUser(User $user): bool
    {
        return in_array($user->role, ['customer', 'driver'], true);
    }

    /**
     * @return array<string, mixed>
     */
    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'address' => $user->address,
            'role' => $user->role,
            'status' => $user->status,
            'profile_image_url' => $user->profile_image_url,
            'email_verified_at' => $user->email_verified_at,
            'created_at' => $user->created_at,
            'has_two_factor' => $user->hasTwoFactorEnabled(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildStats(User $user): array
    {
        $row = DB::table('orders')
            ->where('user_id', $user->id)
            ->selectRaw('COUNT(*)::int as orders_count')
            ->selectRaw('COALESCE(SUM(total), 0) as total_spent')
            ->selectRaw('MAX(created_at) as last_order_at')
            ->first();

        $ordersCount = (int) ($row->orders_count ?? 0);
        $totalSpent = round((float) ($row->total_spent ?? 0), 2);

        return [
            'orders_count' => $ordersCount,
            'total_spent' => $totalSpent,
            'avg_order_value' => $ordersCount > 0 ? round($totalSpent / $ordersCount, 2) : 0,
            'last_order_at' => $row->last_order_at,
            'addresses_count' => Address::where('user_id', $user->id)->count(),
            'default_addresses_count' => Address::where('user_id', $user->id)->where('is_default', true)->count(),
            'wishlists_count' => $user->wishlists()->count(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function buildLoyalty(User $user): ?array
    {
        $profile = LoyaltyProfile::where('user_id', $user->id)->first();
        if (! $profile) {
            return null;
        }

        $tiers = $this->loyaltyService->tiers();
        $currentTier = strtolower((string) $profile->tier);
        $nextTier = null;

        foreach ($tiers as $key => $rule) {
            if ((int) $rule['min_points'] > (int) $profile->points) {
                $nextTier = ['tier' => $key, 'min_points' => (int) $rule['min_points']];
                break;
            }
        }

        return [
            'points' => (int) $profile->points,
            'tier' => $currentTier,
            'orders_count' => (int) $profile->orders_count,
            'lifetime_spend' => (float) $profile->lifetime_spend,
            'discount_percent' => (int) ($tiers[$currentTier]['discount_percent'] ?? 0),
            'next_tier' => $nextTier,
            'last_earned_at' => $profile->last_earned_at,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildAddresses(User $user): array
    {
        return Address::where('user_id', $user->id)
            ->orderByDesc('is_default')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Address $address) => [
                'id' => $address->id,
                'label' => $address->label,
                'receiver_name' => $address->receiver_name,
                'receiver_phone' => $address->receiver_phone,
                'house_no' => $address->house_no,
                'street_no' => $address->street_no,
                'sangkat' => $address->sangkat,
                'khan' => $address->khan,
                'province' => $address->province,
                'landmark' => $address->landmark,
                'street' => $address->street,
                'city' => $address->city,
                'state' => $address->state,
                'zip' => $address->zip,
                'country' => $address->country,
                'is_default' => (bool) $address->is_default,
                'updated_at' => $address->updated_at,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildRecentOrders(User $user): array
    {
        return Order::where('user_id', $user->id)
            ->withCount('items')
            ->orderByDesc('created_at')
            ->limit(15)
            ->get(['id', 'order_number', 'status', 'payment_status', 'payment_method', 'total', 'created_at'])
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status,
                'payment_status' => $order->payment_status,
                'payment_method' => $order->payment_method,
                'total' => (float) $order->total,
                'items_count' => (int) $order->items_count,
                'created_at' => $order->created_at,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildActivity(User $user): array
    {
        return Order::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(25)
            ->get(['id', 'order_number', 'status', 'total', 'created_at'])
            ->map(fn (Order $order) => [
                'type' => 'order',
                'title' => 'Order #'.($order->order_number ?: $order->id),
                'description' => 'Status: '.ucfirst((string) $order->status),
                'amount' => (float) $order->total,
                'date' => $order->created_at,
            ])
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function buildSessions(User $user): array
    {
        return UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->whereNotNull('personal_access_token_id')
            ->orderByDesc('last_used_at')
            ->orderByDesc('last_login_at')
            ->get()
            ->take(50)
            ->map(fn (UserDeviceSession $session) => [
                'id' => $session->id,
                'device_name' => $session->device_name,
                'browser' => $session->browser,
                'os' => $session->os,
                'ip_address' => $session->ip_address,
                'ip_city' => $session->ip_city,
                'ip_region' => $session->ip_region,
                'ip_country' => $session->ip_country,
                'last_login_at' => $session->last_login_at,
                'last_used_at' => $session->last_used_at,
            ])
            ->values()
            ->all();
    }
}
