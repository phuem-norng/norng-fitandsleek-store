import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/l10n_extension.dart';
import '../providers/auth_provider.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/profile/account_preferences_section.dart';
import '../widgets/profile/settings_tile.dart';
import 'customer_profile_edit_screen.dart';

class AccountSettingsScreen extends StatelessWidget {
  const AccountSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final user = context.watch<AuthProvider>().user;
    if (user == null) {
      return Scaffold(
        body: Center(child: Text(l10n.guestAccountTitle)),
      );
    }

    return Scaffold(
      body: Column(
        children: [
          InnerPageHeader(
            title: l10n.menuSettings,
            leadingIcon: Icons.settings_outlined,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                AccountSectionLabel(l10n.editProfile),
                const SizedBox(height: 8),
                SettingsTile(
                  icon: Icons.person_outline,
                  title: user.name,
                  subtitle: user.email,
                  onTap: user.isCustomer
                      ? () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => CustomerProfileEditScreen(user: user),
                            ),
                          )
                      : null,
                ),
                const SizedBox(height: 24),
                const AccountPreferencesSection(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
