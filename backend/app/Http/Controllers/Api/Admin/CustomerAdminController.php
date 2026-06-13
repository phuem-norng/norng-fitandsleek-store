<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminPermissionService;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class CustomerAdminController extends Controller
{
    public function index(Request $request)
    {
        $orderStats = DB::table('orders')
            ->select('user_id')
            ->selectRaw('COUNT(*)::int as orders_count')
            ->selectRaw('COALESCE(SUM(total), 0) as total_spent')
            ->groupBy('user_id');

        $query = User::query()
            ->select([
                'users.id',
                'users.name',
                'users.email',
                'users.phone',
                'users.address',
                'users.profile_image_path',
                'users.created_at',
                'users.role',
                'users.status',
            ])
            ->selectRaw('COALESCE(order_stats.orders_count, 0) as orders_count')
            ->selectRaw('COALESCE(order_stats.total_spent, 0) as total_spent')
            ->selectRaw('COALESCE(loyalty_profiles.points, 0) as loyalty_points')
            ->selectRaw("COALESCE(loyalty_profiles.tier, 'bronze') as loyalty_tier")
            ->leftJoinSub($orderStats, 'order_stats', 'order_stats.user_id', '=', 'users.id')
            ->leftJoin('loyalty_profiles', 'loyalty_profiles.user_id', '=', 'users.id')
            ->where('users.role', 'customer');

        if ($request->filled('search')) {
            $search = '%'.$request->string('search')->trim().'%';
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'ilike', $search)
                    ->orWhere('users.email', 'ilike', $search)
                    ->orWhere('users.phone', 'ilike', $search);
            });
        }

        if ($request->filled('status')) {
            $status = $request->string('status')->trim()->toString();
            if (in_array($status, ['active', 'inactive', 'suspended'], true)) {
                $query->where('users.status', $status);
            }
        }

        if ($request->filled('loyalty_tier')) {
            $tier = strtolower($request->string('loyalty_tier')->trim()->toString());
            if (in_array($tier, ['bronze', 'silver', 'gold', 'vip'], true)) {
                $query->whereRaw("COALESCE(loyalty_profiles.tier, 'bronze') = ?", [$tier]);
            }
        }

        if ($request->filled('has_orders')) {
            $hasOrders = $request->string('has_orders')->trim()->toString();
            if ($hasOrders === '1') {
                $query->whereRaw('COALESCE(order_stats.orders_count, 0) > 0');
            } elseif ($hasOrders === '0') {
                $query->whereRaw('COALESCE(order_stats.orders_count, 0) = 0');
            }
        }

        $sort = $request->string('sort')->trim()->toString();
        $direction = strtolower($request->string('direction')->trim()->toString()) === 'asc' ? 'asc' : 'desc';
        match ($sort) {
            'name' => $query->orderBy('users.name', $direction),
            'joined' => $query->orderBy('users.created_at', $direction),
            'orders' => $query->orderByRaw('COALESCE(order_stats.orders_count, 0) '.$direction),
            'spent' => $query->orderByRaw('COALESCE(order_stats.total_spent, 0) '.$direction),
            'loyalty' => $query->orderByRaw('COALESCE(loyalty_profiles.points, 0) '.$direction),
            default => $query->orderByDesc('users.id'),
        };

        $perPage = min(max((int) $request->input('per_page', 15), 1), 100);

        $paginator = $query->paginate($perPage);

        $paginator->getCollection()->transform(function (User $user) {
            $user->setAppends([]);
            $user->profile_image_url = self::listProfileImageUrl($user->profile_image_path);
            $user->total_spent = round((float) ($user->total_spent ?? 0), 2);
            $user->loyalty_points = (int) ($user->loyalty_points ?? 0);
            $user->loyalty_tier = strtolower((string) ($user->loyalty_tier ?? 'bronze'));

            return $user;
        });

        return response()->json($paginator);
    }

    /**
     * Fast list avatar URL — avoids per-row Storage::exists() from User::$appends.
     */
    private static function listProfileImageUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $path = trim($path);
        if (preg_match('#^https?://#i', $path)) {
            return $path;
        }

        if (str_starts_with($path, '/storage/')) {
            return $path;
        }

        $key = Media::storageKey($path);

        return $key ? '/storage/'.$key : '/storage/'.ltrim($path, '/');
    }

    public function show(User $customer)
    {
        return response()->json($customer);
    }

    public function store(\Illuminate\Http\Request $request, AdminPermissionService $permissions)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'role' => 'nullable|in:customer,admin,driver,superadmin',
        ]);

        $role = $validated['role'] ?? 'customer';
        if (! in_array($role, ['customer', 'admin', 'driver', 'superadmin'], true)) {
            $role = 'customer';
        }

        // Only superadmin can create privileged users
        $currentUser = Auth::user();
        if ($role !== 'customer' && ! $currentUser?->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to create privileged users',
            ], 403);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'phone' => $validated['phone'] ?? null,
            'address' => $validated['address'] ?? null,
            'role' => $role,
            'status' => 'active',
        ]);

        if ($role === 'admin') {
            $permissions->applyDefaultPermissions($user);
        }

        return response()->json([
            'success' => true,
            'message' => ucfirst($role).' created successfully',
            'data' => $user->fresh(),
        ], 201);
    }

    public function update(\Illuminate\Http\Request $request, User $customer, AdminPermissionService $permissions)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'email', Rule::unique('users')->ignore($customer->id)],
            'phone' => 'nullable|string|max:20',
            'address' => 'nullable|string|max:500',
            'role' => 'nullable|in:customer,admin,driver,superadmin',
        ]);

        $currentUser = Auth::user();

        if ($request->filled('role')) {
            if (! $currentUser?->isSuperAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Only superadmins can change user roles',
                ], 403);
            }

            if ($customer->isSuperAdmin()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cannot change superadmin role',
                ], 403);
            }

            if ((int) $customer->id === (int) $currentUser->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You cannot change your own role',
                ], 403);
            }

            $permissions->applyRoleChange($customer, $validated['role']);
            unset($validated['role']);
        }

        $customer->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully',
            'data' => $customer->fresh(),
        ]);
    }

    public function destroy(User $customer)
    {
        $currentUser = Auth::user();
        $currentUserId = Auth::id();

        // Prevent deleting yourself
        if ($customer->id === $currentUserId) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot delete your own account'
            ], 403);
        }

        // Only superadmin can delete admin users
        if ($customer->role === 'admin' && $currentUser?->role !== 'superadmin') {
            return response()->json([
                'success' => false,
                'message' => 'You do not have permission to delete admin users'
            ], 403);
        }

        $customer->delete();

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully',
        ]);
    }
}
