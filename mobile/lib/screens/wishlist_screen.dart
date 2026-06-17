import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/product_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/product_image.dart';
import '../widgets/product_card.dart';
import '../widgets/wishlist/variant_picker_sheet.dart';
import 'product_detail_screen.dart';

class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  static const _imageWidth = 126.0;
  static const _imageHeight = 214.0;

  final Map<int, String?> _selectedSize = {};
  final Map<int, String?> _selectedColor = {};
  final Map<int, ProductModel> _productDetails = {};

  Future<ProductModel> _productWithStock(ProductModel product) async {
    final cached = _productDetails[product.id];
    if (cached != null && cached.variantLotPrices.isNotEmpty) return cached;

    try {
      final detail = await context.read<ProductService>().getProduct(product.slug);
      final merged = product.mergeDetail(detail);
      _productDetails[product.id] = merged;
      return merged;
    } catch (_) {
      return cached ?? product;
    }
  }

  Future<void> _openVariantPicker({
    required ProductModel product,
    required VariantPickerKind kind,
    required String? currentValue,
    required String? otherValue,
    required List<String> options,
    required ValueChanged<String?> onChanged,
  }) async {
    if (options.isEmpty) return;

    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    final stockedProduct = await _productWithStock(product);
    if (mounted) Navigator.of(context, rootNavigator: true).pop();

    if (!mounted) return;

    final picked = await VariantPickerSheet.show(
      context,
      kind: kind,
      product: stockedProduct,
      options: options,
      selectedValue: currentValue,
      otherSelectedValue: otherValue,
    );

    if (picked != null) onChanged(picked);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    await context.read<WishlistProvider>().load(isLoggedIn: auth.isLoggedIn);
  }

  Future<void> _addToCart({
    required int productId,
    required bool isLoggedIn,
  }) async {
    final wishlist = context.read<WishlistProvider>();
    final product = wishlist.products.firstWhere((p) => p.id == productId);

    final hasSizes = product.sizes.isNotEmpty;
    final size = _selectedSize[productId];
    final color = _selectedColor[productId];

    if (hasSizes && (size == null || size.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('សូមជ្រើសរើសទំហំសិន')),
      );
      return;
    }

    await context.read<CartProvider>().addProduct(
          isLoggedIn: isLoggedIn,
          product: product,
          quantity: 1,
          size: hasSizes ? size : null,
          color: (color != null && color.isNotEmpty) ? color : null,
        );

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('បានដាក់ទៅកន្ត្រក')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final auth = context.watch<AuthProvider>();
    final wishlist = context.watch<WishlistProvider>();
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    if (wishlist.loading && wishlist.products.isEmpty && wishlist.count == 0) {
      return const Center(child: CircularProgressIndicator());
    }

    if (wishlist.products.isEmpty) {
      return FsEmptyState(
        icon: Icons.favorite_border,
        title: l10n.wishlistEmpty,
        subtitle: l10n.wishlistEmptySubtitle,
        minimal: true,
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
        itemCount: wishlist.products.length,
        itemBuilder: (context, index) {
          final product = wishlist.products[index];
          _selectedSize.putIfAbsent(
            product.id,
            () => product.sizes.length == 1 ? product.sizes.first : null,
          );
          _selectedColor.putIfAbsent(
            product.id,
            () => product.colors.length == 1 ? product.colors.first : null,
          );

          final selectedSize = _selectedSize[product.id];
          final selectedColor = _selectedColor[product.id];
          final theme = Theme.of(context);
          final cardColor = theme.cardTheme.color ?? theme.colorScheme.surface;
          final onSurface = theme.colorScheme.onSurface;
          final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;

          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            decoration: BoxDecoration(
              color: cardColor,
              borderRadius: productCardRadius,
            ),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    InkWell(
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ProductDetailScreen(
                            productService: context.read<ProductService>(),
                            slug: product.slug,
                          ),
                        ),
                      ),
                      child: SizedBox(
                        width: _imageWidth,
                        height: _imageHeight,
                        child: Stack(
                          children: [
                            Positioned.fill(
                              child: ClipRRect(
                                borderRadius: productCardRadius,
                                child: ProductImage(
                                  imageUrl: resolveMediaUrl(product.imageUrl),
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                            if (product.discountPercent != null)
                              Positioned(
                                top: 0,
                                left: 0,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.error,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${product.discountPercent}%',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
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
                                  child: product.hasDiscount
                                      ? Row(
                                          children: [
                                            Text(
                                              currency.format(product.displayPrice),
                                              style: const TextStyle(
                                                color: AppColors.error,
                                                fontSize: 20,
                                                fontWeight: FontWeight.w700,
                                                height: 1.1,
                                              ),
                                            ),
                                            const SizedBox(width: 8),
                                            Text(
                                              currency.format(product.price ?? product.displayPrice),
                                              style: TextStyle(
                                                fontSize: 14,
                                                color: onSurfaceVariant,
                                                decoration: TextDecoration.lineThrough,
                                                height: 1.1,
                                              ),
                                            ),
                                          ],
                                        )
                                      : Text(
                                          currency.format(product.displayPrice),
                                          style: const TextStyle(
                                            color: AppColors.error,
                                            fontSize: 20,
                                            fontWeight: FontWeight.w700,
                                            height: 1.1,
                                          ),
                                        ),
                                ),
                                IconButton(
                                  padding: EdgeInsets.zero,
                                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                  alignment: Alignment.center,
                                  onPressed: () => wishlist.toggle(
                                    product.id,
                                    isLoggedIn: auth.isLoggedIn,
                                    product: product,
                                  ),
                                  icon: Icon(Icons.delete_outline, color: onSurfaceVariant, size: 20),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              product.name,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: onSurface,
                                fontSize: 15,
                                fontWeight: FontWeight.w500,
                                height: 1.35,
                              ),
                            ),
                            if (product.colors.isNotEmpty || product.sizes.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  if (product.colors.isNotEmpty)
                                    Expanded(
                                      child: _VariantPickerColumn(
                                        label: l10n.colorLabel,
                                        value: selectedColor,
                                        options: product.colors,
                                        placeholder: 'ជ្រើសរើស',
                                        onTap: () => _openVariantPicker(
                                          product: product,
                                          kind: VariantPickerKind.color,
                                          currentValue: selectedColor,
                                          otherValue: selectedSize,
                                          options: product.colors,
                                          onChanged: (value) => setState(() => _selectedColor[product.id] = value),
                                        ),
                                      ),
                                    ),
                                  if (product.colors.isNotEmpty && product.sizes.isNotEmpty)
                                    const SizedBox(width: 10),
                                  if (product.sizes.isNotEmpty)
                                    Expanded(
                                      child: _VariantPickerColumn(
                                        label: l10n.sizeLabel,
                                        value: selectedSize,
                                        options: product.sizes,
                                        placeholder: 'ជ្រើសរើស',
                                        onTap: () => _openVariantPicker(
                                          product: product,
                                          kind: VariantPickerKind.size,
                                          currentValue: selectedSize,
                                          otherValue: selectedColor,
                                          options: product.sizes,
                                          onChanged: (value) => setState(() => _selectedSize[product.id] = value),
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: () => _addToCart(
                      productId: product.id,
                      isLoggedIn: auth.isLoggedIn,
                    ),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.storeHeader,
                    ),
                    child: Text(l10n.addToCart),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _VariantPickerColumn extends StatelessWidget {
  const _VariantPickerColumn({
    required this.label,
    required this.value,
    required this.options,
    required this.placeholder,
    required this.onTap,
  });

  final String label;
  final String? value;
  final List<String> options;
  final String placeholder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;
    final onSurfaceVariant = theme.colorScheme.onSurfaceVariant;
    final display = (value != null && value!.isNotEmpty) ? value! : placeholder;
    final isPlaceholder = value == null || value!.isEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            color: onSurface.withValues(alpha: 0.72),
          ),
        ),
        const SizedBox(height: 4),
        InkWell(
          onTap: options.isEmpty ? null : onTap,
          borderRadius: BorderRadius.circular(4),
          child: InputDecorator(
            isEmpty: isPlaceholder,
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              filled: true,
              fillColor: theme.colorScheme.surface,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              suffixIcon: Icon(Icons.keyboard_arrow_down, size: 18, color: onSurfaceVariant),
              suffixIconConstraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            ),
            child: Text(
              display,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13,
                color: isPlaceholder ? onSurfaceVariant : onSurface,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
