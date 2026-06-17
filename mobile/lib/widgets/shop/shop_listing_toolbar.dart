import 'package:flutter/material.dart';

import '../../l10n/l10n_extension.dart';

class ShopListingToolbar extends StatelessWidget {
  const ShopListingToolbar({
    super.key,
    required this.sort,
    required this.filterActiveCount,
    required this.onFilterTap,
    required this.onSortChanged,
  });

  final String sort;
  final int filterActiveCount;
  final VoidCallback onFilterTap;
  final ValueChanged<String> onSortChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          _FilterButton(
            activeCount: filterActiveCount,
            onTap: onFilterTap,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _SortButton(
              sort: sort,
              onSortChanged: onSortChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterButton extends StatelessWidget {
  const _FilterButton({
    required this.activeCount,
    required this.onTap,
  });

  final int activeCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final label = l10n.filterWithCount(activeCount);
    final onSurface = Theme.of(context).colorScheme.onSurface;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.tune_rounded, size: 18, color: onSurface),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  color: onSurface,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SortButton extends StatelessWidget {
  const _SortButton({
    required this.sort,
    required this.onSortChanged,
  });

  final String sort;
  final ValueChanged<String> onSortChanged;

  Future<void> _openSortMenu(BuildContext context) async {
    final l10n = context.l10n;
    final box = context.findRenderObject() as RenderBox?;
    if (box == null) return;

    final overlay = Overlay.of(context).context.findRenderObject() as RenderBox;
    final topLeft = box.localToGlobal(Offset.zero, ancestor: overlay);
    final bottomRight = box.localToGlobal(box.size.bottomRight(Offset.zero), ancestor: overlay);

    final selected = await showMenu<String>(
      context: context,
      color: Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      position: RelativeRect.fromRect(
        Rect.fromLTRB(topLeft.dx, bottomRight.dy + 4, bottomRight.dx, topLeft.dy),
        Offset.zero & overlay.size,
      ),
      items: l10n.sortOptions
          .map(
            (option) => PopupMenuItem<String>(
              value: option.value,
              height: 44,
              child: Row(
                children: [
                  SizedBox(
                    width: 22,
                    child: option.value == sort
                        ? Icon(
                            Icons.check_rounded,
                            size: 18,
                            color: Theme.of(context).colorScheme.primary,
                          )
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Flexible(
                    child: Text(
                      option.label,
                      style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );

    if (selected != null && selected != sort) {
      onSortChanged(selected);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final label = l10n.sortLabel(sort);
    final onSurface = Theme.of(context).colorScheme.onSurface;
    final onSurfaceVariant = Theme.of(context).colorScheme.onSurfaceVariant;

    return Material(
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => _openSortMenu(context),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              Icon(Icons.swap_vert_rounded, size: 18, color: onSurface),
              const SizedBox(width: 8),
              Text(
                l10n.sortBy,
                style: TextStyle(fontWeight: FontWeight.w600, color: onSurface),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    color: onSurfaceVariant,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(Icons.keyboard_arrow_down_rounded, color: onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}
