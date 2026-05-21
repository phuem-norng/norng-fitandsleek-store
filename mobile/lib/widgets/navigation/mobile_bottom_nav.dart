import 'package:flutter/material.dart';

/// Bottom nav keys — same order as web [MobileBottomNav.jsx].
enum MobileNavItem {
  home,
  shop,
  notifications,
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
    this.notificationBadge = 0,
    this.wishlistBadge = 0,
    this.notificationsActive = false,
  });

  final MobileNavItem selected;
  final ValueChanged<MobileNavItem> onSelect;
  final int cartBadge;
  final int notificationBadge;
  final int wishlistBadge;
  final bool notificationsActive;

  static const _items = [
    (MobileNavItem.home, 'Home', Icons.home_outlined),
    (MobileNavItem.shop, 'Shop', Icons.storefront_outlined),
    (MobileNavItem.notifications, 'Notifications', Icons.notifications_outlined),
    (MobileNavItem.cart, 'Cart', Icons.shopping_bag_outlined),
    (MobileNavItem.wishlist, 'Wishlist', Icons.favorite_border),
    (MobileNavItem.account, 'Account', Icons.person_outline),
  ];

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 0,
      child: DecoratedBox(
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
                final active = item == MobileNavItem.notifications
                    ? notificationsActive
                    : selected == item;
                final badge = switch (item) {
                  MobileNavItem.cart => cartBadge,
                  MobileNavItem.notifications => notificationBadge,
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
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  curve: Curves.easeOutCubic,
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: active ? const Color(0xFF18181B) : Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: active ? const Color(0xFF18181B) : const Color(0xFFE4E4E7),
                      width: 1,
                    ),
                    boxShadow: active
                        ? [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.12),
                              blurRadius: 4,
                              offset: const Offset(0, 1),
                            ),
                          ]
                        : null,
                  ),
                  child: Icon(
                    icon,
                    size: 18,
                    color: active ? Colors.white : const Color(0xFF52525B),
                  ),
                ),
                if (badge > 0)
                  Positioned(
                    top: -4,
                    right: -6,
                    child: _Badge(count: badge),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
                color: active ? const Color(0xFF18181B) : const Color(0xFF71717A),
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
      constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
      padding: const EdgeInsets.symmetric(horizontal: 5),
      decoration: const BoxDecoration(
        color: Color(0xFF18181B),
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          height: 1.1,
        ),
      ),
    );
  }
}
