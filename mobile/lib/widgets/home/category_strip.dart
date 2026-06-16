import 'package:flutter/material.dart';

import '../../l10n/app_strings.dart';
import '../../models/brand_model.dart';
import '../../theme/app_colors.dart';
import '../../utils/media_url.dart';
import '../product_image.dart';

/// Horizontal brand logos (same layout as web `BrandRow.jsx`).
class CategoryStrip extends StatefulWidget {
  const CategoryStrip({
    super.key,
    required this.brands,
    required this.selectedId,
    required this.onSelected,
  });

  final List<BrandModel> brands;
  final int? selectedId;
  final ValueChanged<int?> onSelected;

  @override
  State<CategoryStrip> createState() => _CategoryStripState();
}

class _CategoryStripState extends State<CategoryStrip> {
  final _scrollController = ScrollController();
  bool _canScrollRight = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_updateScrollHint);
    WidgetsBinding.instance.addPostFrameCallback((_) => _updateScrollHint());
  }

  @override
  void didUpdateWidget(CategoryStrip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.brands.length != widget.brands.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _updateScrollHint());
    }
  }

  void _updateScrollHint() {
    if (!_scrollController.hasClients) return;
    final max = _scrollController.position.maxScrollExtent;
    final show = max > 8 && _scrollController.offset < max - 8;
    if (show != _canScrollRight) setState(() => _canScrollRight = show);
  }

  void _scrollBy(double delta) {
    if (!_scrollController.hasClients) return;
    final target = (_scrollController.offset + delta).clamp(
      0.0,
      _scrollController.position.maxScrollExtent,
    );
    _scrollController.animateTo(
      target,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.brands.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                AppStrings.topBrands,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              Text(
                AppStrings.topBrandsKm,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ColoredBox(
            color: const Color(0xFFF3F4F6),
            child: SizedBox(
              height: 72,
              child: Stack(
                children: [
                  ListView.separated(
                controller: _scrollController,
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                itemCount: widget.brands.length,
                separatorBuilder: (_, __) => const SizedBox(width: 32),
                itemBuilder: (context, index) {
                  final brand = widget.brands[index];
                  final selected = widget.selectedId == brand.id;
                  return _BrandLogoTile(
                    brand: brand,
                    selected: selected,
                    onTap: () {
                      widget.onSelected(selected ? null : brand.id);
                    },
                  );
                },
              ),
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                child: IgnorePointer(
                  ignoring: !_canScrollRight,
                  child: AnimatedOpacity(
                    opacity: _canScrollRight ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            const Color(0xFFF3F4F6).withValues(alpha: 0),
                            const Color(0xFFF3F4F6),
                          ],
                        ),
                      ),
                      child: Material(
                        color: Colors.transparent,
                        child: InkWell(
                          onTap: () => _scrollBy(200),
                          child: const SizedBox(
                            width: 44,
                            child: Icon(
                              Icons.chevron_right_rounded,
                              color: AppColors.textPrimary,
                              size: 28,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      ),
      ],
    );
  }
}

class _BrandLogoTile extends StatelessWidget {
  const _BrandLogoTile({
    required this.brand,
    required this.selected,
    required this.onTap,
  });

  final BrandModel brand;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final logoUrl = resolveMediaUrl(brand.logoUrl);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            border: selected
                ? Border(
                    bottom: BorderSide(color: AppColors.primary, width: 2),
                  )
                : null,
          ),
          child: SizedBox(
            height: 48,
            width: 88,
            child: Center(
              child: logoUrl.isNotEmpty
                  ? ProductImage(
                      imageUrl: logoUrl,
                      fit: BoxFit.contain,
                      error: _nameFallback(brand.name),
                    )
                  : _nameFallback(brand.name),
            ),
          ),
        ),
      ),
    );
  }

  Widget _nameFallback(String name) {
    return Text(
      name,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.3,
        color: AppColors.textPrimary,
      ),
    );
  }
}
