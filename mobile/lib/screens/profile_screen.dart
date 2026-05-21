import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/profile/profile_header.dart';
import '../widgets/profile/settings_tile.dart';
import 'admin/admin_dashboard_screen.dart';
import 'admin/admin_profile_edit_screen.dart';
import 'customer_profile_edit_screen.dart';
import 'login_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.isLoggedIn) {
      return FsEmptyState(
        icon: Icons.person_outline,
        title: 'Your account',
        subtitle: 'Sign in to view orders, manage your profile, and checkout faster.',
        actionLabel: 'Sign in',
        onAction: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        ),
      );
    }

    final user = auth.user!;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        ProfileHeader(
          name: user.name,
          email: user.email,
          imageUrl: user.profileImageUrl,
          role: user.role,
          status: user.status,
          subtitle: user.phone != null && user.phone!.isNotEmpty ? user.phone : null,
        ),
        const SizedBox(height: 20),
        if (user.isAdmin) ...[
          Text('Admin', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          SettingsTile(
            icon: Icons.dashboard_outlined,
            title: 'Dashboard',
            subtitle: 'Revenue, orders, inventory overview',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AdminDashboardScreen()),
            ),
          ),
          const SizedBox(height: 8),
          SettingsTile(
            icon: Icons.admin_panel_settings_outlined,
            title: 'Admin profile',
            subtitle: 'Name, email, contact details',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => AdminProfileEditScreen(user: user)),
            ),
          ),
          const SizedBox(height: 20),
        ],
        Text('Account', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        if (user.isCustomer)
          SettingsTile(
            icon: Icons.edit_outlined,
            title: 'Edit profile',
            subtitle: 'Update your personal information',
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => CustomerProfileEditScreen(user: user)),
            ),
          ),
        if (user.isCustomer) const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.shopping_bag_outlined,
          title: 'Orders',
          subtitle: user.isAdmin ? 'Manage orders on the web admin' : 'Track purchases on the web store',
          onTap: null,
          trailing: Icon(Icons.open_in_new, size: 20, color: AppColors.textMuted),
        ),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.favorite_border,
          title: 'Wishlist',
          subtitle: 'Saved items from the storefront',
          onTap: null,
        ),
        const SizedBox(height: 20),
        Text('App', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        SettingsTile(
          icon: Icons.dns_outlined,
          title: 'API server',
          subtitle: AppConfig.apiBaseUrl,
          onTap: null,
          trailing: const SizedBox.shrink(),
        ),
        const SizedBox(height: 24),
        FsButton(
          label: 'Sign out',
          variant: FsButtonVariant.outline,
          icon: Icons.logout,
          onPressed: auth.busy
              ? null
              : () async {
                  await auth.logout();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Signed out successfully')),
                    );
                  }
                },
        ),
      ],
    );
  }
}
