<?php

namespace App\Services;

use App\Models\Category;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminPermissionService
{
    /** @var array<string, bool>|null */
    private ?array $allTrueCache = null;

    public function actions(): array
    {
        return config('admin_permissions.actions', ['view', 'create', 'edit', 'delete']);
    }

    public function groups(): array
    {
        return config('admin_permissions.groups', []);
    }

    public function defaultPermissions(): array
    {
        return config('admin_permissions.defaults', []);
    }

    public function resourceActions(string $resourceKey, ?array $meta = null): array
    {
        if ($meta === null) {
            foreach ($this->groups() as $group) {
                if (isset($group['resources'][$resourceKey])) {
                    $meta = $group['resources'][$resourceKey];
                    break;
                }
            }
        }

        if (is_array($meta['actions'] ?? null) && $meta['actions'] !== []) {
            return array_values(array_intersect($this->actions(), $meta['actions']));
        }

        return $this->actions();
    }

    public function allPermissionKeys(): array
    {
        $keys = [];
        foreach ($this->groups() as $group) {
            foreach ($group['resources'] ?? [] as $resource => $meta) {
                foreach ($this->resourceActions($resource, $meta) as $action) {
                    $keys[] = $this->key($resource, $action);
                }
            }
        }

        return array_values(array_unique($keys));
    }

    public function allTrueMap(): array
    {
        if ($this->allTrueCache !== null) {
            return $this->allTrueCache;
        }

        $map = [];
        foreach ($this->allPermissionKeys() as $key) {
            $map[$key] = true;
        }

        return $this->allTrueCache = $map;
    }

    public function key(string $resource, string $action): string
    {
        return "{$resource}.{$action}";
    }

    public function getEffectivePermissions(User $user): array
    {
        if ($user->isSuperAdmin()) {
            return $this->allTrueMap();
        }

        if ($user->role !== 'admin') {
            return [];
        }

        $defaults = $this->defaultPermissions();
        $stored = is_array($user->admin_permissions) ? $user->admin_permissions : [];

        $effective = [];
        foreach ($this->allPermissionKeys() as $permissionKey) {
            if (array_key_exists($permissionKey, $stored)) {
                $effective[$permissionKey] = (bool) $stored[$permissionKey];
            } else {
                $effective[$permissionKey] = (bool) ($defaults[$permissionKey] ?? false);
            }
        }

        return $effective;
    }

    public function has(User $user, string $resource, string $action = 'view'): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($user->role !== 'admin') {
            return false;
        }

        $permissions = $this->getEffectivePermissions($user);

        if ($this->permissionGranted($permissions, $resource, $action)) {
            return true;
        }

        // POS / checkout writes only: accept edit when create is required.
        if (
            $resource === 'checkout'
            && $action === 'create'
            && $this->permissionGranted($permissions, $resource, 'edit')
        ) {
            return true;
        }

        return false;
    }

    private function permissionGranted(array $permissions, string $resource, string $action): bool
    {
        return (bool) ($permissions[$this->key($resource, $action)] ?? false);
    }

    public function authorizeRequest(User $user, Request $request): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        if ($user->role !== 'admin') {
            return false;
        }

        $relativePath = $this->normalizeAdminPath($request->path());

        foreach (config('admin_permissions.always_allowed_prefixes', []) as $prefix) {
            if ($this->pathStartsWith($relativePath, $prefix)) {
                return true;
            }
        }

        foreach (config('admin_permissions.superadmin_only_prefixes', []) as $prefix) {
            if ($this->pathStartsWith($relativePath, $prefix)) {
                return false;
            }
        }

        [$resource, $action] = $this->resolveRoutePermission($relativePath, $request);

        if ($resource === null) {
            // Unknown admin route — allow to avoid breaking ancillary endpoints.
            return true;
        }

        $stockRemapped = $this->remapStockLabelCategoryPermission($relativePath, $request, $resource, $action);
        if ($stockRemapped !== null) {
            [$resource, $action] = $stockRemapped;
        }

        // Product gallery upload is used during both create and edit flows.
        if ($resource === 'products' && Str::is('admin/products/gallery-upload', $relativePath)) {
            return $this->has($user, 'products', 'create') || $this->has($user, 'products', 'edit');
        }

        // Category / stock label image upload during create or edit flows.
        if ($resource === 'categories' && Str::is('admin/categories/image-upload', $relativePath)) {
            return $this->has($user, 'categories', 'create')
                || $this->has($user, 'categories', 'edit')
                || $this->has($user, 'stock', 'create')
                || $this->has($user, 'stock', 'edit');
        }

        // Stock Received reads PO detail when expanding rows or opening the drawer.
        if (
            $request->isMethod('GET')
            && Str::is('admin/purchase-orders/*', $relativePath)
            && ! Str::is('admin/purchase-orders/*/status', $relativePath)
        ) {
            return $this->has($user, 'purchase_orders', 'view')
                || $this->has($user, 'stock_received', 'view');
        }

        // Mark pending/received from Stock Received or Purchase Orders.
        if (Str::is('admin/purchase-orders/*/status', $relativePath)) {
            return $this->has($user, 'purchase_orders', 'edit')
                || $this->has($user, 'stock_received', 'edit')
                || $this->has($user, 'stock_received', 'create');
        }

        // Stock label forms read catalog index lists without full catalog admin access.
        if ($request->isMethod('GET') && $relativePath === 'admin/products') {
            return $this->has($user, 'products', 'view')
                || $this->has($user, 'stock', 'view')
                || $this->has($user, 'purchase_orders', 'view')
                || $this->has($user, 'purchase_orders', 'create');
        }
        if ($request->isMethod('GET') && $relativePath === 'admin/brands') {
            return $this->has($user, 'brands', 'view') || $this->has($user, 'stock', 'view');
        }
        if ($request->isMethod('GET') && $relativePath === 'admin/suppliers') {
            return $this->has($user, 'suppliers', 'view')
                || $this->has($user, 'stock', 'view')
                || $this->has($user, 'purchase_orders', 'view')
                || $this->has($user, 'purchase_orders', 'create');
        }

        // Generic table exports (stock, orders, invoices) — not Reports module create.
        if (Str::is('admin/exports/table', $relativePath)) {
            return $this->has($user, 'reports', 'view')
                || $this->has($user, 'stock', 'view')
                || $this->has($user, 'stock_received', 'view')
                || $this->has($user, 'orders', 'view')
                || $this->has($user, 'products', 'view');
        }

        return $this->has($user, $resource, $action);
    }

    /**
     * @return array{0: string|null, 1: string}
     */
    public function resolveRoutePermission(string $relativePath, Request $request): array
    {
        foreach (config('admin_permissions.route_overrides', []) as $pattern => $pair) {
            if (Str::is($pattern, $relativePath)) {
                return [$pair[0], $pair[1]];
            }
        }

        $resource = $this->matchResourcePrefix($relativePath);
        if ($resource === null) {
            return [null, 'view'];
        }

        return [$resource, $this->actionFromMethod($request->method())];
    }

    public function matchResourcePrefix(string $relativePath): ?string
    {
        $prefixes = config('admin_permissions.resource_prefixes', []);
        uksort($prefixes, static fn (string $a, string $b) => strlen($b) <=> strlen($a));

        foreach ($prefixes as $prefix => $resource) {
            if ($this->pathStartsWith($relativePath, $prefix)) {
                return $resource;
            }
        }

        return null;
    }

    public function actionFromMethod(string $method): string
    {
        return match (strtoupper($method)) {
            'GET', 'HEAD' => 'view',
            'POST' => 'create',
            'PUT', 'PATCH' => 'edit',
            'DELETE' => 'delete',
            default => 'view',
        };
    }

    public function buildMatrixPayload(User $user): array
    {
        $permissions = $this->getEffectivePermissions($user);
        $groups = [];

        foreach ($this->groups() as $groupKey => $group) {
            $resources = [];
            foreach ($group['resources'] ?? [] as $resourceKey => $meta) {
                $resourceActionList = $this->resourceActions($resourceKey, $meta);
                $actions = [];
                foreach ($this->actions() as $action) {
                    if (! in_array($action, $resourceActionList, true)) {
                        $actions[$action] = null;
                        continue;
                    }
                    $permissionKey = $this->key($resourceKey, $action);
                    $actions[$action] = (bool) ($permissions[$permissionKey] ?? false);
                }
                $resources[] = [
                    'key' => $resourceKey,
                    'label' => $meta['label'] ?? $resourceKey,
                    'actions' => $actions,
                    'action_list' => $resourceActionList,
                ];
            }

            $groups[] = [
                'key' => $groupKey,
                'label' => $group['label'] ?? $groupKey,
                'resources' => $resources,
            ];
        }

        return [
            'user_id' => $user->id,
            'role' => $user->role,
            'permissions' => $permissions,
            'defaults' => $this->defaultPermissions(),
            'groups' => $groups,
            'actions' => $this->actions(),
        ];
    }

    /**
     * @param  array<string, bool|int|string>  $input
     */
    public function updatePermissions(User $user, array $input): void
    {
        if ($user->isSuperAdmin()) {
            throw new \InvalidArgumentException('Cannot modify superadmin permissions.');
        }

        if ($user->role !== 'admin') {
            throw new \InvalidArgumentException('Permissions apply to admin accounts only.');
        }

        $effective = $this->getEffectivePermissions($user);

        foreach ($this->allPermissionKeys() as $permissionKey) {
            if (array_key_exists($permissionKey, $input)) {
                $effective[$permissionKey] = $this->toBool($input[$permissionKey]);
            }
        }

        $user->admin_permissions = $effective;
        $user->save();
    }

    public function applyDefaultPermissions(User $user): void
    {
        if ($user->role !== 'admin') {
            return;
        }

        $user->admin_permissions = null;
        $user->save();
    }

    public function applyRoleChange(User $user, string $newRole): void
    {
        $newRole = strtolower(trim($newRole));
        $previousRole = (string) $user->role;

        if ($previousRole === $newRole) {
            return;
        }

        $user->role = $newRole;

        if ($newRole === 'admin') {
            if ($previousRole !== 'admin') {
                $user->admin_permissions = null;
            }
        } else {
            $user->admin_permissions = null;
        }

        $user->save();

        if ($newRole === 'admin' && $previousRole !== 'admin') {
            $this->applyDefaultPermissions($user->fresh());
        }
    }

    /**
     * Stock labels are categories with type barcode_qr; map their CRUD to stock permissions.
     *
     * @return array{0: string, 1: string}|null
     */
    private function remapStockLabelCategoryPermission(
        string $relativePath,
        Request $request,
        string $resource,
        string $action,
    ): ?array {
        if ($resource !== 'categories') {
            return null;
        }

        if ($relativePath === 'admin/categories' && $request->isMethod('GET') && $request->boolean('include_stock_labels')) {
            return ['stock', 'view'];
        }

        if ($relativePath === 'admin/categories' && $request->isMethod('POST') && $this->requestIsStockLabelCategory($request)) {
            return ['stock', 'create'];
        }

        if (preg_match('#^admin/categories/(\d+)$#', $relativePath, $matches)) {
            $category = Category::query()->find((int) $matches[1]);
            if ($category !== null && $this->isStockLabelCategory($category)) {
                return ['stock', $action];
            }
        }

        return null;
    }

    private function requestIsStockLabelCategory(Request $request): bool
    {
        $type = strtolower(trim((string) $request->input('type', '')));

        return $type === Category::STOCK_INVENTORY_TYPE;
    }

    private function isStockLabelCategory(Category $category): bool
    {
        return strtolower((string) $category->type) === Category::STOCK_INVENTORY_TYPE;
    }

    private function normalizeAdminPath(string $path): string
    {
        $path = trim($path, '/');
        if (Str::startsWith($path, 'api/')) {
            $path = substr($path, 4);
        }

        return $path;
    }

    private function pathStartsWith(string $path, string $prefix): bool
    {
        $prefix = trim($prefix, '/');
        if ($path === $prefix) {
            return true;
        }

        return Str::startsWith($path, $prefix.'/');
    }

    private function toBool(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return (int) $value !== 0;
        }

        if (is_string($value)) {
            $normalized = strtolower(trim($value));

            return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
        }

        return (bool) $value;
    }
}
