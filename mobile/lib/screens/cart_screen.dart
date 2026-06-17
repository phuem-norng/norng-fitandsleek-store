import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../models/cart_model.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/wishlist_provider.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/product_image.dart';
import 'checkout_screen.dart';
import 'login_screen.dart';
import 'product_detail_screen.dart';
import '../services/product_service.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => CartScreenState();
}

class CartScreenState extends State<CartScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => reload());
  }

  Future<void> reload() async {
    final auth = context.read<AuthProvider>();
    await context.read<CartProvider>().load(isLoggedIn: auth.isLoggedIn);
  }

  Future<void> _load() => reload();

  Future<void> _remove(CartItemModel item) async {
    final auth = context.read<AuthProvider>();
    await context.read<CartProvider>().removeItem(
          isLoggedIn: auth.isLoggedIn,
          item: item,
        );
  }

  Future<void> _updateQty(CartItemModel item, int nextQty) async {
    final auth = context.read<AuthProvider>();
    await context.read<CartProvider>().updateQuantity(
          isLoggedIn: auth.isLoggedIn,
          item: item,
          quantity: nextQty,
        );
  }

  Future<void> _moveToWishlist(CartItemModel item) async {
    final product = item.product;
    if (product == null) return;

    final auth = context.read<AuthProvider>();
    final wishlist = context.read<WishlistProvider>();

    if (!wishlist.has(product.id)) {
      await wishlist.toggle(
        product.id,
        isLoggedIn: auth.isLoggedIn,
        product: product,
      );
    }
    await _remove(item);

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(context.l10n.moveToWishlist)),
    );
  }

  _CartPriceMeta _priceMeta(CartItemModel item) {
    final product = item.product;
    final unitPaid = item.unitPrice > 0
        ? item.unitPrice
        : (product?.displayPrice ?? 0);
    final unitOriginal = product?.price ?? unitPaid;
    final qty = item.quantity;
    final hasDiscount =
        product != null && product.hasDiscount && unitOriginal > unitPaid;

    return _CartPriceMeta(
      qty: qty,
      unitPaid: unitPaid,
      unitOriginal: unitOriginal,
      linePaid: unitPaid * qty,
      lineOriginal: unitOriginal * qty,
      hasDiscount: hasDiscount,
      discountPercent: product?.discountPercent,
    );
  }

  double _originalSubtotal(List<CartItemModel> items) {
    return items.fold<double>(0, (sum, item) {
      final meta = _priceMeta(item);
      return sum + (meta.hasDiscount ? meta.lineOriginal : meta.linePaid);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final auth = context.watch<AuthProvider>();
    final cart = context.watch<CartProvider>();
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final onSurface = cs.onSurface;
    final onSurfaceVariant = cs.onSurfaceVariant;
    final cardColor = theme.cardTheme.color ?? cs.surface;
    final borderColor = theme.dividerTheme.color ?? cs.outline;

    if (cart.loading && cart.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (cart.error != null && cart.items.isEmpty) {
      return FsEmptyState(
        icon: Icons.error_outline,
        title: l10n.cartUnavailable,
        subtitle: cart.error,
        actionLabel: l10n.retry,
        onAction: _load,
      );
    }

    if (cart.items.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [
          FsEmptyState(
            icon: Icons.shopping_cart_outlined,
            title: l10n.cartEmpty,
            subtitle: l10n.cartEmptySubtitle,
            minimal: true,
          ),
          const SizedBox(height: 16),
          Text(
            l10n.cartEmptyHint,
            textAlign: TextAlign.center,
            style: TextStyle(color: onSurfaceVariant, fontSize: 13),
          ),
        ],
      );
    }

    final originalSubtotal = _originalSubtotal(cart.items);
    final savedAmount = (originalSubtotal - cart.total).clamp(0, double.infinity);

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              itemCount: cart.items.length + 1,
              separatorBuilder: (_, index) => index == 0 ? const SizedBox(height: 12) : const SizedBox(height: 12),
              itemBuilder: (context, index) {
                if (index == 0) {
                  return Text(
                    l10n.cartTitle,
                    style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: onSurface,
                        ),
                  );
                }
                final item = cart.items[index - 1];
                return _CartItemCard(
                  item: item,
                  currency: currency,
                  priceMeta: _priceMeta(item),
                  onRemove: () => _remove(item),
                  onDecrease: () => _updateQty(item, item.quantity - 1),
                  onIncrease: () => _updateQty(item, item.quantity + 1),
                  onMoveToWishlist: () => _moveToWishlist(item),
                  onTap: item.product?.slug == null
                      ? null
                      : () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => ProductDetailScreen(
                                productService: context.read<ProductService>(),
                                slug: item.product!.slug,
                              ),
                            ),
                          ),
                );
              },
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          decoration: BoxDecoration(
            color: cardColor,
            border: Border(top: BorderSide(color: borderColor)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: theme.brightness == Brightness.dark ? 0.2 : 0.04),
                blurRadius: 12,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _SummaryRow(
                  label: l10n.subtotal,
                  value: currency.format(cart.total),
                  bold: false,
                ),
                if (savedAmount > 0) ...[
                  const SizedBox(height: 6),
                  _SummaryRow(
                    label: l10n.saved,
                    value: '-${currency.format(savedAmount)}',
                    valueColor: AppColors.success,
                    bold: false,
                  ),
                ],
                const SizedBox(height: 6),
                _SummaryRow(
                  label: l10n.shipping,
                  value: l10n.shippingAtCheckout,
                  mutedValue: true,
                  bold: false,
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1, color: borderColor),
                ),
                _SummaryRow(
                  label: l10n.totalToPay,
                  value: currency.format(cart.total),
                  bold: true,
                ),
                const SizedBox(height: 10),
                Text(
                  auth.isLoggedIn ? l10n.checkoutNote : l10n.guestCartNote,
                  style: theme.textTheme.bodySmall?.copyWith(
                        color: onSurfaceVariant,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                FsButton(
                  label: auth.isLoggedIn ? l10n.proceedCheckout : l10n.signInCheckout,
                  variant: FsButtonVariant.accent,
                  icon: Icons.lock_outline,
                  onPressed: () {
                    if (!auth.isLoggedIn) {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const LoginScreen()),
                      );
                      return;
                    }
                    Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CheckoutScreen(cart: cart.cartModel),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CartPriceMeta {
  const _CartPriceMeta({
    required this.qty,
    required this.unitPaid,
    required this.unitOriginal,
    required this.linePaid,
    required this.lineOriginal,
    required this.hasDiscount,
    this.discountPercent,
  });

  final int qty;
  final double unitPaid;
  final double unitOriginal;
  final double linePaid;
  final double lineOriginal;
  final bool hasDiscount;
  final int? discountPercent;
}

class _CartItemCard extends StatelessWidget {
  const _CartItemCard({
    required this.item,
    required this.currency,
    required this.priceMeta,
    required this.onRemove,
    required this.onDecrease,
    required this.onIncrease,
    required this.onMoveToWishlist,
    this.onTap,
  });

  final CartItemModel item;
  final NumberFormat currency;
  final _CartPriceMeta priceMeta;
  final VoidCallback onRemove;
  final VoidCallback onDecrease;
  final VoidCallback onIncrease;
  final VoidCallback onMoveToWishlist;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final onSurface = cs.onSurface;
    final onSurfaceVariant = cs.onSurfaceVariant;
    final cardColor = theme.cardTheme.color ?? cs.surface;
    final borderColor = theme.dividerTheme.color ?? cs.outline;
    final product = item.product;
    final name = product?.name ?? 'Product #${item.productId}';
    final imageUrl = resolveMediaUrl(product?.imageUrl);
    final variantParts = <String>[
      if (item.size != null && item.size!.isNotEmpty) '${l10n.sizeLabel}: ${item.size}',
      if (item.color != null && item.color!.isNotEmpty) '${l10n.colorLabel}: ${item.color}',
    ];

    return Material(
      color: cardColor,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        width: 80,
                        height: 80,
                        child: imageUrl.isEmpty
                            ? ColoredBox(
                                color: cs.surfaceContainerHighest,
                                child: Icon(Icons.image_outlined, color: onSurfaceVariant),
                              )
                            : ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
                      ),
                    ),
                    const SizedBox(height: 6),
                    SizedBox(
                      width: 80,
                      child: InkWell(
                        onTap: onMoveToWishlist,
                        borderRadius: BorderRadius.circular(8),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 2),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.favorite_border, size: 12, color: onSurfaceVariant),
                              const SizedBox(width: 2),
                              Expanded(
                                child: Text(
                                  l10n.moveToWishlist,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: theme.textTheme.labelSmall?.copyWith(
                                        color: onSurfaceVariant,
                                        fontSize: 9,
                                        height: 1.1,
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                color: onSurface,
                              ),
                            ),
                          ),
                          IconButton(
                            visualDensity: VisualDensity.compact,
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                            icon: const Icon(Icons.delete_outline, color: AppColors.error, size: 20),
                            onPressed: onRemove,
                          ),
                        ],
                      ),
                      if (product?.categoryName != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          product!.categoryName!,
                          style: theme.textTheme.bodySmall?.copyWith(
                                color: onSurfaceVariant,
                              ),
                        ),
                      ],
                      if (variantParts.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          variantParts.join(' · '),
                          style: theme.textTheme.bodySmall?.copyWith(
                                color: onSurfaceVariant.withValues(alpha: 0.8),
                              ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      if (priceMeta.hasDiscount) ...[
                        Text(
                          currency.format(priceMeta.unitOriginal),
                          style: theme.textTheme.bodySmall?.copyWith(
                                color: onSurfaceVariant,
                                decoration: TextDecoration.lineThrough,
                              ),
                        ),
                        if (priceMeta.discountPercent != null)
                          Text(
                            '(${priceMeta.discountPercent}% off)',
                            style: theme.textTheme.labelSmall?.copyWith(
                                  color: onSurfaceVariant,
                                ),
                          ),
                      ],
                      Text(
                        currency.format(priceMeta.linePaid),
                        style: theme.textTheme.titleMedium?.copyWith(
                              color: priceMeta.hasDiscount ? AppColors.error : onSurface,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: borderColor),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _QtyButton(icon: Icons.remove, onTap: onDecrease, iconColor: onSurface),
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(
                                '${item.quantity}',
                                style: TextStyle(fontWeight: FontWeight.w700, color: onSurface),
                              ),
                            ),
                            _QtyButton(icon: Icons.add, onTap: onIncrease, iconColor: onSurface),
                          ],
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

class _QtyButton extends StatelessWidget {
  const _QtyButton({required this.icon, required this.onTap, required this.iconColor});

  final IconData icon;
  final VoidCallback onTap;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: SizedBox(
        width: 36,
        height: 32,
        child: Icon(icon, size: 18, color: iconColor),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({
    required this.label,
    required this.value,
    this.bold = false,
    this.valueColor,
    this.mutedValue = false,
  });

  final String label;
  final String value;
  final bool bold;
  final Color? valueColor;
  final bool mutedValue;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final onSurface = cs.onSurface;
    final onSurfaceVariant = cs.onSurfaceVariant;

    final valueStyle = bold
        ? theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, color: onSurface)
        : theme.textTheme.bodyMedium?.copyWith(
              color: mutedValue ? onSurfaceVariant : (valueColor ?? onSurface),
              fontWeight: mutedValue ? FontWeight.w500 : FontWeight.w600,
            );

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: bold
              ? theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600, color: onSurface)
              : theme.textTheme.bodyMedium?.copyWith(color: onSurfaceVariant),
        ),
        Text(value, style: valueStyle),
      ],
    );
  }
}
