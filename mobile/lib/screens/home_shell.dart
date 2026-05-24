import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/header_settings.dart';
import '../providers/auth_provider.dart';
import '../services/cart_service.dart';
import '../services/notification_service.dart';
import '../services/product_service.dart';
import '../services/storefront_service.dart';
import '../services/wishlist_service.dart';
import '../theme/app_colors.dart';
import '../widgets/mobile_store_header.dart';
import '../widgets/navigation/mobile_bottom_nav.dart';
import '../widgets/navigation/notifications_sheet.dart';
import 'cart_screen.dart';
import 'profile_screen.dart';
import 'shop_screen.dart';
import 'wishlist_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  MobileNavItem _nav = MobileNavItem.home;
  bool _notificationsOpen = false;
  HeaderSettings _headerSettings = const HeaderSettings();
  final _searchController = TextEditingController();
  final _homeShopKey = GlobalKey<ShopScreenState>();
  final _catalogShopKey = GlobalKey<ShopScreenState>();

  int _cartBadge = 0;
  int _notificationBadge = 0;
  int _wishlistBadge = 0;

  int get _pageIndex => switch (_nav) {
        MobileNavItem.home => 0,
        MobileNavItem.shop => 1,
        MobileNavItem.cart => 2,
        MobileNavItem.wishlist => 3,
        MobileNavItem.account => 4,
        MobileNavItem.notifications => 0,
      };

  String? get _headerTitle => switch (_nav) {
        MobileNavItem.home || MobileNavItem.shop => null,
        MobileNavItem.cart => 'Cart',
        MobileNavItem.wishlist => 'Wishlist',
        MobileNavItem.account => 'Account',
        MobileNavItem.notifications => null,
      };

  bool get _showHeaderSearch =>
      _nav == MobileNavItem.home || _nav == MobileNavItem.shop;

  @override
  void initState() {
    super.initState();
    _loadHeaderSettings();
    _refreshBadges();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadHeaderSettings() async {
    final settings = await StorefrontService(context.read<ApiClient>()).fetchHeaderSettings();
    if (!mounted) return;
    setState(() => _headerSettings = settings);
  }

  Future<void> _refreshBadges() async {
    final auth = context.read<AuthProvider>();
    final api = context.read<ApiClient>();
    final cartService = context.read<CartService>();
    final notificationService = NotificationService(api);
    final wishlistService = WishlistService(api);

    var cartCount = 0;
    var notifCount = 0;
    var wishCount = 0;

    notifCount = await notificationService.fetchUnreadCount(isLoggedIn: auth.isLoggedIn);

    if (auth.isLoggedIn) {
      try {
        final cart = await cartService.getCart();
        cartCount = cart.items.fold<int>(0, (sum, i) => sum + i.quantity);
      } catch (_) {}
      try {
        final wish = await wishlistService.fetchWishlist();
        wishCount = wish.count;
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _cartBadge = cartCount;
      _notificationBadge = notifCount;
      _wishlistBadge = wishCount;
    });
  }

  void _runShopSearch() {
    final key = _nav == MobileNavItem.shop ? _catalogShopKey : _homeShopKey;
    key.currentState?.reloadProducts();
  }

  Future<void> _openNotifications() async {
    setState(() => _notificationsOpen = true);
    await showNotificationsSheet(context);
    if (!mounted) return;
    setState(() => _notificationsOpen = false);
    await _refreshBadges();
  }

  void _onNavSelect(MobileNavItem item) {
    if (item == MobileNavItem.notifications) {
      _openNotifications();
      return;
    }
    setState(() {
      _notificationsOpen = false;
      _nav = item;
    });
    _refreshBadges();
  }

  @override
  Widget build(BuildContext context) {
    final productService = context.read<ProductService>();
    final apiClient = context.read<ApiClient>();

    final pages = [
      ShopScreen(
        key: _homeShopKey,
        productService: productService,
        apiClient: apiClient,
        searchController: _searchController,
        showBanner: true,
      ),
      ShopScreen(
        key: _catalogShopKey,
        productService: productService,
        apiClient: apiClient,
        searchController: _searchController,
        showBanner: false,
      ),
      const CartScreen(),
      const WishlistScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          MobileStoreHeader(
            settings: _headerSettings,
            showSearch: _showHeaderSearch,
            searchController: _searchController,
            onSearch: _runShopSearch,
            onSearchTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Image search — use the web store for now')),
              );
            },
            pageTitle: _headerTitle,
          ),
          Expanded(child: IndexedStack(index: _pageIndex, children: pages)),
        ],
      ),
      bottomNavigationBar: MobileBottomNav(
        selected: _nav,
        notificationsActive: _notificationsOpen,
        cartBadge: _cartBadge,
        notificationBadge: _notificationBadge,
        wishlistBadge: _wishlistBadge,
        onSelect: _onNavSelect,
      ),
    );
  }
}
