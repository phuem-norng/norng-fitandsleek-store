import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../l10n/l10n_extension.dart';
import '../models/product_model.dart';
import '../navigation/open_cart_screen.dart';
import '../providers/auth_provider.dart';
import '../providers/cart_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/product_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/product_card.dart';
import '../widgets/product_image.dart';
import 'checkout_screen.dart';
import 'login_screen.dart';

const _namedColorHex = <String, Color>{
  'black': Color(0xFF171717),
  'white': Color(0xFFFAFAFA),
  'red': Color(0xFFDC2626),
  'blue': Color(0xFF2563EB),
  'green': Color(0xFF16A34A),
  'yellow': Color(0xFFEAB308),
  'orange': Color(0xFFEA580C),
  'purple': Color(0xFF9333EA),
  'pink': Color(0xFFEC4899),
  'gray': Color(0xFF6B7280),
  'grey': Color(0xFF6B7280),
  'brown': Color(0xFF78350F),
  'navy': Color(0xFF1E3A8A),
  'beige': Color(0xFFD6C8B4),
  'gold': Color(0xFFCA8A04),
  'silver': Color(0xFF94A3B8),
  'khaki': Color(0xFF854D0E),
  'cream': Color(0xFFFAF5EB),
  'teal': Color(0xFF0D9488),
  'charcoal': Color(0xFF374151),
};

Color? _colorSwatchFill(String name) {
  final key = name.toLowerCase().trim();
  if (_namedColorHex.containsKey(key)) return _namedColorHex[key];
  final first = key.split(RegExp(r'\s+')).first;
  return _namedColorHex[first];
}

({String label, String? measure}) _parseSizeLabel(String size) {
  final trimmed = size.trim();
  final open = trimmed.indexOf('(');
  if (open > 0) {
    final label = trimmed.substring(0, open).trim();
    var measure = trimmed.substring(open).trim();
    if (!measure.endsWith(')')) measure = '$measure)';
    return (label: label, measure: measure);
  }
  return (label: trimmed, measure: null);
}

