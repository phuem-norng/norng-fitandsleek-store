import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../models/loyalty_model.dart';
import '../navigation/open_cart_screen.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/wishlist_provider.dart';
import '../models/order_model.dart';
import '../services/customer_account_service.dart';
import '../services/order_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/profile/guest_account_panel.dart';
import '../widgets/profile/settings_tile.dart';
import 'account_help_screen.dart';
import 'account_settings_screen.dart';
import 'admin/admin_dashboard_screen.dart';
import 'admin/admin_pos_screen.dart';
import 'admin/admin_products_screen.dart';
import 'admin/admin_profile_edit_screen.dart';
import 'admin/admin_reports_screen.dart';
import 'loyalty_screen.dart';
import 'orders_screen.dart';
import 'replacements_screen.dart';
import '../widgets/navigation/notifications_sheet.dart';
import '../widgets/product_image.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.onWishlistTap});

  final VoidCallback? onWishlistTap;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  int _orderCount = 0;
  LoyaltyModel? _loyalty;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) return;
    try {
      final results = await Future.wait([
        context.read<OrderService>().listOrders(page: 1),
        context.read<CustomerAccountService>().getLoyalty(),
      ]);
      if (!mounted) return;
      final orders = results[0] as OrderPage;
      setState(() {
        _orderCount = orders.items.length;
        _loyalty = results[1] as LoyaltyModel;
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final auth = context.watch<AuthProvider>();
    final wishlist = context.watch<WishlistProvider>();

    if (!auth.isLoggedIn) {
      return Column(
        children: [
          InnerPageHeader(
            title: l10n.accountTitle,
            leadingIcon: Icons.person_outline,
            onCartTap: () => openCartScreen(context),
            cartBadge: context.watch<CartProvider>().count,
          ),
          const Expanded(child: GuestAccountPanel()),
        ],
      );
    }

    final user = auth.user!;

    return Column(
      children: [
        _ProfileSageHeader(
          name: user.name,
          email: user.email,
          phone: user.phone,
          imageUrl: user.profileImageUrl,
        ),
        Transform.translate(
          offset: const Offset(0, -28),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: _StatsCard(
              orders: _orderCount,
              wishlist: wishlist.count,
              loyaltyPoints: _loyalty?.points ?? 0,
              loyaltyTier: _loyalty?.tier,
            ),
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadStats,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                if (_loyalty != null) ...[
                  _LoyaltyBanner(loyalty: _loyalty!),
                  const SizedBox(height: 12),
                ],
                if (user.isAdmin) ...[
                  Text('Admin', style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 8),
                  SettingsTile(
                    icon: Icons.dashboard_outlined,
                    title: 'Dashboard',
                    subtitle: 'Revenue, orders, inventory',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => Scaffold(
                          appBar: AppBar(title: const Text('Admin dashboard')),
                          body: const AdminDashboardScreen(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SettingsTile(
                    icon: Icons.inventory_2_outlined,
                    title: 'Products',
                    subtitle: 'View and edit catalog',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const AdminProductsScreen()),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SettingsTile(
                    icon: Icons.point_of_sale_outlined,
                    title: 'POS',
                    subtitle: 'In-store sales',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const AdminPosScreen()),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SettingsTile(
                    icon: Icons.bar_chart_outlined,
                    title: 'Reports',
                    subtitle: 'Sales trends',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const AdminReportsScreen()),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SettingsTile(
                    icon: Icons.admin_panel_settings_outlined,
                    title: 'Admin profile',
                    subtitle: 'Contact details',
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => AdminProfileEditScreen(user: user)),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                SettingsTile(
                  icon: Icons.shopping_bag_outlined,
                  title: l10n.menuOrders,
                  onTap: user.isCustomer
                      ? () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const OrdersScreen()),
                          )
                      : null,
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.local_shipping_outlined,
                  title: l10n.menuTrackDelivery,
                  onTap: user.isCustomer
                      ? () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const OrdersScreen(showTrackingHint: true)),
                          )
                      : null,
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.favorite_border,
                  title: l10n.menuWishlist,
                  onTap: widget.onWishlistTap,
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.workspace_premium_outlined,
                  title: l10n.menuLoyalty,
                  subtitle: _loyalty != null ? '${_loyalty!.points} pts · ${_loyalty!.tier.toUpperCase()}' : null,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const LoyaltyScreen()),
                  ),
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.sync_alt_rounded,
                  title: l10n.menuReplacements,
                  onTap: user.isCustomer
                      ? () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const ReplacementsScreen()),
                          )
                      : null,
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.notifications_outlined,
                  title: l10n.menuNotifications,
                  onTap: () => showNotificationsSheet(context),
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.settings_outlined,
                  title: l10n.menuSettings,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AccountSettingsScreen()),
                  ),
                ),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.help_outline,
                  title: l10n.menuHelp,
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const AccountHelpScreen()),
                  ),
                ),
                const SizedBox(height: 16),
                Material(
                  color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: auth.busy
                        ? null
                        : () async {
                            await auth.logout();
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text(l10n.signedOut)),
                              );
                            }
                          },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.error.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.logout, color: AppColors.error, size: 20),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Text(
                              l10n.signOut,
                              style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.error),
                            ),
                          ),
                          const Icon(Icons.chevron_right, color: AppColors.error),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _LoyaltyBanner extends StatelessWidget {
  const _LoyaltyBanner({required this.loyalty});

  final LoyaltyModel loyalty;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Material(
      color: AppColors.storeHeader.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const LoyaltyScreen()),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              const Icon(Icons.workspace_premium_outlined, color: AppColors.storeHeader),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.loyaltyTierLabel(loyalty.tier),
                      style: TextStyle(fontWeight: FontWeight.w700, color: onSurface),
                    ),
                    Text(
                      l10n.loyaltyDiscount(loyalty.discountPercent),
                      style: TextStyle(color: onSurface.withValues(alpha: 0.75)),
                    ),
                  ],
                ),
              ),
              Text(
                '${loyalty.points} pts',
                style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.storeHeader),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProfileSageHeader extends StatelessWidget {
  const _ProfileSageHeader({
    required this.name,
    required this.email,
    this.phone,
    this.imageUrl,
  });

  final String name;
  final String email;
  final String? phone;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final resolved = resolveMediaUrl(imageUrl);
    final initial = name.isNotEmpty ? name[0].toUpperCase() : '?';

    return Container(
      width: double.infinity,
      color: AppColors.storeHeader,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 40),
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.accountTitle,
                    style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600),
                  ),
                ),
                Consumer<CartProvider>(
                  builder: (context, cart, _) => StoreHeaderIconButton(
                    icon: Icons.shopping_cart_outlined,
                    badge: cart.count,
                    onTap: () => openCartScreen(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                CircleAvatar(
                  radius: 32,
                  backgroundColor: Colors.white.withValues(alpha: 0.25),
                  child: resolved.isNotEmpty
                      ? ClipOval(
                          child: SizedBox(
                            width: 60,
                            height: 60,
                            child: ProductImage(imageUrl: resolved, fit: BoxFit.cover),
                          ),
                        )
                      : Text(initial, style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(email, style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
                      if (phone != null && phone!.isNotEmpty)
                        Text(phone!, style: TextStyle(color: Colors.white.withValues(alpha: 0.75), fontSize: 13)),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsCard extends StatelessWidget {
  const _StatsCard({
    required this.orders,
    required this.wishlist,
    required this.loyaltyPoints,
    this.loyaltyTier,
  });

  final int orders;
  final int wishlist;
  final int loyaltyPoints;
  final String? loyaltyTier;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          _buildStatCell(context, '$orders', l10n.statOrders),
          _divider(context),
          _buildStatCell(context, '$wishlist', l10n.statWishlist),
          _divider(context),
          _buildStatCell(
            context,
            loyaltyTier != null ? loyaltyTier!.toUpperCase() : '$loyaltyPoints',
            l10n.statLoyalty,
          ),
        ],
      ),
    );
  }

  Widget _divider(BuildContext context) {
    final border = Theme.of(context).dividerTheme.color ?? Theme.of(context).colorScheme.outline;
    return Container(width: 1, height: 36, color: border);
  }

  Widget _buildStatCell(BuildContext context, String value, String label) {
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: onSurface),
          ),
          const SizedBox(height: 4),
          Text(label, style: TextStyle(fontSize: 12, color: onSurfaceVariant)),
        ],
      ),
    );
  }
}
