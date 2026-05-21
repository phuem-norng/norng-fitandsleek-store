import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

class HeaderSettings {
  const HeaderSettings({
    this.logoUrl,
    this.logoText = 'FitandSleek',
    this.backgroundColor = AppColors.storeHeader,
    this.searchPlaceholder = 'Search everything',
    this.searchEnabled = true,
  });

  final String? logoUrl;
  final String logoText;
  final Color backgroundColor;
  final String searchPlaceholder;
  final bool searchEnabled;

  static Color _parseColor(String? hex, Color fallback) {
    if (hex == null || hex.trim().isEmpty) return fallback;
    var h = hex.trim().replaceAll('#', '');
    if (h.length == 3) {
      h = h.split('').map((c) => '$c$c').join();
    }
    if (h.length != 6) return fallback;
    try {
      return Color(int.parse('FF$h', radix: 16));
    } catch (_) {
      return fallback;
    }
  }

  factory HeaderSettings.fromHomepageJson(Map<String, dynamic> data) {
    final header = data['header'];
    final headerMap = header is Map ? Map<String, dynamic>.from(header) : <String, dynamic>{};

    final logoUrl = (headerMap['logo_url'] ?? data['app_logo_url'])?.toString();
    final logoText = (headerMap['logo_text'] ?? 'FitandSleek').toString();
    final bg = _parseColor(headerMap['background_color']?.toString(), AppColors.storeHeader);
    final placeholder = (headerMap['search_placeholder'] ?? 'Search everything').toString();
    final searchEnabled = headerMap['search_enabled'] != false;

    return HeaderSettings(
      logoUrl: logoUrl != null && logoUrl.trim().isNotEmpty ? logoUrl.trim() : null,
      logoText: logoText.isNotEmpty ? logoText : 'FitandSleek',
      backgroundColor: bg,
      searchPlaceholder: placeholder,
      searchEnabled: searchEnabled,
    );
  }
}
