import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/app_strings.dart';
import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/order_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/profile/settings_tile.dart';
import 'admin/admin_dashboard_screen.dart';
import 'admin/admin_pos_screen.dart';
import 'admin/admin_products_screen.dart';
import 'admin/admin_profile_edit_screen.dart';
import 'admin/admin_reports_screen.dart';
import 'customer_profile_edit_screen.dart';
import 'login_screen.dart';
import 'orders_screen.dart';
import '../widgets/navigation/notifications_sheet.dart';
import '../widgets/product_image.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  int _orderCount = 0;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) return;
    try {
      final page = await context.read<OrderService>().listOrders(page: 1);
      if (!mounted) return;
      setState(() => _orderCount = page.items.length);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final wishlist = context.watch<WishlistProvider>();

    if (!auth.isLoggedIn) {
      return Column(
        children: [
          const InnerPageHeader(title: AppStrings.accountTitle, leadingIcon: Icons.person_outline),
          Expanded(
            child: FsEmptyState(
              icon: Icons.person_outline,
              title: 'Your account',
              subtitleKm: 'ចូលគណនីដើម្បីមើលការបញ្ជាទិញ',
              subtitle: 'Sign in to view orders and manage your profile.',
              actionLabel: 'Sign in',
              onAction: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              ),
            ),
          ),
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
              reviews: 0,
            ),
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            children: [
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
                title: AppStrings.menuOrders,
                subtitle: AppStrings.menuOrdersKm,
                onTap: user.isCustomer
                    ? () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const OrdersScreen()),
                        )
                    : null,
              ),
              const SizedBox(height: 8),
              SettingsTile(
                icon: Icons.favorite_border,
                title: AppStrings.menuWishlist,
                subtitle: AppStrings.menuWishlistKm,
                onTap: null,
              ),
              const SizedBox(height: 8),
              SettingsTile(
                icon: Icons.notifications_outlined,
                title: AppStrings.menuNotifications,
                subtitle: AppStrings.menuNotificationsKm,
                onTap: () => showNotificationsSheet(context),
              ),
              const SizedBox(height: 8),
              SettingsTile(
                icon: Icons.settings_outlined,
                title: AppStrings.menuSettings,
                subtitle: AppStrings.menuSettingsKm,
                onTap: user.isCustomer
                    ? () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => CustomerProfileEditScreen(user: user)),
                        )
                    : null,
              ),
              const SizedBox(height: 8),
              SettingsTile(
                icon: Icons.help_outline,
                title: AppStrings.menuHelp,
                subtitle: AppStrings.menuHelpKm,
                onTap: null,
              ),
              const SizedBox(height: 16),
              Material(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: auth.busy
                      ? null
                      : () async {
                          await auth.logout();
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Signed out')),
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
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                AppStrings.signOut,
                                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.error),
                              ),
                              Text(
                                AppStrings.signOutKm,
                                style: TextStyle(fontSize: 12, color: AppColors.error),
                              ),
                            ],
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
      ],
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
            const Text(
              AppStrings.accountTitle,
              style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w600),
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
    required this.reviews,
  });

  final int orders;
  final int wishlist;
  final int reviews;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          _buildStatCell('$orders', AppStrings.statOrders),
          _divider(),
          _buildStatCell('$wishlist', AppStrings.statWishlist),
          _divider(),
          _buildStatCell('$reviews', AppStrings.statReviews),
        ],
      ),
    );
  }

  Widget _divider() => Container(width: 1, height: 36, color: AppColors.border);

  Widget _buildStatCell(String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}
