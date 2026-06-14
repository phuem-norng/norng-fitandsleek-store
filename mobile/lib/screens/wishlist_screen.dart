import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/product_service.dart';
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadIfNeeded());
  }

  Future<void> _loadIfNeeded() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isLoggedIn) return;
    await context.read<WishlistProvider>().load();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final wishlist = context.watch<WishlistProvider>();

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

    if (wishlist.loading && wishlist.products.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (wishlist.products.isEmpty) {
      return const FsEmptyState(
        icon: Icons.favorite_border,
        title: 'Wishlist is empty',
        subtitle: 'Tap the heart on products in the shop to save them here.',
      );
    }

    return RefreshIndicator(
      onRefresh: () => context.read<WishlistProvider>().load(),
      child: GridView.builder(
        padding: const EdgeInsets.all(16),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          childAspectRatio: 0.68,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemCount: wishlist.products.length,
        itemBuilder: (context, index) {
          final product = wishlist.products[index];
          return ProductCard(
            product: product,
            isWishlisted: true,
            onWishlistToggle: () => wishlist.toggle(product.id),
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
