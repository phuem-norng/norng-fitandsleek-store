import 'package:flutter/material.dart';

import '../../l10n/l10n_extension.dart';
import '../../theme/app_colors.dart';

enum MobileNavItem {
  home,
  search,
  shop,
  wishlist,
  account,
}

class MobileBottomNav extends StatelessWidget {
  const MobileBottomNav({
    super.key,
    required this.selected,
    required this.onSelect,
    this.wishlistBadge = 0,
  });

  final MobileNavItem selected;
  final ValueChanged<MobileNavItem> onSelect;
  final int wishlistBadge;

  static const _itemDefs = [
    (MobileNavItem.home, Icons.home_outlined),
    (MobileNavItem.search, Icons.search_rounded),
    (MobileNavItem.shop, Icons.storefront_outlined),
    (MobileNavItem.wishlist, Icons.favorite_border),
    (MobileNavItem.account, Icons.person_outline),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final labels = {
      MobileNavItem.home: l10n.navHome,
      MobileNavItem.search: l10n.navSearch,
      MobileNavItem.shop: l10n.navShop,
      MobileNavItem.wishlist: l10n.navWishlist,
      MobileNavItem.account: l10n.navAccount,
    };
    final surface = Theme.of(context).colorScheme.surface;

    return Material(
      color: surface,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              color: surface,
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
                  children: _itemDefs.map((entry) {
                    final item = entry.$1;
                    final label = labels[item]!;
                    final icon = entry.$2;
                    final active = selected == item;
                    final badge = switch (item) {
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
    final inactive = Theme.of(context).colorScheme.onSurfaceVariant;

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
                  color: active ? AppColors.storeHeader : inactive,
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
                color: active ? AppColors.storeHeader : inactive,
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
