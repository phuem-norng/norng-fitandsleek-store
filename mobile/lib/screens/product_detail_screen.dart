import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../l10n/app_strings.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/cart_service.dart';
import '../services/product_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/product_image.dart';

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
  static const _sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  static const _colors = [
    (Color(0xFF0EA5E9), 'Blue'),
    (Color(0xFF0F172A), 'Navy'),
    (Color(0xFF708A7C), 'Sage'),
  ];

  ProductModel? _product;
  bool _loading = true;
  String? _error;
  bool _adding = false;
  int _imageIndex = 0;
  int _colorIndex = 0;
  String? _selectedSize;
  bool _sizeError = false;
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
      if (!mounted) return;
      setState(() {
        _product = product;
        _loading = false;
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

  Future<void> _addToCart({bool buyNow = false}) async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to add items to your cart')),
      );
      return;
    }
    if (_selectedSize == null) {
      setState(() => _sizeError = true);
      return;
    }
    setState(() => _adding = true);
    try {
      await context.read<CartService>().addItem(
        productId: _product!.id,
        quantity: 1,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(buyNow ? 'Proceeding to checkout…' : 'Added to cart')),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceCard,
      body: _buildBody(),
      bottomNavigationBar: _product == null ? null : _buildBottomBar(),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        border: Border(top: BorderSide(color: AppColors.border)),
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
            Consumer2<AuthProvider, WishlistProvider>(
              builder: (context, auth, wishlist, _) {
                final saved = auth.isLoggedIn && wishlist.has(_product!.id);
                return SizedBox(
                  width: 48,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: auth.isLoggedIn ? () => wishlist.toggle(_product!.id) : null,
                    style: OutlinedButton.styleFrom(
                      padding: EdgeInsets.zero,
                      side: const BorderSide(color: AppColors.border),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Icon(
                      saved ? Icons.favorite : Icons.favorite_border,
                      color: saved ? AppColors.error : AppColors.textMuted,
                    ),
                  ),
                );
              },
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SizedBox(
                height: 48,
                child: FilledButton.icon(
                  onPressed: _adding ? null : () => _addToCart(),
                  icon: _adding
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.shopping_cart_outlined, size: 18),
                  label: const Text(AppStrings.addToCart, style: TextStyle(fontSize: 13)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: SizedBox(
                height: 48,
                child: FilledButton(
                  onPressed: _adding ? null : () => _addToCart(buyNow: true),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.storeHeader,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text(AppStrings.buyNow, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          ],
        ),
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
    final imageUrl = resolveMediaUrl(product.imageUrl);
    final currency = NumberFormat.simpleCurrency(name: 'USD');
    final price = currency.format(product.displayPrice);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 360,
          pinned: true,
          backgroundColor: AppColors.surfaceCard,
          foregroundColor: AppColors.textPrimary,
          flexibleSpace: FlexibleSpaceBar(
            background: Stack(
              fit: StackFit.expand,
              children: [
                if (imageUrl.isNotEmpty)
                  PageView(
                    controller: _pageController,
                    onPageChanged: (i) => setState(() => _imageIndex = i),
                    children: [
                      ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
                      ColoredBox(
                        color: Colors.grey.shade200,
                        child: Icon(Icons.checkroom_outlined, size: 80, color: Colors.grey.shade400),
                      ),
                    ],
                  )
                else
                  ColoredBox(
                    color: Colors.grey.shade200,
                    child: Icon(Icons.image_outlined, size: 80, color: Colors.grey.shade400),
                  ),
                Positioned(
                  bottom: 12,
                  left: 0,
                  right: 0,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(2, (i) {
                      return Container(
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: _imageIndex == i ? 10 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: _imageIndex == i ? AppColors.accent : Colors.white.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(3),
                        ),
                      );
                    }),
                  ),
                ),
              ],
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.all(20),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              const Text(
                AppStrings.brandName,
                style: TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600, fontSize: 14),
              ),
              const SizedBox(height: 6),
              Text(
                product.name,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, height: 1.2),
              ),
              if (product.categoryName != null) ...[
                const SizedBox(height: 4),
                Text(
                  product.categoryName!,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                ),
              ],
              const SizedBox(height: 14),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    price,
                    style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w800),
                  ),
                  if (product.hasDiscount) ...[
                    const SizedBox(width: 10),
                    Text(
                      currency.format(product.price!),
                      style: const TextStyle(
                        fontSize: 16,
                        color: AppColors.textMuted,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
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
                ],
              ),
              const SizedBox(height: 10),
              const Row(
                children: [
                  Icon(Icons.star, color: AppColors.warning, size: 18),
                  Icon(Icons.star, color: AppColors.warning, size: 18),
                  Icon(Icons.star, color: AppColors.warning, size: 18),
                  Icon(Icons.star, color: AppColors.warning, size: 18),
                  Icon(Icons.star_half, color: AppColors.warning, size: 18),
                  SizedBox(width: 6),
                  Text('4.5 (128 reviews)', style: TextStyle(color: AppColors.textMuted, fontSize: 13)),
                ],
              ),
              if (product.description != null && product.description!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  product.description!,
                  style: const TextStyle(color: AppColors.textSecondary, height: 1.5, fontSize: 14),
                ),
              ],
              const SizedBox(height: 24),
              const Text(AppStrings.colorLabel, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 10),
              Row(
                children: List.generate(_colors.length, (i) {
                  final (color, _) = _colors[i];
                  final selected = _colorIndex == i;
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: GestureDetector(
                      onTap: () => setState(() => _colorIndex = i),
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: color,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: selected ? AppColors.accent : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 20),
              const Text(AppStrings.sizeLabel, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _sizes.map((size) {
                  final selected = _selectedSize == size;
                  return GestureDetector(
                    onTap: () => setState(() {
                      _selectedSize = size;
                      _sizeError = false;
                    }),
                    child: Container(
                      width: 48,
                      height: 44,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: selected ? AppColors.primary : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected ? AppColors.primary : AppColors.border,
                          width: 1.5,
                        ),
                      ),
                      child: Text(
                        size,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: selected ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              if (_sizeError) ...[
                const SizedBox(height: 8),
                const Text(
                  AppStrings.selectSize,
                  style: TextStyle(color: AppColors.error, fontSize: 13),
                ),
              ],
              const SizedBox(height: 100),
            ]),
          ),
        ),
      ],
    );
  }
}
