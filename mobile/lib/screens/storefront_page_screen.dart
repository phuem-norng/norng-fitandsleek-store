import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/app_settings_provider.dart';
import '../services/storefront_content_service.dart';
import '../theme/app_colors.dart';
import '../utils/locale_content.dart';

enum StorefrontPageKind {
  contact,
  privacy,
  terms,
  cookies,
}

class StorefrontPageScreen extends StatefulWidget {
  const StorefrontPageScreen({super.key, required this.kind});

  final StorefrontPageKind kind;

  @override
  State<StorefrontPageScreen> createState() => _StorefrontPageScreenState();
}

class _StorefrontPageScreenState extends State<StorefrontPageScreen> {
  Map<String, dynamic>? _payload;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final service = context.read<StorefrontContentService>();
    try {
      final data = switch (widget.kind) {
        StorefrontPageKind.contact => await service.fetchContactPage(),
        StorefrontPageKind.privacy => await service.fetchPrivacyPage(),
        StorefrontPageKind.terms => await service.fetchTermsPage(),
        StorefrontPageKind.cookies => await service.fetchCookiesPage(),
      };
      if (mounted) setState(() => _payload = data);
    } catch (_) {
      if (mounted) setState(() => _payload = const {});
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final language = context.watch<AppSettingsProvider>().language;
    final locale = resolveLocaleMap(_payload, language);
    final title = readString(locale?['title'], _fallbackTitle());

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (widget.kind == StorefrontPageKind.contact)
                  ..._buildContactContent(locale, _payload)
                else
                  ..._buildPolicyContent(locale, _payload),
              ],
            ),
    );
  }

  String _fallbackTitle() {
    return switch (widget.kind) {
      StorefrontPageKind.contact => 'Contact Us',
      StorefrontPageKind.privacy => 'Privacy Policy',
      StorefrontPageKind.terms => 'Terms & Conditions',
      StorefrontPageKind.cookies => 'Cookies Policy',
    };
  }

  List<Widget> _buildContactContent(Map<String, dynamic>? locale, Map<String, dynamic>? payload) {
    final subtitle = readString(locale?['subtitle']);
    final cardOrder = readStringList(payload?['info_card_order']);
    final cards = locale?['info_cards'];
    final cardMap = cards is Map ? Map<String, dynamic>.from(cards) : <String, dynamic>{};

    return [
      if (subtitle.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
        ),
      for (final key in cardOrder)
        if (cardMap[key] is Map) _InfoCard(data: Map<String, dynamic>.from(cardMap[key] as Map)),
    ];
  }

  List<Widget> _buildPolicyContent(Map<String, dynamic>? locale, Map<String, dynamic>? payload) {
    final lastUpdated = readString(locale?['last_updated']);
    final sectionOrder = readStringList(payload?['section_order']);
    final sections = locale?['sections'];
    final sectionMap = sections is Map ? Map<String, dynamic>.from(sections) : <String, dynamic>{};

    return [
      if (lastUpdated.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Text(lastUpdated, style: Theme.of(context).textTheme.bodyMedium),
        ),
      for (final key in sectionOrder)
        if (sectionMap[key] is Map)
          _PolicySection(section: Map<String, dynamic>.from(sectionMap[key] as Map)),
    ];
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(readString(data['title']), style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(readString(data['line1']), style: Theme.of(context).textTheme.bodyLarge),
            if (readString(data['line2']).isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(readString(data['line2']), style: Theme.of(context).textTheme.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}

class _PolicySection extends StatelessWidget {
  const _PolicySection({required this.section});

  final Map<String, dynamic> section;

  @override
  Widget build(BuildContext context) {
    final title = readString(section['title']);
    final intro = readString(section['intro']);
    final body = readString(section['body']);
    final footer = readString(section['footer']);
    final items = section['items'];
    final list = items is List ? items : const [];

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(title, style: Theme.of(context).textTheme.titleMedium),
              ),
            if (intro.isNotEmpty) Text(intro, style: Theme.of(context).textTheme.bodyMedium),
            if (body.isNotEmpty) ...[
              if (intro.isNotEmpty) const SizedBox(height: 8),
              Text(body, style: Theme.of(context).textTheme.bodyMedium),
            ],
            for (final item in list)
              if (item is Map)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('• ', style: TextStyle(color: AppColors.storeHeader)),
                      Expanded(
                        child: RichText(
                          text: TextSpan(
                            style: Theme.of(context).textTheme.bodyMedium,
                            children: [
                              if (readString(item['label']).isNotEmpty)
                                TextSpan(
                                  text: '${readString(item['label'])} ',
                                  style: const TextStyle(fontWeight: FontWeight.w600),
                                ),
                              TextSpan(text: readString(item['text'])),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
            if (footer.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(footer, style: Theme.of(context).textTheme.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}
