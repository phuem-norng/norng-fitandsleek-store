import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../utils/media_url.dart';
import 'product_image.dart';

/// Storefront logo — image from backend (`/logo.png`) with header-safe text fallback.
class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.logoUrl,
    this.height = 56,
    this.logoText = 'FitandSleek',
    this.onColoredHeader = false,
  });

  final String? logoUrl;
  final double height;
  final String logoText;
  /// White typography on sage header when the image fails to load.
  final bool onColoredHeader;

  String get _resolvedUrl {
    final raw = logoUrl?.trim();
    if (raw == null || raw.isEmpty || raw == '/logo.png' || raw.endsWith('/logo.png')) {
      return resolveMediaUrl(AppConfig.siteLogoPath);
    }
    return resolveMediaUrl(raw);
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: height, maxWidth: height * 2.4),
        child: ProductImage(
          imageUrl: _resolvedUrl,
          fit: BoxFit.contain,
          error: onColoredHeader ? _headerTextFallback() : _defaultTextFallback(context),
        ),
      ),
    );
  }

  Widget _headerTextFallback() {
    final title = _displayTitle(logoText);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Colors.white,
            fontSize: height * 0.26,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
            height: 1.05,
          ),
        ),
        Text(
          'GYM CLOTHING',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.88),
            fontSize: height * 0.155,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.45,
            height: 1.1,
          ),
        ),
      ],
    );
  }

  Widget _defaultTextFallback(BuildContext context) {
    return Text(
      logoText,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
    );
  }

  static String _displayTitle(String raw) {
    final t = raw.trim();
    if (t.isEmpty) return 'FIT & SLEEK';
    final upper = t.toUpperCase();
    if (upper.contains('&') || upper.contains(' ')) return upper;
    if (upper.contains('FIT') && upper.contains('SLEEK')) {
      return upper.replaceAll(RegExp(r'FITANDSLEEK|FITAND SLEEK', caseSensitive: false), 'FIT & SLEEK');
    }
    return upper;
  }
}
