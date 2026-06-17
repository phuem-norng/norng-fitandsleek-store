import 'package:flutter/material.dart';

import '../../l10n/l10n_extension.dart';
import '../../models/brand_model.dart';
import '../../models/product_filters.dart';
import '../../theme/app_colors.dart';

class ShopFilterSheet extends StatefulWidget {
  const ShopFilterSheet({
    super.key,
    required this.initial,
    required this.brands,
    required this.filterOptions,
  });

  final ProductFilters initial;
  final List<BrandModel> brands;
  final FilterOptionsModel? filterOptions;

  static Future<ProductFilters?> show(
    BuildContext context, {
    required ProductFilters initial,
    required List<BrandModel> brands,
    FilterOptionsModel? filterOptions,
  }) {
    final sheetHeight = MediaQuery.sizeOf(context).height * 0.88;

    return showModalBottomSheet<ProductFilters>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      enableDrag: false,
      isDismissible: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetContext) => SizedBox(
        height: sheetHeight,
        child: ShopFilterSheet(
          initial: initial.copy(),
          brands: brands,
          filterOptions: filterOptions,
        ),
      ),
    );
  }

  @override
  State<ShopFilterSheet> createState() => _ShopFilterSheetState();
}

class _ShopFilterSheetState extends State<ShopFilterSheet> {
  late ProductFilters _draft;
  late RangeValues _priceRange;
  late double _boundsMin;
  late double _boundsMax;

  @override
  void initState() {
    super.initState();
    _draft = widget.initial.copy();
    _boundsMin = widget.filterOptions?.priceMin ?? 0;
    _boundsMax = widget.filterOptions?.priceMax ?? 100;
    if (_boundsMax <= _boundsMin) {
      _boundsMax = _boundsMin + 100;
    }
    _priceRange = RangeValues(
      _draft.minPrice ?? _boundsMin,
      _draft.maxPrice ?? _boundsMax,
    );
  }

  void _clearAll() {
    setState(() {
      _draft.clear();
      _priceRange = RangeValues(_boundsMin, _boundsMax);
    });
  }

