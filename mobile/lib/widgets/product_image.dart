import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../utils/media_url.dart' show isDataUri;

/// Product thumbnail — supports HTTP URLs and `data:image/...;base64,...` from the API.
class ProductImage extends StatelessWidget {
  const ProductImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.placeholder,
    this.error,
  });

  final String imageUrl;
  final BoxFit fit;
  final Widget? placeholder;
  final Widget? error;

  static final _dataUriPattern = RegExp(
    r'^data:image/[^;]+;base64,(.+)$',
    caseSensitive: false,
    dotAll: true,
  );

  @override
  Widget build(BuildContext context) {
    if (imageUrl.isEmpty) {
      return placeholder ?? _defaultPlaceholder();
    }

    if (isDataUri(imageUrl)) {
      final bytes = _decodeDataUri(imageUrl);
      if (bytes == null) {
        return error ?? _defaultError();
      }
      return Image.memory(bytes, fit: fit, gaplessPlayback: true);
    }

    // Flutter web decodes images via canvas; cross-origin /storage needs CORS.
    // resolveMediaUrl() routes web storage paths through /api/media (see media_url.dart).
    if (kIsWeb) {
      return Image.network(
        imageUrl,
        fit: fit,
        loadingBuilder: (context, child, progress) {
          if (progress == null) return child;
          return placeholder ?? _defaultPlaceholder();
        },
        errorBuilder: (_, __, ___) => error ?? _defaultError(),
      );
    }

    return CachedNetworkImage(
      imageUrl: imageUrl,
      fit: fit,
      placeholder: (_, __) => placeholder ?? _defaultPlaceholder(),
      errorWidget: (_, __, ___) => error ?? _defaultError(),
    );
  }

  static Uint8List? _decodeDataUri(String dataUri) {
    final match = _dataUriPattern.firstMatch(dataUri.trim());
    if (match == null) return null;
    try {
      return Uint8List.fromList(base64Decode(match.group(1)!));
    } catch (_) {
      return null;
    }
  }

  Widget _defaultPlaceholder() => const ColoredBox(
        color: Color(0xFFF1F5F9),
        child: Center(
          child: Icon(Icons.image_outlined, size: 48, color: Colors.grey),
        ),
      );

  Widget _defaultError() => const ColoredBox(
        color: Color(0xFFF1F5F9),
        child: Center(
          child: Icon(Icons.broken_image_outlined, size: 48, color: Colors.grey),
        ),
      );
}
