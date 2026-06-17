import 'package:flutter/material.dart';

import '../l10n/l10n_extension.dart';
import '../widgets/navigation/home_store_header.dart';
import '../widgets/profile/account_preferences_section.dart';

class AccountHelpScreen extends StatelessWidget {
  const AccountHelpScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      body: Column(
        children: [
          InnerPageHeader(
            title: l10n.menuHelp,
            leadingIcon: Icons.help_outline,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: const [
                AccountSupportSection(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
