import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../l10n/l10n_extension.dart';
import '../models/category_model.dart';
import '../models/collection_model.dart';
import '../models/homepage_section.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/product_service.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/product_card.dart';
import '../widgets/search/search_discovery_panel.dart';
import 'image_search_screen.dart';
import 'product_detail_screen.dart';

class _SearchBrowse {
  const _SearchBrowse({
    this.tab,
    this.parentCategory,
    this.categoryId,
    this.categorySlug,
    this.title,
  });

  final String? tab;
  final String? parentCategory;
  final int? categoryId;
  final String? categorySlug;
  final String? title;

  static const empty = _SearchBrowse();

  bool get isActive =>
      (tab != null && tab!.isNotEmpty) ||
      (parentCategory != null && parentCategory!.isNotEmpty) ||
      categoryId != null ||
      (categorySlug != null && categorySlug!.isNotEmpty);

  HomeSectionBrowse? toSectionBrowse() {
    if (!isActive) return null;
    return HomeSectionBrowse(
      key: 'search',
      title: title,
      tab: tab,
      parentCategory: parentCategory,
      categorySlug: categorySlug,
      categoryId: categoryId,
    );
  }
}

class SearchTabScreen extends StatefulWidget {
  const SearchTabScreen({
    super.key,
    required this.productService,
    required this.apiClient,
  });

  final ProductService productService;
  final ApiClient apiClient;

  @override
  State<SearchTabScreen> createState() => SearchTabScreenState();
}

class SearchTabScreenState extends State<SearchTabScreen> {
  final _searchController = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();

  final List<ProductModel> _products = [];
  List<CollectionModel> _collections = CollectionModel.fallbackTiles();
  List<CategoryModel> _categories = [];
  bool _collectionsLoading = true;
  bool _loading = false;
  bool _loadingMore = false;
  String? _error;
  int _page = 1;
  bool _hasMore = true;
  String _lastQuery = '';
  _SearchBrowse _browse = _SearchBrowse.empty;
  String? _resultsTitle;

