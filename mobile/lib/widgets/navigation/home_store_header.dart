import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../../models/header_settings.dart';
import '../../theme/app_colors.dart';
import '../app_logo.dart';

/// Home / Shop sage header — brand, location, bell, cart, Khmer search pill.
class HomeStoreHeader extends StatelessWidget {
  const HomeStoreHeader({
    super.key,
    required this.settings,
    this.searchController,
    this.onSearch,
    this.onCameraTap,
    this.onNotificationsTap,
    this.onCartTap,
    this.cartBadge = 0,
    this.notificationBadge = 0,
  });

  final HeaderSettings settings;
  final TextEditingController? searchController;
  final VoidCallback? onSearch;
  final VoidCallback? onCameraTap;
  final VoidCallback? onNotificationsTap;
  final VoidCallback? onCartTap;
  final int cartBadge;
  final int notificationBadge;

  @override
  Widget build(BuildContext context) {
    final bg = settings.backgroundColor;

    return Material(
      color: bg,
      elevation: 0,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: bg,
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
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    AppLogo(
                      logoUrl: settings.logoUrl,
                      logoText: settings.logoText,
                      height: 48,
                      onColoredHeader: true,
                    ),
                    const Spacer(),
                    _HeaderIconButton(
                      icon: Icons.notifications_outlined,
                      badge: notificationBadge,
                      onTap: onNotificationsTap,
                    ),
                    const SizedBox(width: 2),
                    _HeaderIconButton(
                      icon: Icons.shopping_cart_outlined,
                      badge: cartBadge,
                      onTap: onCartTap,
                    ),
                  ],
                ),
                if (settings.searchEnabled) ...[
                  const SizedBox(height: 10),
                  _SearchPill(
                    controller: searchController,
                    placeholder: AppStrings.searchPlaceholder,
                    onSubmitted: onSearch,
                    onCameraTap: onCameraTap,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class InnerPageHeader extends StatelessWidget {
  const InnerPageHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.leadingIcon,
    this.onBack,
    this.backgroundColor = AppColors.storeHeader,
  });

  final String title;
  final String? subtitle;
  final IconData? leadingIcon;
  final VoidCallback? onBack;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: backgroundColor,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (onBack != null)
                    IconButton(
                      onPressed: onBack,
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                    ),
                  if (leadingIcon != null) ...[
                    Icon(leadingIcon, color: Colors.white, size: 20),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(left: 16, top: 2),
                  child: Text(
                    subtitle!,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 13,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    this.badge = 0,
    this.onTap,
  });

  final IconData icon;
  final int badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          onPressed: onTap,
          icon: Icon(icon, color: Colors.white, size: 24),
          visualDensity: VisualDensity.compact,
        ),
        if (badge > 0)
          Positioned(
            top: 6,
            right: 6,
            child: Container(
              width: 16,
              height: 16,
              decoration: const BoxDecoration(color: Colors.red, shape: BoxShape.circle),
              alignment: Alignment.center,
              child: Text(
                badge > 9 ? '9+' : '$badge',
                style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700),
              ),
            ),
          ),
      ],
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

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          Icon(Icons.search_rounded, size: 20, color: Colors.white.withValues(alpha: 0.9)),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              onSubmitted: (_) => onSubmitted?.call(),
              textInputAction: TextInputAction.search,
              style: const TextStyle(fontSize: 13, color: Colors.white, height: 1.25),
              cursorColor: Colors.white,
              decoration: InputDecoration(
                isCollapsed: true,
                hintText: placeholder,
                hintStyle: TextStyle(fontSize: 13, color: Colors.white.withValues(alpha: 0.75)),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 11),
              ),
            ),
          ),
          IconButton(
            onPressed: onCameraTap,
            icon: Icon(Icons.photo_camera_outlined, size: 20, color: Colors.white.withValues(alpha: 0.9)),
            visualDensity: VisualDensity.compact,
          ),
        ],
      ),
    );
  }
}
