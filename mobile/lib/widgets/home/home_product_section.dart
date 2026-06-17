import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../l10n/l10n_extension.dart';
import '../../models/product_model.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wishlist_provider.dart';
import '../../theme/app_colors.dart';
import '../../widgets/product_card.dart';
import '../../screens/product_detail_screen.dart';
import '../../services/product_service.dart';

class HomeProductSection extends StatelessWidget {
  const HomeProductSection({
    super.key,
    required this.title,
    required this.items,
    required this.loading,
    required this.productService,
    this.onSeeAll,
    this.maxItems = 6,
  });

  final String title;
  final List<ProductModel> items;
  final bool loading;
  final ProductService productService;
  final VoidCallback? onSeeAll;
  final int maxItems;

  @override
  Widget build(BuildContext context) {
    if (!loading && items.isEmpty) return const SizedBox.shrink();

    final visibleItems = items.take(maxItems).toList();

    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                        ),
                  ),
                ),
                if (onSeeAll != null)
                  TextButton(
                    onPressed: onSeeAll,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                      foregroundColor: AppColors.accent,
                      textStyle: const TextStyle(
                        inherit: false,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    child: Text('${context.l10n.seeAll} >'),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: loading
                ? GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    padding: EdgeInsets.zero,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: productCardGridAspectRatio,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: maxItems,
                    itemBuilder: (_, __) => const _SectionSkeletonCard(),
                  )
                : GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    padding: EdgeInsets.zero,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      childAspectRatio: productCardGridAspectRatio,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: visibleItems.length,
                    itemBuilder: (context, index) {
                      final product = visibleItems[index];
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
                                  productService: productService,
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
        ],
      ),
    );
  }
}

class _SectionSkeletonCard extends StatelessWidget {
  const _SectionSkeletonCard();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Container(
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
              ),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(10, 6, 10, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(height: 10, width: 90, child: ColoredBox(color: Color(0xFFE2E8F0))),
                SizedBox(height: 8),
                SizedBox(height: 10, width: 50, child: ColoredBox(color: Color(0xFFE2E8F0))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
