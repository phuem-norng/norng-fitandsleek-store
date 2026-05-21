import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/cart_model.dart';
import '../providers/auth_provider.dart';
import '../services/cart_service.dart';
import '../theme/app_colors.dart';
import '../utils/media_url.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/product_image.dart';
import 'login_screen.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  CartModel? _cart;
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
        _cart = null;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final cart = await context.read<CartService>().getCart();
      if (!mounted) return;
      setState(() {
        _cart = cart;
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

  Future<void> _remove(int itemId) async {
    await context.read<CartService>().removeItem(itemId);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    if (!auth.isLoggedIn) {
      return FsEmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'Your cart is empty',
        subtitle: 'Sign in to add items and save your bag across devices.',
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
        icon: Icons.error_outline,
        title: 'Cart unavailable',
        subtitle: _error,
        actionLabel: 'Retry',
        onAction: _load,
      );
    }

    final cart = _cart;
    if (cart == null || cart.items.isEmpty) {
      return const FsEmptyState(
        icon: Icons.shopping_bag_outlined,
        title: 'Your cart is empty',
        subtitle: 'Browse the shop and add something you love.',
      );
    }

    return Column(
      children: [
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: cart.items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = cart.items[index];
                final name = item.product?.name ?? 'Product #${item.productId}';
                final imageUrl = resolveMediaUrl(item.product?.imageUrl);
                return Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceCard,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    leading: ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox(
                        width: 56,
                        height: 56,
                        child: imageUrl.isEmpty
                            ? const ColoredBox(
                                color: Color(0xFFF1F5F9),
                                child: Icon(Icons.image_outlined, color: AppColors.textMuted),
                              )
                            : ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
                      ),
                    ),
                    title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text(
                      'Qty ${item.quantity} · ${currency.format(item.unitPrice)} each',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppColors.error),
                      onPressed: () => _remove(item.id),
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
            color: AppColors.surfaceCard,
            border: Border(top: BorderSide(color: AppColors.border)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Subtotal', style: Theme.of(context).textTheme.titleMedium),
                    Text(
                      currency.format(cart.total),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Complete checkout on the web store for full payment options.',
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 14),
                FsButton(
                  label: 'Proceed to checkout',
                  variant: FsButtonVariant.accent,
                  icon: Icons.lock_outline,
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Open the web storefront to checkout')),
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