bool _hasDetailContent(ProductModel product) {
  return (product.description?.trim().isNotEmpty ?? false) ||
      (product.modelInfo?.trim().isNotEmpty ?? false) ||
      (product.sku?.trim().isNotEmpty ?? false) ||
      (product.categoryName?.trim().isNotEmpty ?? false);
}

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({
    super.key,
    required this.productService,
    required this.slug,
  });

  final ProductService productService;
  final String slug;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  ProductModel? _product;
  bool _loading = true;
  String? _error;
  bool _adding = false;
  String? _selectedColor;
  String? _selectedSize;
  bool _sizeError = false;
  int _quantity = 1;
  int _activeImage = 0;
  bool _detailsExpanded = false;
  List<ProductModel> _similarProducts = [];
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _load();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final product = await widget.productService.getProduct(widget.slug);
      final similar = await _loadSimilarProducts(product);
      if (!mounted) return;
      setState(() {
        _product = product;
        _similarProducts = similar;
        _loading = false;
        _activeImage = 0;
        if (product.colorVariants.isNotEmpty) {
          _selectedColor = product.colorVariants.first.name;
        } else if (product.colors.isNotEmpty) {
          _selectedColor = product.colors.first;
        }
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.response?.data is Map
            ? (e.response!.data['message'] ?? 'Product not found').toString()
            : 'Product not found';
        _loading = false;
      });
    }
  }

  Future<List<ProductModel>> _loadSimilarProducts(ProductModel product) async {
    final categoryId = product.categoryId;
    if (categoryId == null) return const [];
    try {
      final page = await widget.productService.listProducts(
        page: 1,
        categoryId: categoryId,
      );
      return page.items.where((item) => item.id != product.id).take(4).toList();
    } catch (_) {
      return const [];
    }
  }

  void _openImageZoom(int initialIndex) {
    final imageUrls = _imageUrls;
    if (imageUrls.isEmpty) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => ProductImageZoomScreen(
          imageUrls: imageUrls,
          initialIndex: initialIndex.clamp(0, imageUrls.length - 1),
        ),
      ),
    );
  }

  List<String> get _imageUrls {
    final product = _product;
    if (product == null) return const [];
    return product.allImageUrls.map(resolveMediaUrl).where((u) => u.isNotEmpty).toList();
  }

  void _selectColor(ProductColorVariant variant) {
    setState(() {
      _selectedColor = variant.name;
      _selectedSize = null;
      _sizeError = false;
    });
    if (variant.imageUrl != null) {
      final resolved = resolveMediaUrl(variant.imageUrl);
      final index = _imageUrls.indexOf(resolved);
      if (index >= 0) _goToImage(index);
    }
  }

  void _goToImage(int index) {
    if (index < 0 || index >= _imageUrls.length) return;
    setState(() => _activeImage = index);
    if (_pageController.hasClients) {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  Future<void> _addToCart({bool buyNow = false}) async {
    final auth = context.read<AuthProvider>();
    final product = _product!;
    final sizes = product.displaySizesForColor(_selectedColor);
    if (sizes.isNotEmpty && _selectedSize == null) {
      setState(() => _sizeError = true);
      return;
    }
    setState(() => _adding = true);
    try {
      await context.read<CartProvider>().addProduct(
            isLoggedIn: auth.isLoggedIn,
            product: product,
            quantity: _quantity,
            size: _selectedSize,
            color: _selectedColor,
          );
      if (!mounted) return;

      if (buyNow && auth.isLoggedIn) {
        Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => CheckoutScreen(cart: context.read<CartProvider>().cartModel),
          ),
        );
        return;
      }

      if (buyNow && !auth.isLoggedIn) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.l10n.addedToCartSignIn),
            action: SnackBarAction(
              label: context.l10n.signIn,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
              ),
            ),
          ),
        );
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.addedToCart)),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  void _changeQuantity(int delta) {
    setState(() => _quantity = (_quantity + delta).clamp(1, 99));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final showStickyActions = !_loading && _error == null && _product != null;

    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: Stack(
        children: [
          _buildBody(),
          if (showStickyActions) _buildStickyTopActions(),
        ],
      ),
      bottomNavigationBar: _product == null ? null : _buildBottomBar(),
    );
  }

  Widget _buildStickyTopActions() {
    return Positioned(
      top: MediaQuery.paddingOf(context).top + 8,
      left: 12,
      right: 12,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _overlayIconButton(
            icon: Icons.arrow_back,
            onTap: () => Navigator.maybePop(context),
          ),
          Consumer<CartProvider>(
            builder: (context, cart, _) => _overlayIconButton(
              icon: Icons.shopping_bag_outlined,
              badge: cart.count,
              onTap: () => openCartScreen(context),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(child: Text(_error!));
    }

    final product = _product!;
    final imageUrls = _imageUrls;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    final displaySizes = product.displaySizesForColor(_selectedColor);
    final bottomInset = MediaQuery.paddingOf(context).bottom + 96;
    final l10n = context.l10n;
    const titleFontSize = 20.0;
    const titleLineHeight = 1.25;
    const titleMaxLines = 2;

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(child: _buildHeroGallery(imageUrls)),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              if ((product.brandName ?? '').isNotEmpty)
                Text(
                  product.brandName!,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: onSurface,
                  ),
                ),
              if ((product.brandName ?? '').isNotEmpty) const SizedBox(height: 6),
              SizedBox(
                height: titleFontSize * titleLineHeight * titleMaxLines,
                child: Text(
                  product.name,
                  maxLines: titleMaxLines,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: titleFontSize,
                    fontWeight: FontWeight.w700,
                    height: titleLineHeight,
                    color: onSurface,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _buildPriceRow(product, onSurface, onSurfaceVariant),
              if (product.colorVariants.isNotEmpty) ...[
                const SizedBox(height: 22),
                Text(
                  l10n.colorsAvailable,
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: onSurface),
                ),
                const SizedBox(height: 10),
                _buildColorVariants(product),
              ],
              if (displaySizes.isNotEmpty) ...[
                const SizedBox(height: 22),
                Text(
                  l10n.sizeAvailable,
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: onSurface),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: displaySizes
                      .map((size) => _buildSizeChip(
                            size: size,
                            product: product,
                            selected: _selectedSize == size,
                            onSurface: onSurface,
                            onSurfaceVariant: onSurfaceVariant,
                            onSelect: () => setState(() {
                              _selectedSize = size;
                              _sizeError = false;
                            }),
                          ))
                      .toList(),
                ),
                if (_sizeError) ...[
                  const SizedBox(height: 6),
                  Text(
                    l10n.selectSize,
                    style: const TextStyle(color: AppColors.error, fontSize: 12),
                  ),
                ],
              ],
              const SizedBox(height: 22),
              Text(
                l10n.quantityLabel,
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: onSurface),
              ),
              const SizedBox(height: 8),
              _buildQuantityStepper(onSurface),
              const SizedBox(height: 24),
              _buildInfoPanel(onSurface, onSurfaceVariant),
              const SizedBox(height: 16),
              _buildDetailsSection(product, onSurface, onSurfaceVariant),
              if (_similarProducts.isNotEmpty) ...[
                const SizedBox(height: 20),
                _buildSimilarItems(onSurface),
              ],
              SizedBox(height: bottomInset),
            ]),
          ),
        ),
      ],
    );
  }

  Widget _buildHeroGallery(List<String> imageUrls) {
    final width = MediaQuery.sizeOf(context).width;
    final heroHeight = width * 1.15;

    return SizedBox(
      height: heroHeight,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (imageUrls.isEmpty)
            ColoredBox(
              color: Colors.grey.shade200,
              child: Icon(Icons.image_outlined, size: 72, color: Colors.grey.shade400),
            )
          else
            PageView.builder(
              controller: _pageController,
              itemCount: imageUrls.length,
              physics: imageUrls.length > 1
                  ? const BouncingScrollPhysics()
                  : const NeverScrollableScrollPhysics(),
              onPageChanged: (i) => setState(() => _activeImage = i),
              itemBuilder: (_, i) => GestureDetector(
                onTap: () => _openImageZoom(i),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    ProductImage(imageUrl: imageUrls[i], fit: BoxFit.cover),
                    if (imageUrls.length > 1)
                      Positioned(
                        right: 12,
                        bottom: 12,
                        child: _overlayIconButton(
                          icon: Icons.zoom_out_map,
                          onTap: () => _openImageZoom(i),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          if (imageUrls.length > 1)
            Positioned(
              left: 0,
              right: 0,
              bottom: 14,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(imageUrls.length, (i) {
                      final active = _activeImage == i;
                      return GestureDetector(
                        onTap: () => _goToImage(i),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          margin: const EdgeInsets.symmetric(horizontal: 3),
                          width: active ? 18 : 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: active ? AppColors.primary : Colors.white.withValues(alpha: 0.65),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.45),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${_activeImage + 1} / ${imageUrls.length}',
                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _overlayIconButton({
    required IconData icon,
    required VoidCallback onTap,
    int badge = 0,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      shape: const CircleBorder(),
      elevation: 1,
      shadowColor: Colors.black26,
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 40,
          height: 40,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(icon, size: 20, color: AppColors.textPrimary),
              if (badge > 0)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(color: AppColors.error, shape: BoxShape.circle),
                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                    child: Text(
                      badge > 9 ? '9+' : '$badge',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPriceRow(ProductModel product, Color onSurface, Color muted) {
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final price = currency.format(product.displayPrice);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          price,
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: AppColors.error,
          ),
        ),
        if (product.hasDiscount) ...[
          const SizedBox(width: 10),
          Text(
            currency.format(product.price!),
            style: TextStyle(
              fontSize: 15,
              color: muted,
              decoration: TextDecoration.lineThrough,
            ),
          ),
        ],
        const Spacer(),
        if (product.hasDiscount)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.error,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              '-${product.discountPercent}%',
              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }

  Widget _buildSizeChip({
    required String size,
    required ProductModel product,
    required bool selected,
    required Color onSurface,
    required Color onSurfaceVariant,
    required VoidCallback onSelect,
  }) {
    final parsed = _parseSizeLabel(size);
    final usesMatrix = product.variantLotPrices.isNotEmpty;
    final qty = product.sellableQtyForOption(
      isSize: true,
      option: size,
      otherSelected: _selectedColor,
    );
    final soldOut = usesMatrix && qty != null && qty <= 0;
    final textColor = soldOut
        ? onSurfaceVariant
        : selected
            ? Colors.white
            : onSurface;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: soldOut ? null : onSelect,
        borderRadius: BorderRadius.circular(10),
        child: Ink(
          width: parsed.measure != null ? 62 : 48,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          decoration: BoxDecoration(
            color: soldOut
                ? onSurfaceVariant.withValues(alpha: 0.08)
                : selected
                    ? AppColors.primary
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: soldOut
                  ? AppColors.border
                  : selected
                      ? AppColors.primary
                      : AppColors.border,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                parsed.label,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  height: 1.1,
                  color: textColor,
                ),
              ),
              if (parsed.measure != null) ...[
                const SizedBox(height: 2),
                Text(
                  parsed.measure!,
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    fontSize: 10,
                    height: 1.1,
                    color: textColor.withValues(alpha: soldOut ? 0.7 : 0.85),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildColorVariants(ProductModel product) {
    return Wrap(
      spacing: 12,
      runSpacing: 10,
      children: product.colorVariants.map((variant) {
        final selected = _selectedColor == variant.name;
        final fill = _colorSwatchFill(variant.name);
        final imageUrl = variant.imageUrl != null ? resolveMediaUrl(variant.imageUrl!) : '';

        return GestureDetector(
          onTap: () => _selectColor(variant),
          child: SizedBox(
            width: 72,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: selected ? AppColors.primary : AppColors.border,
                      width: selected ? 2 : 1,
                    ),
                    color: fill ?? Colors.grey.shade200,
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: imageUrl.isNotEmpty
                      ? ProductImage(imageUrl: imageUrl, fit: BoxFit.cover)
                      : (fill == null ? CustomPaint(painter: _DiagonalStripePainter()) : null),
                ),
                const SizedBox(height: 6),
                Text(
                  variant.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? AppColors.primary : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildQuantityStepper(Color onSurface) {
    return SizedBox(
      width: 132,
      height: 44,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(child: _quantityButton(Icons.remove, () => _changeQuantity(-1), onSurface)),
            Container(width: 1, color: AppColors.border),
            Expanded(
              child: Center(
                child: Text(
                  '$_quantity',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: onSurface),
                ),
              ),
            ),
            Container(width: 1, color: AppColors.border),
            Expanded(child: _quantityButton(Icons.add, () => _changeQuantity(1), onSurface)),
          ],
        ),
      ),
    );
  }

  Widget _quantityButton(IconData icon, VoidCallback onTap, Color color) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Center(child: Icon(icon, size: 18, color: color)),
      ),
    );
  }

  Widget _buildBottomBar() {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 12,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: SafeArea(
        top: false,
        child: Row(
          children: [
            Expanded(
              child: SizedBox(
                height: 50,
                child: FilledButton.icon(
                  onPressed: _adding ? null : () => _addToCart(),
                  icon: _adding
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.shopping_bag_outlined, size: 20),
                  label: Text(l10n.addToCart, style: const TextStyle(fontWeight: FontWeight.w700)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            Consumer2<AuthProvider, WishlistProvider>(
              builder: (context, auth, wishlist, _) {
                final saved = wishlist.has(_product!.id);
                return SizedBox(
                  width: 50,
                  height: 50,
                  child: OutlinedButton(
                    onPressed: () => wishlist.toggle(
                      _product!.id,
                      isLoggedIn: auth.isLoggedIn,
                      product: _product,
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Icon(
                      saved ? Icons.favorite : Icons.favorite_border,
                      color: saved ? AppColors.storeHeader : onSurface,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoPanel(Color onSurface, Color muted) {
    final l10n = context.l10n;
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _infoRow(
            icon: Icons.local_shipping_outlined,
            title: l10n.fastDelivery,
            subtitle: l10n.fastDeliverySub,
            onSurface: onSurface,
            muted: muted,
            showDivider: true,
          ),
          _infoRow(
            icon: Icons.support_agent_outlined,
            title: l10n.supportHotline,
            subtitle: l10n.supportHotlineSub,
            onSurface: onSurface,
            muted: muted,
            showDivider: true,
          ),
          _infoRow(
            icon: Icons.credit_card_outlined,
            title: l10n.easyPayment,
            subtitle: l10n.easyPaymentSub,
            onSurface: onSurface,
            muted: muted,
            showDivider: false,
          ),
        ],
      ),
    );
  }

  Widget _infoRow({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color onSurface,
    required Color muted,
    required bool showDivider,
  }) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 22, color: onSurface),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: onSurface),
                    ),
                    const SizedBox(height: 2),
                    Text(subtitle, style: TextStyle(fontSize: 12, color: muted)),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (showDivider) const Divider(height: 1, thickness: 1, color: AppColors.border),
      ],
    );
  }

  Widget _buildDetailsSection(ProductModel product, Color onSurface, Color muted) {
    final l10n = context.l10n;
    final hasContent = _hasDetailContent(product);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => setState(() => _detailsExpanded = !_detailsExpanded),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
          color: Theme.of(context).colorScheme.surface,
        ),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                        l10n.productDetails,
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: onSurface),
                    ),
                  ),
                  Icon(
                    _detailsExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: muted,
                  ),
                ],
              ),
            ),
            if (_detailsExpanded) ...[
              const Divider(height: 1, thickness: 1, color: AppColors.border),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                child: hasContent
                    ? Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (product.sku != null && product.sku!.trim().isNotEmpty) ...[
                            Text(
                              '${l10n.skuLabel}: ${product.sku!.trim()}',
                              style: TextStyle(fontSize: 12, color: muted, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 8),
                          ],
                          if (product.categoryName != null && product.categoryName!.trim().isNotEmpty) ...[
                            Text(
                              '${l10n.categoryLabel}: ${product.categoryName!.trim()}',
                              style: TextStyle(fontSize: 12, color: muted, fontWeight: FontWeight.w600),
                            ),
                            const SizedBox(height: 8),
                          ],
                          if (product.modelInfo != null && product.modelInfo!.trim().isNotEmpty) ...[
                            Text(
                              l10n.modelInfo,
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: onSurface),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              product.modelInfo!.trim(),
                              style: TextStyle(color: muted, height: 1.5, fontSize: 14),
                            ),
                            const SizedBox(height: 12),
                          ],
                          if (product.description != null && product.description!.trim().isNotEmpty)
                            Text(
                              product.description!.trim(),
                              style: TextStyle(color: muted, height: 1.5, fontSize: 14),
                            ),
                        ],
                      )
                    : Text(
                        l10n.noProductDetails,
                        style: TextStyle(color: muted, height: 1.5, fontSize: 14),
                      ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSimilarItems(Color onSurface) {
    final l10n = context.l10n;
    final items = _similarProducts;
    final rows = <Widget>[];

    for (var i = 0; i < items.length; i += 2) {
      if (i > 0) rows.add(const SizedBox(height: 12));
      rows.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _buildSimilarCard(items[i])),
            const SizedBox(width: 12),
            Expanded(
              child: i + 1 < items.length
                  ? _buildSimilarCard(items[i + 1])
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.similarItems,
          style: TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: 18,
            height: 1.2,
            color: onSurface,
          ),
        ),
        const SizedBox(height: 4),
        ...rows,
      ],
    );
  }

  Widget _buildSimilarCard(ProductModel item) {
    return AspectRatio(
      aspectRatio: productCardGridAspectRatio,
      child: Consumer2<AuthProvider, WishlistProvider>(
        builder: (context, auth, wishlist, _) {
          return ProductCard(
            product: item,
            layout: ProductCardLayout.imageFocus,
            isWishlisted: wishlist.has(item.id),
            onWishlistToggle: () => wishlist.toggle(
              item.id,
              isLoggedIn: auth.isLoggedIn,
              product: item,
            ),
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ProductDetailScreen(
                    productService: widget.productService,
                    slug: item.slug,
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class ProductImageZoomScreen extends StatefulWidget {
  const ProductImageZoomScreen({
    super.key,
    required this.imageUrls,
    required this.initialIndex,
  });

  final List<String> imageUrls;
  final int initialIndex;

  @override
  State<ProductImageZoomScreen> createState() => _ProductImageZoomScreenState();
}

class _ProductImageZoomScreenState extends State<ProductImageZoomScreen> {
  late final PageController _pageController;
  late int _activeIndex;

  @override
  void initState() {
    super.initState();
    _activeIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final urls = widget.imageUrls;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            itemCount: urls.length,
            onPageChanged: (i) => setState(() => _activeIndex = i),
            itemBuilder: (_, i) {
              return InteractiveViewer(
                minScale: 1,
                maxScale: 4,
                panEnabled: true,
                scaleEnabled: true,
                child: Center(
                  child: ProductImage(
                    imageUrl: urls[i],
                    fit: BoxFit.contain,
                  ),
                ),
              );
            },
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            left: 12,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => Navigator.of(context).pop(),
                child: const SizedBox(
                  width: 40,
                  height: 40,
                  child: Icon(Icons.close, color: Colors.white),
                ),
              ),
            ),
          ),
          if (urls.length > 1)
            Positioned(
              top: MediaQuery.paddingOf(context).top + 16,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(
                    '${_activeIndex + 1} / ${urls.length}',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DiagonalStripePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFE4E4E7)
      ..strokeWidth = 1;
    const step = 8.0;
    for (var i = -size.height; i < size.width + size.height; i += step) {
      canvas.drawLine(Offset(i, 0), Offset(i + size.height, size.height), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
