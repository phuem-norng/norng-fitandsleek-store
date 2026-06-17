import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/l10n_extension.dart';
import '../../providers/app_settings_provider.dart';
import '../../screens/faq_screen.dart';
import '../../screens/storefront_page_screen.dart';
import '../../theme/app_colors.dart';
import '../../widgets/telegram_connect_button.dart';
import 'settings_tile.dart';

class AccountSectionLabel extends StatelessWidget {
  const AccountSectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: Theme.of(context).colorScheme.primary,
            fontWeight: FontWeight.w700,
          ),
    );
  }
}

class AccountPreferencesSection extends StatelessWidget {
  const AccountPreferencesSection({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final settings = context.watch<AppSettingsProvider>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AccountSectionLabel(l10n.preferences),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.language_outlined,
          title: l10n.languageTitle,
          subtitle: settings.language == 'km' ? 'ខ្មែរ (KM)' : 'English (EN)',
          trailing: AccountLangPill(language: settings.language),
          onTap: () => settings.toggleLanguage(),
        ),
        const SizedBox(height: 8),
        SettingsTile(
          icon: settings.isDark ? Icons.dark_mode_outlined : Icons.light_mode_outlined,
          title: l10n.appearance,
          subtitle: settings.isDark ? l10n.darkMode : l10n.lightMode,
          trailing: Switch.adaptive(
            value: settings.isDark,
            activeTrackColor: AppColors.storeHeader.withValues(alpha: 0.45),
            activeThumbColor: AppColors.storeHeader,
            onChanged: (value) => settings.setThemeMode(
              value ? ThemeMode.dark : ThemeMode.light,
            ),
          ),
        ),
        const SizedBox(height: 12),
        const TelegramAccountConnectTile(),
      ],
    );
  }
}

class AccountSupportSection extends StatelessWidget {
  const AccountSupportSection({super.key, this.showFaqSubtitle = true});

  final bool showFaqSubtitle;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AccountSectionLabel(l10n.supportLegal),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.mail_outline,
          title: l10n.contactUs,
          onTap: () => _openPage(context, StorefrontPageKind.contact),
        ),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.privacy_tip_outlined,
          title: l10n.privacyPolicy,
          onTap: () => _openPage(context, StorefrontPageKind.privacy),
        ),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.description_outlined,
          title: l10n.termsConditions,
          onTap: () => _openPage(context, StorefrontPageKind.terms),
        ),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.cookie_outlined,
          title: l10n.cookiesPolicy,
          onTap: () => _openPage(context, StorefrontPageKind.cookies),
        ),
        const SizedBox(height: 8),
        SettingsTile(
          icon: Icons.help_outline,
          title: l10n.faq,
          subtitle: showFaqSubtitle ? l10n.menuHelp : null,
          onTap: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const FaqScreen()),
          ),
        ),
      ],
    );
  }

  void _openPage(BuildContext context, StorefrontPageKind kind) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => StorefrontPageScreen(kind: kind)),
    );
  }
}

class AccountLangPill extends StatelessWidget {
  const AccountLangPill({super.key, required this.language});

  final String language;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.storeHeader.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        language == 'km' ? 'KM' : 'EN',
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: AppColors.storeHeader,
        ),
      ),
    );
  }
}
