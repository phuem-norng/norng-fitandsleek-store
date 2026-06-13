<?php

namespace App\Http\Middleware;

use App\Services\AdminPermissionService;
use Closure;
use Illuminate\Http\Request;

class EnsureAdmin
{
    public function __construct(
        private readonly AdminPermissionService $permissions,
    ) {}

    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $role = $user->getAttribute('role');
        if ($role !== 'admin' && $role !== 'superadmin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (! $this->permissions->authorizeRequest($user, $request)) {
            return response()->json([
                'message' => 'You do not have permission to perform this action.',
                'error' => 'admin_permission_denied',
            ], 403);
        }

        return $next($request);
    }
}