  bool get _hasActiveSearch =>
      _searchController.text.trim().isNotEmpty || _browse.isActive;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onSearchFocusChanged);
    _scrollController.addListener(_onScroll);
    _loadDiscoveryData();
  }

  void _onSearchFocusChanged() => setState(() {});

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _loadDiscoveryData() async {
    setState(() => _collectionsLoading = true);
    try {
      final results = await Future.wait([
        widget.productService.listCollections(),
        widget.productService.listCategories(),
      ]);
      if (!mounted) return;
      final categories = (results[1] as List<CategoryModel>)
          .where((c) => (c.type ?? '').toLowerCase() != 'brand')
          .toList();
      setState(() {
        _collections = results[0] as List<CollectionModel>;
        _categories = categories;
        _collectionsLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _collectionsLoading = false);
    }
  }

  /// Dismiss keyboard — search field focuses only when user taps it.
  void unfocusSearch() {
    _focusNode.unfocus();
  }

  void _onScroll() {
    if (!_hasMore || _loadingMore || _loading) return;
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 240) {
      _loadMore();
    }
  }

  void _clearSearch() {
    _searchController.clear();
    setState(() {
      _browse = _SearchBrowse.empty;
      _products.clear();
      _error = null;
      _loading = false;
      _hasMore = false;
      _lastQuery = '';
      _resultsTitle = null;
    });
    _focusNode.unfocus();
  }

  Future<void> search() async {
    await _loadProducts(reset: true);
  }

  void _runPopularTerm(String value, {required bool isNewIn}) {
    _focusNode.unfocus();
    final l10n = context.l10n;
    if (isNewIn) {
      _searchController.clear();
      setState(() {
        _browse = _SearchBrowse(tab: 'new', title: l10n.newIn);
        _resultsTitle = l10n.newIn;
      });
    } else {
      _searchController.text = value;
      setState(() {
        _browse = _SearchBrowse.empty;
        _resultsTitle = value;
      });
    }
    search();
  }

  void _runCollection(CollectionModel collection) {
    _focusNode.unfocus();
    _searchController.clear();
    setState(() {
      _browse = _SearchBrowse(
        parentCategory: collection.parentCategory,
        title: collection.name,
      );
      _resultsTitle = collection.name;
    });
    search();
  }

  void _runCategory(CategoryModel category) {
    _focusNode.unfocus();
    _searchController.clear();
    setState(() {
      _browse = _SearchBrowse(
        categoryId: category.id,
        categorySlug: category.slug,
        title: category.name,
      );
      _resultsTitle = category.name;
    });
    search();
  }

  Future<void> _loadProducts({required bool reset}) async {
    final query = _searchController.text.trim();
    if (query.isEmpty && !_browse.isActive) {
      setState(() {
        _products.clear();
        _error = null;
        _loading = false;
        _hasMore = false;
        _lastQuery = '';
        _resultsTitle = null;
      });
      return;
    }

    if (reset) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
        _hasMore = true;
        _lastQuery = query;
        if (_resultsTitle == null && query.isNotEmpty) {
          _resultsTitle = query;
        }
      });
    }

    try {
      final page = await widget.productService.listProducts(
        page: 1,
        query: query.isEmpty ? null : query,
        categoryId: _browse.categoryId,
        sectionBrowse: _browse.toSectionBrowse(),
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
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || (_lastQuery.isEmpty && !_browse.isActive)) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _page + 1;
      final page = await widget.productService.listProducts(
        page: nextPage,
        query: _lastQuery.isEmpty ? null : _lastQuery,
        categoryId: _browse.categoryId,
        sectionBrowse: _browse.toSectionBrowse(),
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

  Widget _buildSearchBar(BuildContext context) {
    final l10n = context.l10n;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final focused = _focusNode.hasFocus;

    final fill = isDark
        ? (focused ? const Color(0xFF334155) : const Color(0xFF1E293B))
        : Colors.white;
    final borderColor = focused
        ? AppColors.storeHeader.withValues(alpha: isDark ? 0.9 : 0.55)
        : (isDark ? const Color(0xFF475569) : AppColors.border);
    final hintColor = isDark ? Colors.white.withValues(alpha: 0.52) : const Color(0xFF71717A);
    final iconColor = isDark ? Colors.white.withValues(alpha: 0.78) : const Color(0xFF52525B);
    final textColor = isDark ? Colors.white : const Color(0xFF18181B);
    final dividerColor = isDark ? Colors.white.withValues(alpha: 0.14) : const Color(0xFFE4E4E7);

    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      curve: Curves.easeOut,
      height: 44,
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor, width: focused ? 1.5 : 1),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.05),
                  blurRadius: 4,
                  offset: const Offset(0, 1),
                ),
              ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          Icon(Icons.search_rounded, size: 20, color: iconColor),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _focusNode,
              onSubmitted: (_) {
                setState(() {
                  _browse = _SearchBrowse.empty;
                  _resultsTitle = _searchController.text.trim();
                });
                search();
              },
              textInputAction: TextInputAction.search,
              cursorColor: AppColors.storeHeader,
              style: TextStyle(
                fontSize: 14,
                color: textColor,
                fontWeight: FontWeight.w400,
                height: 1.25,
              ),
              decoration: InputDecoration(
                isCollapsed: true,
                hintText: l10n.searchPlaceholder,
                hintStyle: TextStyle(
                  fontSize: 14,
                  color: hintColor,
                  fontWeight: FontWeight.w400,
                ),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                disabledBorder: InputBorder.none,
                errorBorder: InputBorder.none,
                focusedErrorBorder: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
          ),
          if (_hasActiveSearch)
            IconButton(
              onPressed: _clearSearch,
              icon: Icon(Icons.close_rounded, color: iconColor, size: 20),
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.symmetric(horizontal: 6),
              constraints: const BoxConstraints(minWidth: 36, minHeight: 36),
            ),
          Container(
            width: 1,
            height: 22,
            margin: const EdgeInsets.symmetric(horizontal: 2),
            color: dividerColor,
          ),
          IconButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ImageSearchScreen()),
            ),
            icon: Icon(Icons.photo_camera_outlined, color: iconColor, size: 20),
            visualDensity: VisualDensity.compact,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: _buildSearchBar(context),
        ),
        Expanded(child: _buildBody()),
      ],
    );
  }

  Widget _buildBody() {
    if (!_hasActiveSearch) {
      return SearchDiscoveryPanel(
        collections: _collections,
        categories: _categories,
        collectionsLoading: _collectionsLoading,
        onPopularTermTap: _runPopularTerm,
        onCollectionTap: _runCollection,
        onCategoryTap: _runCategory,
      );
    }

    if (_loading && _products.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null && _products.isEmpty) {
      return FsEmptyState(
        icon: Icons.cloud_off_outlined,
        title: 'Search unavailable',
        subtitle: _error,
        actionLabel: 'Retry',
        onAction: search,
      );
    }

    if (_products.isEmpty) {
      return FsEmptyState(
        icon: Icons.search_off_outlined,
        title: 'No products found',
        subtitle: _resultsTitle != null
            ? 'Try another keyword or browse popular items.'
            : 'Type a product name and press search.',
        actionLabel: 'Clear',
        onAction: _clearSearch,
        minimal: true,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (_resultsTitle != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _resultsTitle!,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                TextButton(
                  onPressed: _clearSearch,
                  child: const Text('Clear'),
                ),
              ],
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: search,
            child: GridView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: productCardGridAspectRatio,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: _products.length + (_loadingMore ? 1 : 0),
              itemBuilder: (context, index) {
                if (index >= _products.length) {
                  return const Center(child: CircularProgressIndicator());
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
            ),
          ),
        ),
      ],
    );
  }
}
