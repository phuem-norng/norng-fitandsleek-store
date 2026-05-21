import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../services/product_service.dart';
import '../services/wishlist_service.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/product_card.dart';
import 'login_screen.dart';
import 'product_detail_screen.dart';

class WishlistScreen extends StatefulWidget {
  const WishlistScreen({super.key});

  @override
  State<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends State<WishlistScreen> {
  List<ProductModel> _products = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) {
      setState(() {
        _loading = false;
        _products = [];
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await context.read<WishlistService>().fetchWishlist();
      if (!mounted) return;
      setState(() {
        _products = result.products;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = context.read<ApiClient>().apiMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    if (!auth.isLoggedIn) {
      return FsEmptyState(
        icon: Icons.favorite_border,
        title: 'Your wishlist',
        subtitle: 'Sign in to save items you love and sync across devices.',
        actionLabel: 'Sign in',
        onAction: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        ),
      );
    }

    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return FsEmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Could not load wishlist',
        subtitle: _error,
        actionLabel: 'Try again',
        onAction: _load,
      );
    }
    if (_products.isEmpty) {
      return const FsEmptyState(
        icon: Icons.favorite_border,
        title: 'Wishlist is empty',
        subtitle: 'Tap the heart on products in the shop to save them here.',
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.68,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: _products.length,
        itemBuilder: (context, index) {
          final product = _products[index];
          return ProductCard(
            product: product,
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) => ProductDetailScreen(
                  productService: context.read<ProductService>(),
                  slug: product.slug,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
