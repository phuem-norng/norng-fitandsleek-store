<?php

return [
    'actions' => ['view', 'create', 'edit', 'delete'],

    /*
    |--------------------------------------------------------------------------
    | Resource groups shown in the superadmin permission matrix.
    |--------------------------------------------------------------------------
    */
    'groups' => [
        'sales' => [
            'label' => 'Sales',
            'resources' => [
                'orders' => ['label' => 'Orders'],
                'checkout' => ['label' => 'Checkout / POS', 'actions' => ['view', 'create', 'edit']],
                'discounts' => ['label' => 'Discounts'],
            ],
        ],
        'catalog' => [
            'label' => 'Catalog',
            'resources' => [
                'products' => ['label' => 'Products'],
                'categories' => ['label' => 'Categories'],
                'brands' => ['label' => 'Brands'],
            ],
        ],
        'inventory' => [
            'label' => 'Inventory',
            'resources' => [
                'stock' => ['label' => 'Stock & Inventory'],
                'stock_received' => ['label' => 'Stock Received', 'actions' => ['view', 'create', 'edit']],
                'purchase_orders' => ['label' => 'Purchase Orders'],
                'suppliers' => ['label' => 'Suppliers'],
            ],
        ],
        'finance' => [
            'label' => 'Finance',
            'resources' => [
                'payments' => ['label' => 'Payments', 'actions' => ['view', 'edit']],
                'sale_history' => ['label' => 'Sale History', 'actions' => ['view']],
            ],
        ],
        'ops' => [
            'label' => 'Operations',
            'resources' => [
                'reports' => ['label' => 'Reports', 'actions' => ['view']],
                'contacts' => ['label' => 'Contacts'],
                'messages' => ['label' => 'Messages'],
                'notifications' => ['label' => 'Notifications', 'actions' => ['view', 'edit', 'delete']],
            ],
        ],
        'delivery' => [
            'label' => 'Delivery',
            'resources' => [
                'shipments' => ['label' => 'Shipments'],
                'replacements' => ['label' => 'Replacement Cases'],
            ],
        ],
        'customers' => [
            'label' => 'Customers',
            'resources' => [
                'customers' => ['label' => 'Customers'],
            ],
        ],
        'settings' => [
            'label' => 'Settings',
            'resources' => [
                'general_settings' => ['label' => 'General', 'actions' => ['view', 'edit']],
                'homepage' => ['label' => 'Home Page'],
                'homepage_complete' => ['label' => 'Complete Manager', 'actions' => ['view', 'edit']],
                'profile' => ['label' => 'My Profile', 'actions' => ['view', 'edit']],
                'chatbot' => ['label' => 'Chatbot Content', 'actions' => ['view', 'edit']],
            ],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Default operational permissions for newly created admin accounts.
    |--------------------------------------------------------------------------
    */
    'defaults' => [
        'orders.view' => true,
        'orders.edit' => true,
        'orders.delete' => true,
        'checkout.view' => true,
        'checkout.create' => true,
        'checkout.edit' => true,
        'discounts.view' => true,
        'discounts.create' => true,
        'discounts.edit' => true,
        'discounts.delete' => true,
        'products.view' => true,
        'products.create' => true,
        'products.edit' => true,
        'products.delete' => true,
        'categories.view' => true,
        'categories.create' => true,
        'categories.edit' => true,
        'categories.delete' => true,
        'brands.view' => true,
        'brands.create' => true,
        'brands.edit' => true,
        'brands.delete' => true,
        'stock.view' => true,
        'stock.create' => true,
        'stock.edit' => true,
        'stock.delete' => true,
        'stock_received.view' => true,
        'stock_received.create' => true,
        'stock_received.edit' => true,
        'purchase_orders.view' => true,
        'purchase_orders.create' => true,
        'purchase_orders.edit' => true,
        'suppliers.view' => true,
        'payments.view' => true,
        'payments.edit' => true,
        'sale_history.view' => true,
        'reports.view' => true,
        'contacts.view' => true,
        'contacts.create' => true,
        'contacts.edit' => true,
        'contacts.delete' => true,
        'messages.view' => true,
        'messages.create' => true,
        'messages.edit' => true,
        'messages.delete' => true,
        'notifications.view' => true,
        'notifications.edit' => true,
        'notifications.delete' => true,
        'shipments.view' => true,
        'shipments.create' => true,
        'shipments.edit' => true,
        'replacements.view' => true,
        'replacements.create' => true,
        'replacements.edit' => true,
        'customers.view' => true,
        'customers.create' => true,
        'customers.edit' => true,
        'customers.delete' => true,
        'profile.view' => true,
        'profile.edit' => true,
        'chatbot.view' => true,
        'chatbot.edit' => true,
        'general_settings.view' => false,
        'general_settings.edit' => false,
        'homepage.view' => false,
        'homepage.create' => false,
        'homepage.edit' => false,
        'homepage.delete' => false,
        'homepage_complete.view' => false,
        'homepage_complete.edit' => false,
    ],

    /*
    |--------------------------------------------------------------------------
    | Routes that every admin may access regardless of resource toggles.
    |--------------------------------------------------------------------------
    */
    'always_allowed_prefixes' => [
        'admin/nav-badges',
        'admin/ui-preferences',
        'admin/search',
        'admin/ai/chat',
    ],

    /*
    |--------------------------------------------------------------------------
    | Superadmin-only route prefixes (never grantable to admin role).
    |--------------------------------------------------------------------------
    */
    'superadmin_only_prefixes' => [
        'admin/superadmin',
        'admin/menus',
        'admin/footer-header',
        'admin/footer',
        'admin/header',
        'admin/social',
        'admin/loyalty/rules',
        'admin/loyalty/top-fans',
        'admin/payment-settings',
    ],

    /*
    |--------------------------------------------------------------------------
    | Map admin API path prefix (without "api/") to permission resource key.
    | Longest matching prefix wins.
    |--------------------------------------------------------------------------
    */
    'resource_prefixes' => [
        'admin/orders' => 'orders',
        'admin/pos' => 'checkout',
        'admin/barcode-scan' => 'checkout',
        'admin/discounts' => 'discounts',
        'admin/products' => 'products',
        'admin/categories' => 'categories',
        'admin/brands' => 'brands',
        'admin/stock-inventory' => 'stock',
        'admin/inventory-lots' => 'stock',
        'admin/stock-received' => 'stock_received',
        'admin/purchase-orders' => 'purchase_orders',
        'admin/suppliers' => 'suppliers',
        'admin/payments' => 'payments',
        'admin/reports' => 'reports',
        'admin/exports' => 'reports',
        'admin/contacts' => 'contacts',
        'admin/messages' => 'messages',
        'admin/notifications' => 'notifications',
        'admin/shipments' => 'shipments',
        'admin/delivery-fees' => 'shipments',
        'admin/replacement-cases' => 'replacements',
        'admin/customers' => 'customers',
        'admin/users' => 'customers',
        'admin/chatbot' => 'chatbot',
        'admin/profile' => 'profile',
        'admin/settings' => 'general_settings',
        'admin/banners' => 'homepage',
        'admin/collections' => 'homepage',
        'admin/homepage-settings' => 'homepage_complete',
        'admin/homepage' => 'homepage',
    ],

    /*
    |--------------------------------------------------------------------------
    | Explicit route overrides: path pattern => [resource, action]
    |--------------------------------------------------------------------------
    */
    'route_overrides' => [
        'admin/payments/*/verify' => ['payments', 'edit'],
        'admin/payments/*/reject' => ['payments', 'edit'],
        'admin/products/gallery-upload' => ['products', 'create'],
        'admin/categories/image-upload' => ['categories', 'create'],
        'admin/barcode-scan/lookup' => ['checkout', 'view'],
        'admin/barcode-scan/sale' => ['checkout', 'create'],
        'admin/pos/complete-sale' => ['checkout', 'create'],
        'admin/pos/draft-order' => ['checkout', 'create'],
        'admin/pos/sale-history' => ['sale_history', 'view'],
        'admin/discounts/bulk-toggle' => ['discounts', 'edit'],
        'admin/contacts/bulk-update' => ['contacts', 'edit'],
        'admin/contacts/bulk-delete' => ['contacts', 'delete'],
        'admin/notifications/mark-all-read' => ['notifications', 'edit'],
        'admin/notifications/*/read' => ['notifications', 'edit'],
        'admin/replacement-cases/*/approve' => ['replacements', 'edit'],
        'admin/replacement-cases/*/reject' => ['replacements', 'edit'],
        'admin/replacement-cases/*/complete' => ['replacements', 'edit'],
        'admin/messages/*/toggle-active' => ['messages', 'edit'],
        'admin/purchase-orders/*/status' => ['purchase_orders', 'edit'],
        'admin/inventory-lots/catalog' => ['stock', 'view'],
        'admin/inventory-lots/*/mark-clearance' => ['stock', 'edit'],
        'admin/inventory-lots/*/on-hold' => ['stock', 'edit'],
        'admin/inventory-lots/*/release-hold' => ['stock', 'edit'],
        'admin/inventory-lots/*' => ['stock', 'edit'],
        'admin/categories/*/quick-restock' => ['stock_received', 'create'],
        'admin/profile/upload-image' => ['profile', 'edit'],
        'admin/profile/password' => ['profile', 'edit'],
        'admin/users/*/password' => ['customers', 'edit'],
        'admin/settings/bulk' => ['general_settings', 'edit'],
        'admin/banners/*' => ['homepage', 'edit'],
        'admin/collections/*' => ['homepage', 'edit'],
        'admin/homepage-settings/logo-upload' => ['homepage_complete', 'edit'],
        'admin/homepage-settings/chrome-background-upload' => ['homepage_complete', 'edit'],
        'admin/homepage-settings/menu-image-upload' => ['homepage_complete', 'edit'],
        'admin/homepage-settings/save-all' => ['homepage_complete', 'edit'],
    ],
];
