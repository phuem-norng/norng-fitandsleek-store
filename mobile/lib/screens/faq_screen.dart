import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/app_settings_provider.dart';
import '../services/storefront_content_service.dart';
import '../utils/locale_content.dart';

class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  Map<String, dynamic>? _payload;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await context.read<StorefrontContentService>().fetchFaq();
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
    final title = readString(locale?['title'], 'FAQ');
    final subtitle = readString(locale?['subtitle']);
    final sectionOrder = readStringList(_payload?['section_order']);
    final sections = locale?['sections'];
    final sectionMap = sections is Map ? Map<String, dynamic>.from(sections) : <String, dynamic>{};

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (subtitle.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                  ),
                for (final key in sectionOrder)
                  if (sectionMap[key] is Map) _FaqSection(section: Map<String, dynamic>.from(sectionMap[key] as Map)),
              ],
            ),
    );
  }
}

class _FaqSection extends StatelessWidget {
  const _FaqSection({required this.section});

  final Map<String, dynamic> section;

  @override
  Widget build(BuildContext context) {
    final title = readString(section['title']);
    final items = section['items'];
    final list = items is List ? items : const [];

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (title.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(title, style: Theme.of(context).textTheme.titleMedium),
                ),
              for (final item in list)
                if (item is Map)
                  _FaqItem(
                    question: readString(item['question']),
                    answer: readString(item['answer']),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FaqItem extends StatelessWidget {
  const _FaqItem({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        title: Text(question, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(answer, style: Theme.of(context).textTheme.bodyMedium),
            ),
          ),
        ],
      ),
    );
  }
}