  void _apply() {
    final next = _draft.copy();
    if (_priceRange.start > _boundsMin) {
      next.minPrice = _priceRange.start;
    } else {
      next.minPrice = null;
    }
    if (_priceRange.end < _boundsMax) {
      next.maxPrice = _priceRange.end;
    } else {
      next.maxPrice = null;
    }
    Navigator.of(context).pop(next);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;
    final colors = widget.filterOptions?.colors ?? [];
    final sizes = widget.filterOptions?.sizes ?? [];
    final showPrice = _boundsMax > _boundsMin;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
          child: Row(
            children: [
              Text(
                l10n.filter,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: onSurface,
                    ),
              ),
              const Spacer(),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: Icon(Icons.close_rounded, color: onSurface),
              ),
            ],
          ),
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: [
              _sectionTitle(l10n.sortBy, onSurface),
              ...l10n.sortOptions.map((option) => _sortTile(option.value, option.label, onSurface, onSurfaceVariant)),
              if (showPrice) ...[
                const SizedBox(height: 8),
                _sectionTitle(l10n.priceRange, onSurface),
                Text(
                  '\$${_priceRange.start.round()} – \$${_priceRange.end.round()}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: onSurface),
                ),
                RangeSlider(
                  values: _priceRange,
                  min: _boundsMin,
                  max: _boundsMax,
                  divisions: (_boundsMax - _boundsMin).clamp(1, 200).round(),
                  activeColor: AppColors.storeHeader,
                  labels: RangeLabels(
                    '\$${_priceRange.start.round()}',
                    '\$${_priceRange.end.round()}',
                  ),
                  onChanged: (values) => setState(() => _priceRange = values),
                ),
              ],
              if (ProductFilters.genderOptions.isNotEmpty) ...[
                const SizedBox(height: 8),
                _sectionTitle(l10n.gender, onSurface),
                ...ProductFilters.genderOptions.map(
                  (option) => _genderTile(option.value, l10n.genderLabel(option.value), onSurface),
                ),
              ],
              if (widget.brands.isNotEmpty) ...[
                const SizedBox(height: 8),
                _sectionTitle(l10n.brand, onSurface),
                ...widget.brands.map((b) => _brandTile(b, onSurface)),
              ],
              if (colors.isNotEmpty) ...[
                const SizedBox(height: 8),
                _sectionTitle(l10n.colorLabel, onSurface),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: colors.map((c) => _colorChip(c, onSurface)).toList(),
                ),
              ],
              if (sizes.isNotEmpty) ...[
                const SizedBox(height: 16),
                _sectionTitle(l10n.sizeLabel, onSurface),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: sizes.map((s) => _sizeChip(s, onSurface)).toList(),
                ),
              ],
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Row(
              children: [
                TextButton(
                  onPressed: _clearAll,
                  child: Text(
                    l10n.clearAll,
                    style: TextStyle(fontWeight: FontWeight.w600, color: onSurface),
                  ),
                ),
                const Spacer(),
                Material(
                  color: AppColors.storeHeader,
                  borderRadius: BorderRadius.circular(24),
                  child: InkWell(
                    onTap: _apply,
                    borderRadius: BorderRadius.circular(24),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                      child: Text(
                        l10n.applyFilters,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _sortTile(String value, String label, Color onSurface, Color onSurfaceVariant) {
    final selected = _draft.sort == value;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      dense: true,
      leading: Icon(
        selected ? Icons.radio_button_checked : Icons.radio_button_off,
        color: selected ? AppColors.storeHeader : onSurfaceVariant,
      ),
      title: Text(label, style: TextStyle(color: onSurface)),
      onTap: () => setState(() => _draft.sort = value),
    );
  }

  Widget _genderTile(String value, String label, Color onSurface) {
    final checked = _draft.genders.contains(value);
    return InkWell(
      onTap: () {
        setState(() {
          if (checked) {
            _draft.genders.remove(value);
          } else {
            _draft.genders.add(value);
          }
        });
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Checkbox(
              value: checked,
              activeColor: AppColors.storeHeader,
              onChanged: (next) {
                setState(() {
                  if (next == true) {
                    _draft.genders.add(value);
                  } else {
                    _draft.genders.remove(value);
                  }
                });
              },
            ),
            Expanded(
              child: Text(label, style: TextStyle(color: onSurface)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _brandTile(BrandModel brand, Color onSurface) {
    final checked = _draft.brandIds.contains(brand.id);
    return InkWell(
      onTap: () {
        setState(() {
          if (checked) {
            _draft.brandIds.remove(brand.id);
          } else {
            _draft.brandIds.add(brand.id);
          }
        });
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Checkbox(
              value: checked,
              activeColor: AppColors.storeHeader,
              onChanged: (next) {
                setState(() {
                  if (next == true) {
                    _draft.brandIds.add(brand.id);
                  } else {
                    _draft.brandIds.remove(brand.id);
                  }
                });
              },
            ),
            Expanded(
              child: Text(brand.name, style: TextStyle(color: onSurface)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _colorChip(String color, Color onSurface) {
    final selected = _draft.colors.contains(color);
    return FilterChip(
      label: Text(color, style: TextStyle(color: onSurface)),
      selected: selected,
      selectedColor: AppColors.storeHeader.withValues(alpha: 0.18),
      checkmarkColor: AppColors.storeHeader,
      side: BorderSide(color: onSurface.withValues(alpha: 0.2)),
      onSelected: (value) {
        setState(() {
          if (value) {
            _draft.colors.add(color);
          } else {
            _draft.colors.remove(color);
          }
        });
      },
    );
  }

  Widget _sizeChip(String size, Color onSurface) {
    final selected = _draft.sizes.contains(size);
    return FilterChip(
      label: Text(size, style: TextStyle(color: onSurface)),
      selected: selected,
      selectedColor: AppColors.storeHeader.withValues(alpha: 0.18),
      checkmarkColor: AppColors.storeHeader,
      side: BorderSide(color: onSurface.withValues(alpha: 0.2)),
      onSelected: (value) {
        setState(() {
          if (value) {
            _draft.sizes.add(size);
          } else {
            _draft.sizes.remove(size);
          }
        });
      },
    );
  }

  Widget _sectionTitle(String text, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: color),
      ),
    );
  }
}
