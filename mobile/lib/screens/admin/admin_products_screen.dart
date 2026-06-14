import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../services/admin_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/media_url.dart';
import '../../widgets/common/fs_empty_state.dart';
import '../../widgets/product_image.dart';
import 'admin_product_edit_screen.dart';

class AdminProductsScreen extends StatefulWidget {
  const AdminProductsScreen({super.key});

  @override
  State<AdminProductsScreen> createState() => _AdminProductsScreenState();
}

class _AdminProductsScreenState extends State<AdminProductsScreen> {
  final _searchController = TextEditingController();
  final List<AdminProductModel> _products = [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
        _hasMore = true;
        _products.clear();
      });
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final service = AdminService(context.read<ApiClient>());
      final result = await service.listProducts(
        page: _page,
        query: _searchController.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        _products.addAll(result.items);
        _hasMore = result.hasMore;
        _page = result.currentPage + 1;
        _loading = false;
        _loadingMore = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = context.read<ApiClient>().apiMessage(e);
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search products',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: () => _load(reset: true),
                ),
              ),
              onSubmitted: (_) => _load(reset: true),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? FsEmptyState(
                        icon: Icons.inventory_2_outlined,
                        title: 'Could not load products',
                        subtitle: _error,
                        actionLabel: 'Retry',
                        onAction: () => _load(reset: true),
                      )
                    : _products.isEmpty
                        ? const FsEmptyState(
                            icon: Icons.inventory_2_outlined,
                            title: 'No products',
                            subtitle: 'Products you add on web will appear here.',
                          )
                        : RefreshIndicator(
                            onRefresh: () => _load(reset: true),
                            child: ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: _products.length + (_hasMore ? 1 : 0),
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                if (index >= _products.length) {
                                  if (_loadingMore) {
                                    return const Padding(
                                      padding: EdgeInsets.all(16),
                                      child: Center(child: CircularProgressIndicator()),
                                    );
                                  }
                                  _load();
                                  return const SizedBox.shrink();
                                }
                                final product = _products[index];
                                final imageUrl = resolveMediaUrl(product.imageUrl);
                                return Material(
                                  color: AppColors.surfaceCard,
                                  borderRadius: BorderRadius.circular(14),
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(14),
                                    onTap: () async {
                                      final updated = await Navigator.of(context).push<bool>(
                                        MaterialPageRoute(
                                          builder: (_) => AdminProductEditScreen(productId: product.id),
                                        ),
                                      );
                                      if (updated == true) _load(reset: true);
                                    },
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        border: Border.all(color: AppColors.border),
                                        borderRadius: BorderRadius.circular(14),
                                      ),
                                      child: Row(
                                        children: [
                                          if (imageUrl.isNotEmpty)
                                            ClipRRect(
                                              borderRadius: BorderRadius.circular(8),
                                              child: SizedBox(
                                                width: 48,
                                                height: 48,
                                                child: ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
                                              ),
                                            ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(product.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                                                Text(
                                                  '${currency.format(product.price)} · Stock ${product.stock}',
                                                  style: Theme.of(context).textTheme.bodySmall,
                                                ),
                                              ],
                                            ),
                                          ),
                                          Icon(
                                            product.isActive ? Icons.check_circle : Icons.pause_circle_outline,
                                            color: product.isActive ? AppColors.success : AppColors.textMuted,
                                            size: 20,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                          ),
          ),
        ],
      ),
    );
  }
}
