import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../models/product_model.dart';
import '../providers/auth_provider.dart';
import '../providers/wishlist_provider.dart';
import '../services/image_search_service.dart';
import '../services/product_service.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/common/fs_empty_state.dart';
import '../widgets/product_card.dart';
import 'product_detail_screen.dart';

class ImageSearchScreen extends StatefulWidget {
  const ImageSearchScreen({super.key});

  @override
  State<ImageSearchScreen> createState() => _ImageSearchScreenState();
}

class _ImageSearchScreenState extends State<ImageSearchScreen> {
  final _picker = ImagePicker();
  File? _sourceImage;
  List<ProductModel> _results = [];
  String _step = 'input';
  String? _error;

  Future<void> _pick(ImageSource source) async {
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1280,
        maxHeight: 1280,
        imageQuality: 85,
      );
      if (file == null) return;
      await _search(File(file.path));
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _step = 'input';
      });
    }
  }

  Future<void> _search(File image) async {
    setState(() {
      _sourceImage = image;
      _step = 'loading';
      _error = null;
      _results = [];
    });

    try {
      final result = await context.read<ImageSearchService>().searchByImage(image);
      if (!mounted) return;
      setState(() {
        _results = result.products;
        _step = 'results';
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = context.read<ApiClient>().apiMessage(e);
        _step = 'input';
      });
    }
  }

  void _reset() {
    setState(() {
      _sourceImage = null;
      _results = [];
      _step = 'input';
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Image search'),
        actions: [
          if (_step == 'results')
            IconButton(icon: const Icon(Icons.refresh), onPressed: _reset),
        ],
      ),
      body: switch (_step) {
        'loading' => const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                CircularProgressIndicator(),
                SizedBox(height: 16),
                Text('Finding similar products…'),
                SizedBox(height: 4),
                Text('This can take up to a minute', style: TextStyle(fontSize: 12)),
              ],
            ),
          ),
        'results' => _buildResults(),
        _ => _buildInput(),
      },
    );
  }

  Widget _buildInput() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          'Search by photo',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 8),
        Text(
          'Take a photo or upload an image to find matching products in our catalog.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: TextStyle(color: AppColors.error)),
        ],
        const SizedBox(height: 28),
        FsButton(
          label: 'Take photo',
          icon: Icons.camera_alt_outlined,
          variant: FsButtonVariant.accent,
          onPressed: () => _pick(ImageSource.camera),
        ),
        const SizedBox(height: 12),
        FsButton(
          label: 'Choose from gallery',
          icon: Icons.photo_library_outlined,
          variant: FsButtonVariant.outline,
          onPressed: () => _pick(ImageSource.gallery),
        ),
      ],
    );
  }

  Widget _buildResults() {
    if (_results.isEmpty) {
      return FsEmptyState(
        icon: Icons.search_off_outlined,
        title: 'No matches found',
        subtitle: 'Try another angle or a clearer photo.',
        actionLabel: 'Search again',
        onAction: _reset,
      );
    }

    return CustomScrollView(
      slivers: [
        if (_sourceImage != null)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.file(_sourceImage!, height: 140, width: double.infinity, fit: BoxFit.cover),
              ),
            ),
          ),
        SliverPadding(
          padding: const EdgeInsets.all(16),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.68,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
            ),
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final product = _results[index];
                return Consumer2<AuthProvider, WishlistProvider>(
                  builder: (context, auth, wishlist, _) {
                    return ProductCard(
                      product: product,
                      isWishlisted: auth.isLoggedIn && wishlist.has(product.id),
                      onWishlistToggle: auth.isLoggedIn ? () => wishlist.toggle(product.id) : null,
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
                );
              },
              childCount: _results.length,
            ),
          ),
        ),
      ],
    );
  }
}
