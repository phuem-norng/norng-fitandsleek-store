import 'package:flutter/material.dart';

import '../config/app_config.dart';
import '../utils/media_url.dart';
import 'product_image.dart';

/// Storefront logo — image from API / site static `/logo.png` (same as web [Logo.jsx]).
class AppLogo extends StatefulWidget {
  const AppLogo({
    super.key,
    this.logoUrl,
    this.height = 48,
    this.logoText = 'FitandSleek',
    this.onColoredHeader = false,
  });

  final String? logoUrl;
  final double height;
  final String logoText;
  final bool onColoredHeader;

  @override
  State<AppLogo> createState() => _AppLogoState();
}

class _AppLogoState extends State<AppLogo> {
  int _candidateIndex = 0;

  List<String> get _candidates {
    final urls = <String>[];
    final raw = widget.logoUrl?.trim();
    if (raw != null && raw.isNotEmpty) {
      urls.add(resolveMediaUrl(raw));
    }
    urls.add('${AppConfig.storefrontUrl}${AppConfig.siteLogoPath}');
    urls.add('${AppConfig.backendOrigin}${AppConfig.siteLogoPath}');
    return urls.where((u) => u.isNotEmpty).toList();
  }

  String get _currentUrl {
    final list = _candidates;
    if (list.isEmpty) return '';
    final i = _candidateIndex.clamp(0, list.length - 1);
    return list[i];
  }

  void _tryNextUrl() {
    final list = _candidates;
    if (_candidateIndex + 1 < list.length) {
      setState(() => _candidateIndex++);
    }
  }

  @override
  void didUpdateWidget(AppLogo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.logoUrl != widget.logoUrl) {
      _candidateIndex = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: SizedBox(
        height: widget.height,
        width: widget.height * 2.75,
        child: ProductImage(
          key: ValueKey(_currentUrl),
          imageUrl: _currentUrl,
          fit: BoxFit.contain,
          error: _buildError(context),
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context) {
    if (_candidateIndex + 1 < _candidates.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _tryNextUrl();
      });
      return SizedBox(
        height: widget.height,
        child: const Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white54),
          ),
        ),
      );
    }

    if (widget.onColoredHeader) {
      return Icon(
        Icons.storefront_rounded,
        size: widget.height * 0.55,
        color: Colors.white.withValues(alpha: 0.9),
      );
    }

    return Icon(Icons.storefront_outlined, size: widget.height * 0.5, color: Colors.grey);
  }
}
