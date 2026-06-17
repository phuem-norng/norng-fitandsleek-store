import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../l10n/l10n_extension.dart';
import '../models/banner_model.dart';
import '../models/brand_model.dart';
import '../models/category_model.dart';
import '../models/homepage_section.dart';
import '../models/product_filters.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/homepage_sections_service.dart';
import '../services/product_service.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/home/home_product_section.dart';
import '../widgets/home/category_strip.dart';
import '../widgets/home/home_banner_carousel.dart';
import '../widgets/product_card.dart';
import '../widgets/shop/shop_filter_sheet.dart';
import '../widgets/shop/shop_listing_toolbar.dart';
import 'home_section_products_screen.dart';
import 'product_detail_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({
    super.key,
    required this.productService,
    required this.apiClient,
    this.showBanner = true,
    this.isHomeTab = false,
    this.onSectionSeeAll,
    this.onBrandBrowse,
  });

  final ProductService productService;
  final ApiClient apiClient;
  final bool showBanner;
  final bool isHomeTab;
  final ValueChanged<HomeSectionBrowse>? onSectionSeeAll;
  final ValueChanged<int?>? onBrandBrowse;

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
  ProductFilters _filters = ProductFilters();
  FilterOptionsModel? _filterOptions;
  int? _totalProducts;
  HomeSectionBrowse? _sectionBrowse;

  List<HomepageSectionData> _homeSections = [];
  List<CategoryModel> _categories = [];
  List<ProductModel> _recommended = [];
  bool _sectionsLoading = false;
  bool _recommendedLoading = false;

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
      _loadHomeSections(),
      if (!widget.isHomeTab) _loadFilterOptions(),
      if (!widget.isHomeTab) _loadProducts(reset: true),
    ]);
  }

  Future<void> _loadHomeSections() async {
    setState(() {
      _sectionsLoading = true;
      _recommendedLoading = true;
    });

    final sectionsService = HomepageSectionsService(widget.apiClient);
    try {
      final configs = await sectionsService.fetchEnabledSections();
      final categories = await widget.productService.listCategories();
      final recommended = await sectionsService.fetchRecommended();

      if (!mounted) return;
      setState(() {
        _categories = categories;
        _recommended = recommended;
        _homeSections = configs
            .map((c) => HomepageSectionData(config: c, loading: true))
            .toList();
        _recommendedLoading = false;
      });

      for (var i = 0; i < configs.length; i++) {
        final config = configs[i];
        final items = await sectionsService.loadSectionProducts(
          section: config,
          categories: categories,
        );
        if (!mounted) return;
        setState(() {
          _homeSections[i] = _homeSections[i].copyWith(items: items, loading: false);
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _homeSections = [];
        _recommended = [];
      });
    } finally {
      if (mounted) setState(() => _sectionsLoading = false);
    }
  }

  void applySectionBrowse(HomeSectionBrowse browse) {
    setState(() {
      _sectionBrowse = browse.key == 'recommended' ? null : browse;
      _filters = ProductFilters();
      if (browse.key == 'recommended') {
        _filters.sort = 'recommend';
      }
      _selectedBrandId = null;
      _selectedBrandName = browse.title;
    });
    _loadProducts(reset: true);
  }

  void selectBrand(int? id) {
    _onBrandSelected(id);
  }

  Future<void> _loadFilterOptions() async {
    try {
      final options = await widget.productService.fetchFilterOptions();
      if (!mounted) return;
      setState(() => _filterOptions = options);
    } catch (_) {
      /* optional */
    }
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
    if (widget.isHomeTab && widget.onBrandBrowse != null) {
      widget.onBrandBrowse!(id);
      return;
    }
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
        query: '',
        brandId: _filterByCategoryId ? null : _selectedBrandId,
        categoryId: _filterByCategoryId ? _selectedBrandId : null,
        filters: widget.isHomeTab ? null : _filters,
        sectionBrowse: _sectionBrowse,
      );
      if (!mounted) return;
      setState(() {
        _products
          ..clear()
          ..addAll(page.items);
        _page = page.currentPage;
        _hasMore = page.hasMore;
        _totalProducts = page.total;
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
        query: '',
        brandId: _filterByCategoryId ? null : _selectedBrandId,
        categoryId: _filterByCategoryId ? _selectedBrandId : null,
        filters: widget.isHomeTab ? null : _filters,
        sectionBrowse: _sectionBrowse,
      );
      if (!mounted) return;
      setState(() {
        _products.addAll(page.items);
        _page = page.currentPage;
        _hasMore = page.hasMore;
        _totalProducts = page.total;
        _loadingMore = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  Future<void> _onRefresh() async {
    await Future.wait([
      _loadHomeContent(),
      _loadHomeSections(),
      if (!widget.isHomeTab) ...[
        _loadFilterOptions(),
        _loadProducts(reset: true),
      ],
    ]);
  }

  Future<void> _openFilters() async {
    final result = await ShopFilterSheet.show(
      context,
      initial: _filters.copy(),
      brands: _brands,
      filterOptions: _filterOptions,
    );
    if (result == null || !mounted) return;
    setState(() => _filters = result);
    await _reloadProducts();
  }

  void _onSortChanged(String sort) {
    if (_filters.sort == sort) return;
    setState(() => _filters.sort = sort);
    _reloadProducts();
  }

  Future<void> _reloadProducts() async {
    if (_scrollController.hasClients) {
      await _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    }
    await _loadProducts(reset: true);
  }

  int get _filterActiveCount => _filters.activeCount(
        boundsMin: _filterOptions?.priceMin,
        boundsMax: _filterOptions?.priceMax,
      );

  @override
  Widget build(BuildContext context) => _buildBody();

  Widget _buildBody() {
    if (widget.isHomeTab) {
      return _buildHomeBody();
    }

    if (_error != null && _products.isEmpty && _homeSections.isEmpty && !_sectionsLoading) {
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
          if (widget.showBanner && _brands.isNotEmpty)
            SliverToBoxAdapter(
              child: CategoryStrip(
                brands: _brands,
                selectedId: _selectedBrandId,
                onSelected: _onBrandSelected,
              ),
            ),
          SliverToBoxAdapter(
            child: ShopListingToolbar(
              sort: _filters.sort,
              filterActiveCount: _filterActiveCount,
              onFilterTap: _openFilters,
              onSortChanged: _onSortChanged,
            ),
          ),
          SliverToBoxAdapter(child: _buildSectionsList()),
          if (_sectionBrowse?.title != null)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Text(
                  _sectionBrowse!.title!,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
              ),
            ),
          if (_loading && _products.isNotEmpty)
            const SliverToBoxAdapter(
              child: LinearProgressIndicator(minHeight: 2),
            ),
          if (_loading)
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.only(right: 16, bottom: 8),
                child: Align(
                  alignment: Alignment.centerRight,
                  child: SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
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
                  childAspectRatio: productCardGridAspectRatio,
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
                    return Consumer2<AuthProvider, WishlistProvider>(
                      builder: (context, auth, wishlist, _) {
                        return ProductCard(
                          layout: ProductCardLayout.imageFocus,
                          product: product,
                          isWishlisted: wishlist.has(product.id),
                          onWishlistToggle: () => wishlist.toggle(
                            product.id,
                            isLoggedIn: auth.isLoggedIn,
                            product: product,
                          ),
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

  Widget _buildHomeBody() {
    return RefreshIndicator(
      onRefresh: _onRefresh,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          if (widget.showBanner)
            SliverToBoxAdapter(child: HomeBannerCarousel(banners: _banners)),
          if (widget.showBanner && _brands.isNotEmpty)
            SliverToBoxAdapter(
              child: CategoryStrip(
                brands: _brands,
                selectedId: null,
                onSelected: _onBrandSelected,
              ),
            ),
          SliverToBoxAdapter(child: _buildSectionsList()),
          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }

  void _handleSectionSeeAll(HomeSectionBrowse browse) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => HomeSectionProductsScreen(
          browse: browse,
          productService: widget.productService,
          apiClient: widget.apiClient,
        ),
      ),
    );
  }

  Widget _buildSectionsList() {
    final sectionsService = HomepageSectionsService(widget.apiClient);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_recommendedLoading || _recommended.isNotEmpty)
          HomeProductSection(
            title: context.l10n.recommendedForYou,
            items: _recommended,
            loading: _recommendedLoading,
            productService: widget.productService,
            onSeeAll: () => _handleSectionSeeAll(
              HomeSectionBrowse(
                key: 'recommended',
                title: context.l10n.recommendedForYou,
              ),
            ),
          ),
        ..._homeSections
            .where((section) => section.loading || section.items.isNotEmpty)
            .map((section) {
          return HomeProductSection(
            title: section.config.title,
            items: section.items,
            loading: section.loading,
            productService: widget.productService,
            onSeeAll: () => _handleSectionSeeAll(
              sectionsService.browseTarget(
                section: section.config,
                categories: _categories,
              ),
            ),
          );
        }),
        if (_sectionsLoading && _homeSections.isEmpty)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        if (!widget.isHomeTab) const SizedBox(height: 4),
      ],
    );
  }
}
