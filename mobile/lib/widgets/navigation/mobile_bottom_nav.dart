import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../../theme/app_colors.dart';

enum MobileNavItem {
  home,
  shop,
  cart,
  wishlist,
  account,
}

class MobileBottomNav extends StatelessWidget {
  const MobileBottomNav({
    super.key,
    required this.selected,
    required this.onSelect,
    this.cartBadge = 0,
    this.wishlistBadge = 0,
  });

  final MobileNavItem selected;
  final ValueChanged<MobileNavItem> onSelect;
  final int cartBadge;
  final int wishlistBadge;

  static const _items = [
    (MobileNavItem.home, AppStrings.navHome, Icons.home_outlined),
    (MobileNavItem.shop, AppStrings.navShop, Icons.storefront_outlined),
    (MobileNavItem.cart, AppStrings.navCart, Icons.shopping_cart_outlined),
    (MobileNavItem.wishlist, AppStrings.navWishlist, Icons.favorite_border),
    (MobileNavItem.account, AppStrings.navAccount, Icons.person_outline),
  ];

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.black.withValues(alpha: 0.08))),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 6, 4, 4),
                child: Row(
                  children: _items.map((entry) {
                    final item = entry.$1;
                    final label = entry.$2;
                    final icon = entry.$3;
                    final active = selected == item;
                    final badge = switch (item) {
                      MobileNavItem.cart => cartBadge,
                      MobileNavItem.wishlist => wishlistBadge,
                      _ => 0,
                    };
                    return Expanded(
                      child: _NavCell(
                        label: label,
                        icon: icon,
                        active: active,
                        badge: badge,
                        onTap: () => onSelect(item),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              AppStrings.footerBrand,
              style: TextStyle(fontSize: 10, color: Colors.grey.shade400),
            ),
          ),
        ],
      ),
    );
  }
}

class _NavCell extends StatelessWidget {
  const _NavCell({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
    this.badge = 0,
  });

  final String label;
  final IconData icon;
  final bool active;
  final VoidCallback onTap;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOutCubic,
        margin: const EdgeInsets.symmetric(horizontal: 2),
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
        decoration: BoxDecoration(
          color: active ? AppColors.storeHeader.withValues(alpha: 0.14) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: active ? AppColors.storeHeader : const Color(0xFF71717A),
                ),
                if (badge > 0)
                  Positioned(
                    top: -6,
                    right: -10,
                    child: _Badge(count: badge),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? AppColors.storeHeader : const Color(0xFF71717A),
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final label = count > 99 ? '99+' : '$count';
    return Container(
      constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: AppColors.storeHeader,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
      ),
    );
  }
}
