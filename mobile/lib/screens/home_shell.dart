import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/homepage_section.dart';
import '../models/header_settings.dart';
import '../navigation/open_cart_screen.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/notification_service.dart';
import '../services/product_service.dart';
import '../services/storefront_service.dart';
import '../providers/app_settings_provider.dart';
import '../l10n/l10n_extension.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/navigation/mobile_bottom_nav.dart';
import '../widgets/navigation/notifications_sheet.dart';
import 'profile_screen.dart';
import 'search_tab_screen.dart';
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
  final _homeShopKey = GlobalKey<ShopScreenState>();
  final _catalogShopKey = GlobalKey<ShopScreenState>();
  final _searchTabKey = GlobalKey<SearchTabScreenState>();

  int _cartBadge = 0;
  int _notificationBadge = 0;
  int _wishlistBadge = 0;
  CartProvider? _cartProvider;
  WishlistProvider? _wishlistProvider;

  int get _pageIndex => _nav.index;

  @override
  void initState() {
    super.initState();
    _loadHeaderSettings();
    _refreshBadges();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _cartProvider = context.read<CartProvider>();
      _wishlistProvider = context.read<WishlistProvider>();
      _cartProvider!.addListener(_syncBadgesFromProviders);
      _wishlistProvider!.addListener(_syncBadgesFromProviders);
    });
  }

  @override
  void dispose() {
    _cartProvider?.removeListener(_syncBadgesFromProviders);
    _wishlistProvider?.removeListener(_syncBadgesFromProviders);
    super.dispose();
  }

  void _syncBadgesFromProviders() {
    if (!mounted || _cartProvider == null || _wishlistProvider == null) return;
    setState(() {
      _cartBadge = _cartProvider!.count;
      _wishlistBadge = _wishlistProvider!.count;
    });
  }

  Future<void> _loadHeaderSettings() async {
    final settings = await StorefrontService(context.read<ApiClient>()).fetchHeaderSettings();
    if (!mounted) return;
    setState(() => _headerSettings = settings);
  }

  Future<void> _refreshBadges() async {
    final auth = context.read<AuthProvider>();
    final api = context.read<ApiClient>();
    final notificationService = NotificationService(api);
    final wishlist = context.read<WishlistProvider>();
    final cart = context.read<CartProvider>();

    var notifCount = 0;

    notifCount = await notificationService.fetchUnreadCount(isLoggedIn: auth.isLoggedIn);

    await Future.wait([
      wishlist.load(isLoggedIn: auth.isLoggedIn),
      cart.load(isLoggedIn: auth.isLoggedIn),
    ]);

    if (!mounted) return;
    setState(() {
      _cartBadge = cart.count;
      _notificationBadge = notifCount;
      _wishlistBadge = wishlist.count;
    });
  }

  void _openSectionInShop(HomeSectionBrowse browse) {
    setState(() => _nav = MobileNavItem.shop);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _catalogShopKey.currentState?.applySectionBrowse(browse);
    });
  }

  void _openBrandInShop(int? brandId) {
    setState(() => _nav = MobileNavItem.shop);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _catalogShopKey.currentState?.selectBrand(brandId);
    });
  }

  Future<void> _openNotifications() async {
    await showNotificationsSheet(context);
    if (!mounted) return;
    await _refreshBadges();
  }

  void _openCart() => openCartScreen(context);

  void _openWishlistFromProfile() {
    setState(() => _nav = MobileNavItem.wishlist);
  }

  void _onNavSelect(MobileNavItem item) {
    if (_nav == MobileNavItem.search && item != MobileNavItem.search) {
      _searchTabKey.currentState?.unfocusSearch();
    }
    setState(() => _nav = item);
    _refreshBadges();
    if (item == MobileNavItem.search) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _searchTabKey.currentState?.unfocusSearch();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<AppSettingsProvider>();
    final l10n = context.l10n;
    final productService = context.read<ProductService>();
    final apiClient = context.read<ApiClient>();

    final pages = [
      ShopScreen(
        key: _homeShopKey,
        productService: productService,
        apiClient: apiClient,
        showBanner: true,
        isHomeTab: true,
        onSectionSeeAll: _openSectionInShop,
        onBrandBrowse: _openBrandInShop,
      ),
      SearchTabScreen(
        key: _searchTabKey,
        productService: productService,
        apiClient: apiClient,
      ),
      ShopScreen(
        key: _catalogShopKey,
        productService: productService,
        apiClient: apiClient,
        showBanner: false,
        isHomeTab: false,
      ),
      const WishlistScreen(),
      ProfileScreen(onWishlistTap: _openWishlistFromProfile),
    ];

    final showHomeHeader = _nav == MobileNavItem.home || _nav == MobileNavItem.shop;
    final showWishlistHeader = _nav == MobileNavItem.wishlist;
    final showSearchHeader = _nav == MobileNavItem.search;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Column(
        children: [
          if (showHomeHeader)
            HomeStoreHeader(
              settings: _headerSettings,
              onNotificationsTap: _openNotifications,
              onCartTap: _openCart,
              cartBadge: _cartBadge,
              notificationBadge: _notificationBadge,
            )
          else if (showWishlistHeader)
            InnerPageHeader(
              title: l10n.wishlistTitle,
              leadingIcon: Icons.favorite_border,
              onCartTap: _openCart,
              cartBadge: _cartBadge,
            )
          else if (showSearchHeader)
            InnerPageHeader(
              title: l10n.navSearch,
              leadingIcon: Icons.search_rounded,
              onCartTap: _openCart,
              cartBadge: _cartBadge,
            ),
          Expanded(child: IndexedStack(index: _pageIndex, children: pages)),
        ],
      ),
      bottomNavigationBar: MobileBottomNav(
        selected: _nav,
        wishlistBadge: _wishlistBadge,
        onSelect: _onNavSelect,
      ),
    );
  }
}
