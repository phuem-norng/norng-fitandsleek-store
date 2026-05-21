import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../services/cart_service.dart';
import '../services/product_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_button.dart';
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
  ProductModel? _product;
  bool _loading = true;
  String? _error;
  bool _adding = false;

  @override
  void initState() {
    super.initState();
    _load();
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

  Future<void> _addToCart() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Sign in to add items to your cart')),
      );
      return;
    }
    setState(() => _adding = true);
    try {
      await context.read<CartService>().addItem(productId: _product!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Added to cart')),
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
      backgroundColor: AppColors.surface,
      appBar: AppBar(title: Text(_product?.name ?? 'Product')),
      body: _buildBody(),
      bottomNavigationBar: _product == null
          ? null
          : Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              decoration: BoxDecoration(
                color: AppColors.surfaceCard,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: SafeArea(
                top: false,
                child: FsButton(
                  label: 'Add to cart',
                  variant: FsButtonVariant.accent,
                  icon: Icons.add_shopping_cart_outlined,
                  onPressed: _adding ? null : _addToCart,
                  loading: _adding,
                ),
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
    final price = NumberFormat.simpleCurrency(name: 'USD').format(product.displayPrice);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (imageUrl.isNotEmpty)
          ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: AspectRatio(
              aspectRatio: 1,
              child: ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
            ),
          ),
        const SizedBox(height: 20),
        if (product.categoryName != null)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: AppColors.accent.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              product.categoryName!,
              style: const TextStyle(
                color: AppColors.accentDark,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ),
        const SizedBox(height: 10),
        Text(product.name, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 26)),
        const SizedBox(height: 8),
        Text(
          price,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.primary,
              ),
        ),
        if (product.description != null && product.description!.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text('Description', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          Text(
            product.description!,
            style: Theme.of(context).textTheme.bodyLarge,
          ),
        ],
        const SizedBox(height: 80),
      ],
    );
  }
}
