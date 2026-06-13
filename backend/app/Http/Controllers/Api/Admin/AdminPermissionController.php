<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\User;
use App\Services\AdminPermissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPermissionController extends BaseAdminController
{
    public function show(User $user, AdminPermissionService $permissions): JsonResponse
    {
        $authUser = $this->requireSuperAdmin();
        if ($authUser instanceof JsonResponse) {
            return $authUser;
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'message' => 'Permissions can only be managed for admin accounts.',
            ], 422);
        }

        return response()->json([
            'message' => 'Admin permissions retrieved successfully',
            'data' => $permissions->buildMatrixPayload($user),
        ]);
    }

    public function update(Request $request, User $user, AdminPermissionService $permissions): JsonResponse
    {
        $authUser = $this->requireSuperAdmin();
        if ($authUser instanceof JsonResponse) {
            return $authUser;
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'message' => 'Permissions can only be managed for admin accounts.',
            ], 422);
        }

        $validated = $request->validate([
            'permissions' => 'required|array',
        ]);

        try {
            $permissions->updatePermissions($user, $validated['permissions']);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Admin permissions updated successfully',
            'data' => $permissions->buildMatrixPayload($user->fresh()),
        ]);
    }

    public function reset(User $user, AdminPermissionService $permissions): JsonResponse
    {
        $authUser = $this->requireSuperAdmin();
        if ($authUser instanceof JsonResponse) {
            return $authUser;
        }

        if ($user->role !== 'admin') {
            return response()->json([
                'message' => 'Permissions can only be managed for admin accounts.',
            ], 422);
        }

        $permissions->applyDefaultPermissions($user);

        return response()->json([
            'message' => 'Admin permissions reset to defaults',
            'data' => $permissions->buildMatrixPayload($user->fresh()),
        ]);
    }

    public function catalog(AdminPermissionService $permissions): JsonResponse
    {
        $authUser = $this->requireSuperAdmin();
        if ($authUser instanceof JsonResponse) {
            return $authUser;
        }

        return response()->json([
            'message' => 'Permission catalog retrieved successfully',
            'data' => [
                'groups' => $permissions->buildMatrixPayload(new User(['role' => 'admin']))['groups'],
                'defaults' => $permissions->defaultPermissions(),
                'actions' => $permissions->actions(),
            ],
        ]);
    }

    private function requireSuperAdmin(): User|JsonResponse
    {
        /** @var \App\Models\User|null $user */
        $user = auth()->guard('sanctum')->user();
        if (! $user || ! $user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return $user;
    }
}
