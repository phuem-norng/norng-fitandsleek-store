import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../models/banner_model.dart';
import '../models/brand_model.dart';
import '../models/product_model.dart';
import '../services/product_service.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/home/category_strip.dart';
import '../widgets/home/home_banner_carousel.dart';
import '../widgets/product_card.dart';
import 'product_detail_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({
    super.key,
    required this.productService,
    required this.apiClient,
    required this.searchController,
    this.showBanner = true,
  });

  final ProductService productService;
  final ApiClient apiClient;
  final TextEditingController searchController;
  final bool showBanner;

  @override
  State<ShopScreen> createState() => ShopScreenState();
}

class ShopScreenState extends State<ShopScreen> {
  final _scrollController = ScrollController();

  final List<ProductModel> _products = [];
  List<BannerModel> _banners = [];
  List<BrandModel> _brands = [];
  int? _selectedBrandId;
  String? _selectedBrandName;
  bool _filterByCategoryId = false;

  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  bool _hasMore = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
    _scrollController.addListener(_onScroll);
  }

  /// Called from [HomeShell] header search submit.
  void reloadProducts() => _loadProducts(reset: true);

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    await Future.wait([
      _loadHomeContent(),
      _loadProducts(reset: true),
    ]);
  }

  Future<void> _loadHomeContent() async {
    try {
      final banners = await widget.productService.listHomeBanners();
      var brands = await widget.productService.listBrands();
      if (brands.isEmpty) {
        final categories = await widget.productService.listCategories();
        brands = categories
            .map(
              (c) => BrandModel(
                id: c.id,
                name: c.name,
                slug: c.slug,
                logoUrl: c.imageUrl,
              ),
            )
            .toList();
        _filterByCategoryId = brands.isNotEmpty;
      } else {
        _filterByCategoryId = false;
      }
      if (!mounted) return;
      setState(() {
        _banners = banners;
        _brands = brands;
      });
    } catch (_) {
      /* banners/brands are optional — shop still works */
    }
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 240) {
      _loadMore();
    }
  }

  void _onBrandSelected(int? id) {
    BrandModel? match;
    if (id != null) {
      for (final b in _brands) {
        if (b.id == id) {
          match = b;
          break;
        }
      }
    }
    setState(() {
      _selectedBrandId = id;
      _selectedBrandName = match?.name;
    });
    _loadProducts(reset: true);
  }

  Future<void> _loadProducts({required bool reset}) async {
    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
        _hasMore = true;
      });
    }
    try {
      final page = await widget.productService.listProducts(
        page: 1,
        query: widget.searchController.text.trim(),
        brandId: _filterByCategoryId ? null : _selectedBrandId,
        categoryId: _filterByCategoryId ? _selectedBrandId : null,
      );
      if (!mounted) return;
      setState(() {
        _products
          ..clear()
          ..addAll(page.items);
        _page = page.currentPage;
        _hasMore = page.hasMore;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = widget.apiClient.apiMessage(e);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _page + 1;
      final page = await widget.productService.listProducts(
        page: nextPage,
        query: widget.searchController.text.trim(),
        brandId: _filterByCategoryId ? null : _selectedBrandId,
        categoryId: _filterByCategoryId ? _selectedBrandId : null,
      );
      if (!mounted) return;
      setState(() {
        _products.addAll(page.items);
        _page = page.currentPage;
        _hasMore = page.hasMore;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _onRefresh() async {
    await Future.wait([
      _loadHomeContent(),
      _loadProducts(reset: true),
    ]);
  }

  String get _productsSectionTitle {
    if (_selectedBrandName != null) return _selectedBrandName!;
    final q = widget.searchController.text.trim();
    if (q.isNotEmpty) return 'Results for "$q"';
    return 'All products';
  }

  @override
  Widget build(BuildContext context) => _buildBody();

  Widget _buildBody() {
    if (_loading && _products.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null && _products.isEmpty) {
      return FsEmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Could not load products',
        subtitle: _error,
        actionLabel: 'Try again',
        onAction: () => _bootstrap(),
      );
    }

    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: CustomScrollView(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (widget.showBanner)
            SliverToBoxAdapter(child: HomeBannerCarousel(banners: _banners)),
          SliverToBoxAdapter(
            child: CategoryStrip(
              brands: _brands,
              selectedId: _selectedBrandId,
              onSelected: _onBrandSelected,
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      _productsSectionTitle,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  ),
                  if (_loading)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                ],
              ),
            ),
          ),
          if (_products.isEmpty && !_loading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: FsEmptyState(
                icon: Icons.inventory_2_outlined,
                title: 'No products found',
                subtitle: 'Try another brand or search term.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 0.68,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                delegate: SliverChildBuilderDelegate(
                  (context, index) {
                    if (index >= _products.length) {
                      return const Center(
                        child: Padding(
                          padding: EdgeInsets.all(16),
                          child: CircularProgressIndicator(),
                        ),
                      );
                    }
                    final product = _products[index];
                    return ProductCard(
                      product: product,
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => ProductDetailScreen(
                            productService: widget.productService,
                            slug: product.slug,
                          ),
                        ),
                      ),
                    );
                  },
                  childCount: _products.length + (_loadingMore ? 1 : 0),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
