<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\UserDeviceSession;
use App\Models\User;
use App\Services\AdminPermissionService;
use App\Services\DeviceSessionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class SuperAdminController extends BaseAdminController
{
    /**
     * Get all users with role filtering
     */
    public function allUsers(Request $request): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = auth()->guard('sanctum')->user();
        // Only superadmins can access this
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized',
            ], 403);
        }

        $query = User::query();

        // Filter by role
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search by name or email
        if ($request->has('search')) {
            $search = $request->search;
            $query->where('name', 'like', "%$search%")
                ->orWhere('email', 'like', "%$search%");
        }

        $users = $query->paginate($request->get('per_page', 15));

        return response()->json([
            'message' => 'Users retrieved successfully',
            'data' => $users,
        ]);
    }

    /**
        * Create new privileged user
     */
    public function createAdmin(Request $request, AdminPermissionService $permissions): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = auth()->guard('sanctum')->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only superadmins can create admin users',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:1000',
            'role' => 'nullable|in:admin,driver,customer,superadmin',
        ]);

        $targetRole = $validated['role'] ?? 'admin';

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $targetRole,
            'status' => 'active',
            'phone' => $validated['phone'],
            'address' => $validated['address'],
        ]);

        if ($targetRole === 'admin') {
            $permissions->applyDefaultPermissions($user);
        }

        return response()->json([
            'message' => ucfirst($targetRole).' user created successfully',
            'data' => $user->fresh(),
        ], 201);
    }

    /**
     * Update admin user profile (superadmin only)
     */
    public function updateAdmin(Request $request, User $user, AdminPermissionService $permissions): JsonResponse
    {
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if (! $authUser || ! $authUser->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only superadmins can update admin users',
            ], 403);
        }

        if ($user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Cannot change superadmin account',
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,'.$user->id,
            'phone' => 'nullable|string|max:30',
            'address' => 'nullable|string|max:1000',
            'password' => 'nullable|string|min:8|confirmed',
            'role' => 'nullable|in:customer,admin,driver,superadmin',
        ]);

        if ((int) $user->id === (int) $authUser->id) {
            unset($validated['role']);
        }

        if (array_key_exists('role', $validated) && $validated['role']) {
            $permissions->applyRoleChange($user, $validated['role']);
            unset($validated['role']);
        }

        if (array_key_exists('password', $validated) && $validated['password']) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Admin user updated successfully',
            'data' => $user->fresh(),
        ]);
    }

    /**
     * Delete admin user (superadmin only)
     */
    public function deleteAdmin(User $user): JsonResponse
    {
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if (! $authUser || ! $authUser->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only superadmins can delete admin users',
            ], 403);
        }

        if ($user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Cannot delete superadmin account',
            ], 403);
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'message' => 'Target user is not an admin account',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'message' => 'Admin user deleted successfully',
        ]);
    }

    /**
     * Update user role
     */
    public function updateRole(Request $request, User $user): JsonResponse
    {
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if (!$authUser || !$authUser->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only superadmins can change user roles',
            ], 403);
        }

        if ($user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Cannot change superadmin role',
            ], 403);
        }

        $validated = $request->validate([
            'role' => 'required|in:admin,customer,driver',
        ]);

        $user->update(['role' => $validated['role']]);

        return response()->json([
            'message' => 'User role updated successfully',
            'data' => $user,
        ]);
    }

    /**
     * Update user status
     */
    public function updateStatus(Request $request, User $user): JsonResponse
    {
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if (!$authUser || !$authUser->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only superadmins can change user status',
            ], 403);
        }
        if ($user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Cannot change superadmin status',
            ], 403);
        }
        $validated = $request->validate([
            'status' => 'required|in:active,inactive,suspended',
        ]);

        $user->update(['status' => $validated['status']]);

        return response()->json([
            'message' => 'User status updated successfully',
            'data' => $user,
        ]);
    }

    /**
     * Get system statistics (Superadmin only)
     */
    public function systemStatistics(): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = auth()->guard('sanctum')->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized',
            ], 403);
        }

        $stats = [
            'total_users' => User::count(),
            'total_superadmins' => User::where('role', 'superadmin')->count(),
            'total_admins' => User::where('role', 'admin')->count(),
            'total_drivers' => User::where('role', 'driver')->count(),
            'total_customers' => User::where('role', 'customer')->count(),
            'active_users' => User::where('status', 'active')->count(),
            'inactive_users' => User::where('status', 'inactive')->count(),
            'suspended_users' => User::where('status', 'suspended')->count(),
        ];

        return response()->json([
            'message' => 'System statistics retrieved',
            'data' => $stats,
        ]);
    }

    /**
     * Get user activity logs (Superadmin only)
     */
    public function userLogs(Request $request): JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = auth()->guard('sanctum')->user();
        if (!$user || !$user->isSuperAdmin()) {
            return response()->json([
                'message' => 'Unauthorized',
            ], 403);
        }

        $user = User::findOrFail($request->user_id);

        return response()->json([
            'message' => 'User logs retrieved',
            'data' => [
                'user' => $user,
                'orders_count' => $user->orders()->count(),
                'wishlists_count' => $user->wishlists()->count(),
                'last_login' => null, // TODO: Implement login tracking
            ],
        ]);
    }

    public function userSessions(User $user): JsonResponse
    {
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if (! $authUser || ! $authUser->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $sessions = UserDeviceSession::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_used_at')
            ->orderByDesc('last_login_at')
            ->get();

        return response()->json([
            'message' => 'User sessions retrieved successfully',
            'data' => $sessions,
        ]);
    }

    public function revokeUserSession(User $user, UserDeviceSession $session, DeviceSessionService $deviceSessionService): JsonResponse
    {
        /** @var \App\Models\User|null $authUser */
        $authUser = auth()->guard('sanctum')->user();
        if (! $authUser || ! $authUser->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ((int) $session->user_id !== (int) $user->id) {
            return response()->json(['message' => 'Session not found for user'], 404);
        }

        $deviceSessionService->revokeSession($session);

        return response()->json([
            'message' => 'User session revoked successfully',
        ]);
    }
}
