import 'package:flutter/material.dart';
import '../models/header_settings.dart';
import '../theme/app_colors.dart';
import 'app_logo.dart';

/// Sticky storefront header — sage bar, logo left, pill search (aligned with web mobile).
class MobileStoreHeader extends StatelessWidget {
  const MobileStoreHeader({
    super.key,
    required this.settings,
    required this.showSearch,
    this.searchController,
    this.onSearch,
    this.onSearchTap,
    this.pageTitle,
  });

  final HeaderSettings settings;
  final bool showSearch;
  final TextEditingController? searchController;
  final VoidCallback? onSearch;
  final VoidCallback? onSearchTap;
  final String? pageTitle;

  @override
  Widget build(BuildContext context) {
    final bg = settings.backgroundColor;

    return Material(
      color: bg,
      elevation: 0,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: bg,
          border: Border(
            bottom: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
            child: SizedBox(
              height: 48,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  AppLogo(
                    logoUrl: settings.logoUrl,
                    logoText: settings.logoText,
                    height: 48,
                    onColoredHeader: true,
                  ),
                  if (showSearch && settings.searchEnabled) ...[
                    const SizedBox(width: 10),
                    Expanded(
                      child: _SearchPill(
                        controller: searchController,
                        placeholder: settings.searchPlaceholder,
                        onSubmitted: onSearch,
                        onCameraTap: onSearchTap,
                      ),
                    ),
                  ] else if (pageTitle != null) ...[
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        pageTitle!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                          height: 1.2,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchPill extends StatelessWidget {
  const _SearchPill({
    this.controller,
    required this.placeholder,
    this.onSubmitted,
    this.onCameraTap,
  });

  final TextEditingController? controller;
  final String placeholder;
  final VoidCallback? onSubmitted;
  final VoidCallback? onCameraTap;

  static const _iconColor = Color(0xFF52525B);
  static const _hintColor = Color(0xFF71717A);
  static const _textColor = Color(0xFF18181B);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.97),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.65)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          const Icon(Icons.search_rounded, size: 20, color: _iconColor),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              onSubmitted: (_) => onSubmitted?.call(),
              textInputAction: TextInputAction.search,
              style: const TextStyle(
                fontSize: 13,
                color: _textColor,
                fontWeight: FontWeight.w400,
                height: 1.25,
              ),
              cursorColor: AppColors.storeHeader,
              decoration: InputDecoration(
                isCollapsed: true,
                hintText: placeholder,
                hintStyle: const TextStyle(
                  fontSize: 13,
                  color: _hintColor,
                  fontWeight: FontWeight.w400,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 11),
              ),
            ),
          ),
          Container(
            width: 1,
            height: 22,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            color: const Color(0xFFE4E4E7),
          ),
          IconButton(
            onPressed: onCameraTap,
            tooltip: 'Search by image',
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            icon: const Icon(
              Icons.photo_camera_outlined,
              size: 20,
              color: _iconColor,
            ),
          ),
        ],
      ),
    );
  }
}
