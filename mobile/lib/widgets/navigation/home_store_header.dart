import 'package:flutter/material.dart';

import '../../models/header_settings.dart';
import '../../theme/app_colors.dart';
import '../app_logo.dart';

/// Logo height in the centered home/shop header row.
const double kHomeHeaderLogoHeight = 80;

/// Home / Shop sage header — brand, bell, cart.
class HomeStoreHeader extends StatelessWidget {
  const HomeStoreHeader({
    super.key,
    required this.settings,
    this.onNotificationsTap,
    this.onCartTap,
    this.cartBadge = 0,
    this.notificationBadge = 0,
  });

  final HeaderSettings settings;
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
                SizedBox(
                  height: kHomeHeaderLogoHeight,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      AppLogo(
                        logoUrl: settings.logoUrl,
                        logoText: settings.logoText,
                        height: kHomeHeaderLogoHeight,
                        onColoredHeader: true,
                      ),
                      Positioned(
                        left: 0,
                        top: 0,
                        bottom: 0,
                        child: StoreHeaderIconButton(
                          icon: Icons.notifications_outlined,
                          badge: notificationBadge,
                          onTap: onNotificationsTap,
                        ),
                      ),
                      Positioned(
                        right: 0,
                        top: 0,
                        bottom: 0,
                        child: StoreHeaderIconButton(
                          icon: Icons.shopping_cart_outlined,
                          badge: cartBadge,
                          onTap: onCartTap,
                        ),
                      ),
                    ],
                  ),
                ),
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
    this.onCartTap,
    this.cartBadge = 0,
    this.backgroundColor = AppColors.storeHeader,
  });

  final String title;
  final String? subtitle;
  final IconData? leadingIcon;
  final VoidCallback? onBack;
  final VoidCallback? onCartTap;
  final int cartBadge;
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
                  if (onCartTap != null)
                    StoreHeaderIconButton(
                      icon: Icons.shopping_cart_outlined,
                      badge: cartBadge,
                      onTap: onCartTap,
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

class StoreHeaderIconButton extends StatelessWidget {
  const StoreHeaderIconButton({
    super.key,
    required this.icon,
    this.badge = 0,
    this.onTap,
    this.iconColor = Colors.white,
  });

  final IconData icon;
  final int badge;
  final VoidCallback? onTap;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        IconButton(
          onPressed: onTap,
          icon: Icon(icon, color: iconColor, size: 24),
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
