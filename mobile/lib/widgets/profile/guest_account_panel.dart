import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/l10n_extension.dart';
import '../../providers/app_settings_provider.dart';
import '../../screens/login_screen.dart';
import '../../screens/register_screen.dart';
import '../../theme/app_colors.dart';
import 'account_preferences_section.dart';

class GuestAccountPanel extends StatelessWidget {
  const GuestAccountPanel({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    context.watch<AppSettingsProvider>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
      children: [
        Column(
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.storeHeader.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.person_outline, size: 40, color: AppColors.storeHeader),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.guestAccountTitle,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 6),
            Text(
              l10n.guestAccountSubtitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const LoginScreen()),
                ),
                child: Text(l10n.signIn),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RegisterScreen()),
                ),
                child: Text(l10n.signUp),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const AccountPreferencesSection(),
        const SizedBox(height: 24),
        const AccountSupportSection(),
      ],
    );
  }
}
