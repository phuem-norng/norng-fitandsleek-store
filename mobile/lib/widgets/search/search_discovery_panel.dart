import 'package:flutter/material.dart';

import '../../l10n/storefront_l10n.dart';
import '../../l10n/l10n_extension.dart';
import '../../models/category_model.dart';
import '../../models/collection_model.dart';
import '../../utils/media_url.dart';
import '../product_card.dart';
import '../product_image.dart';

typedef SearchTermTap = void Function(String label, {required bool isNewIn});
typedef CollectionTap = void Function(CollectionModel collection);
typedef CategoryTap = void Function(CategoryModel category);

class SearchDiscoveryPanel extends StatelessWidget {
  const SearchDiscoveryPanel({
    super.key,
    required this.collections,
    required this.categories,
    required this.collectionsLoading,
    required this.onPopularTermTap,
    required this.onCollectionTap,
    required this.onCategoryTap,
  });

  final List<CollectionModel> collections;
  final List<CategoryModel> categories;
  final bool collectionsLoading;
  final SearchTermTap onPopularTermTap;
  final CollectionTap onCollectionTap;
  final CategoryTap onCategoryTap;

  static List<(String, bool, String)> _popularTerms(StorefrontL10n l) => [
    (l.belts, false, 'Belts'),
    (l.shoes, false, 'Shoes'),
    (l.hoodies, false, 'Hoodies'),
    (l.newIn, true, 'new'),
    (l.tShirts, false, 'T-shirts'),
    (l.jeans, false, 'Jeans'),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      children: [
        _SectionTitle(l10n.popularSearchTerms, color: onSurfaceVariant),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: _popularTerms(l10n).map((entry) {
            return _TermChip(
              label: entry.$1,
              textColor: onSurface,
              onTap: () => onPopularTermTap(
                entry.$3,
                isNewIn: entry.$2,
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 20),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _SectionTitle(l10n.collectionsLabel, color: onSurfaceVariant),
            if (collectionsLoading)
              const SizedBox(
                height: 300,
                width: double.infinity,
                child: Center(child: CircularProgressIndicator()),
              )
            else
              _CollectionsGrid(
                collections: collections,
                onCollectionTap: onCollectionTap,
              ),
          ],
        ),
        if (categories.isNotEmpty) ...[
          const SizedBox(height: 24),
          _SectionTitle(l10n.categoriesLabel, color: onSurfaceVariant),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: categories.map((category) {
              return _TermChip(
                label: category.name,
                textColor: onSurface,
                onTap: () => onCategoryTap(category),
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, {required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      strutStyle: const StrutStyle(height: 1, forceStrutHeight: true),
      style: Theme.of(context).textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: color,
            height: 1,
          ),
    );
  }
}

class _TermChip extends StatelessWidget {
  const _TermChip({
    required this.label,
    required this.textColor,
    required this.onTap,
  });

  final String label;
  final Color textColor;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: textColor,
                ),
          ),
        ),
      ),
    );
  }
}

class _CollectionsGrid extends StatelessWidget {
  const _CollectionsGrid({
    required this.collections,
    required this.onCollectionTap,
  });

  static const _tileHeight = 290.0;
  static const _rowGap = 12.0;

  final List<CollectionModel> collections;
  final CollectionTap onCollectionTap;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];

    for (var i = 0; i < collections.length; i += 2) {
      final left = collections[i];
      final right = i + 1 < collections.length ? collections[i + 1] : null;

      rows.add(
        Padding(
          padding: EdgeInsets.only(top: i == 0 ? 4 : _rowGap),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: SizedBox(
                  height: _tileHeight,
                  child: _CollectionTile(
                    collection: left,
                    onTap: () => onCollectionTap(left),
                  ),
                ),
              ),
              const SizedBox(width: _rowGap),
              Expanded(
                child: right == null
                    ? const SizedBox(height: _tileHeight)
                    : SizedBox(
                        height: _tileHeight,
                        child: _CollectionTile(
                          collection: right,
                          onTap: () => onCollectionTap(right),
                        ),
                      ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: rows,
    );
  }
}

class _CollectionTile extends StatefulWidget {
  const _CollectionTile({required this.collection, required this.onTap});

  final CollectionModel collection;
  final VoidCallback onTap;

  @override
  State<_CollectionTile> createState() => _CollectionTileState();
}

class _CollectionTileState extends State<_CollectionTile> {
  bool _pressed = false;
  bool _hovered = false;

  bool get _showOverlay => _pressed || _hovered;

  @override
  Widget build(BuildContext context) {
    final imageUrl = resolveMediaUrl(widget.collection.imageUrl ?? '');

    return Material(
      color: Colors.white,
      borderRadius: productCardRadius,
      clipBehavior: Clip.antiAlias,
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: InkWell(
          onTap: widget.onTap,
          onHighlightChanged: (value) => setState(() => _pressed = value),
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (imageUrl.isNotEmpty)
                ProductImage(imageUrl: imageUrl, fit: BoxFit.cover)
              else
                DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Colors.grey.shade300,
                        Colors.grey.shade100,
                      ],
                    ),
                  ),
                ),
              AnimatedOpacity(
                opacity: _showOverlay ? 1 : 0,
                duration: const Duration(milliseconds: 280),
                curve: Curves.easeOutCubic,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.black.withValues(alpha: 0.05),
                        Colors.black.withValues(alpha: 0.7),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 14,
                right: 14,
                bottom: 14,
                child: AnimatedOpacity(
                  opacity: _showOverlay ? 1 : 0,
                  duration: const Duration(milliseconds: 280),
                  curve: Curves.easeOutCubic,
                  child: AnimatedSlide(
                    offset: _showOverlay ? Offset.zero : const Offset(0, 0.2),
                    duration: const Duration(milliseconds: 280),
                    curve: Curves.easeOutCubic,
                    child: Text(
                      widget.collection.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                        shadows: [
                          Shadow(color: Colors.black45, blurRadius: 8),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
