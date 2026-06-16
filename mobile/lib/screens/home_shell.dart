import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/header_settings.dart';
import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/cart_service.dart';
import '../services/notification_service.dart';
import '../services/product_service.dart';
import '../services/storefront_service.dart';
import '../theme/app_colors.dart';
import '../l10n/app_strings.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/navigation/mobile_bottom_nav.dart';
import '../widgets/navigation/notifications_sheet.dart';
import 'image_search_screen.dart';
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
  HeaderSettings _headerSettings = const HeaderSettings();
  final _searchController = TextEditingController();
  final _homeShopKey = GlobalKey<ShopScreenState>();
  final _catalogShopKey = GlobalKey<ShopScreenState>();

  int _cartBadge = 0;
  int _notificationBadge = 0;
  int _wishlistBadge = 0;

  int get _pageIndex => _nav.index;

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
    final wishlist = context.read<WishlistProvider>();

    var cartCount = 0;
    var notifCount = 0;

    notifCount = await notificationService.fetchUnreadCount(isLoggedIn: auth.isLoggedIn);

    if (auth.isLoggedIn) {
      try {
        final cart = await cartService.getCart();
        cartCount = cart.items.fold<int>(0, (sum, i) => sum + i.quantity);
      } catch (_) {}
      try {
        await wishlist.load();
      } catch (_) {}
    }

    if (!mounted) return;
    setState(() {
      _cartBadge = cartCount;
      _notificationBadge = notifCount;
      _wishlistBadge = wishlist.count;
    });
  }

  void _runShopSearch() {
    final key = _nav == MobileNavItem.shop ? _catalogShopKey : _homeShopKey;
    key.currentState?.reloadProducts();
  }

  Future<void> _openNotifications() async {
    await showNotificationsSheet(context);
    if (!mounted) return;
    await _refreshBadges();
  }

  void _onNavSelect(MobileNavItem item) {
    setState(() => _nav = item);
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
        isHomeTab: true,
      ),
      ShopScreen(
        key: _catalogShopKey,
        productService: productService,
        apiClient: apiClient,
        searchController: _searchController,
        showBanner: false,
        isHomeTab: false,
      ),
      const CartScreen(),
      const WishlistScreen(),
      const ProfileScreen(),
    ];

    final showHomeHeader = _nav == MobileNavItem.home || _nav == MobileNavItem.shop;
    final showWishlistHeader = _nav == MobileNavItem.wishlist;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          if (showHomeHeader)
            HomeStoreHeader(
              settings: _headerSettings,
              searchController: _searchController,
              onSearch: _runShopSearch,
              onCameraTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const ImageSearchScreen()),
                );
              },
              onNotificationsTap: _openNotifications,
              onCartTap: () => _onNavSelect(MobileNavItem.cart),
              cartBadge: _cartBadge,
              notificationBadge: _notificationBadge,
            )
          else if (showWishlistHeader)
            const InnerPageHeader(
              title: AppStrings.wishlistTitle,
              leadingIcon: Icons.favorite_border,
            ),
          Expanded(child: IndexedStack(index: _pageIndex, children: pages)),
        ],
      ),
      bottomNavigationBar: MobileBottomNav(
        selected: _nav,
        cartBadge: _cartBadge,
        wishlistBadge: _wishlistBadge,
        onSelect: _onNavSelect,
      ),
    );
  }
}
