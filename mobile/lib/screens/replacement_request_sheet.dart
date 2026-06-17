import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../l10n/l10n_extension.dart';
import '../models/order_model.dart';
import '../services/customer_account_service.dart';
import '../theme/app_colors.dart';

class ReplacementRequestSheet extends StatefulWidget {
  const ReplacementRequestSheet({super.key, required this.order});

  final OrderModel order;

  static Future<bool?> show(BuildContext context, {required OrderModel order}) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: ReplacementRequestSheet(order: order),
      ),
    );
  }

  @override
  State<ReplacementRequestSheet> createState() => _ReplacementRequestSheetState();
}

class _ReplacementRequestSheetState extends State<ReplacementRequestSheet> {
  final _reasonController = TextEditingController();
  final _notesController = TextEditingController();
  final Set<int> _selectedItemIds = {};
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _reasonController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = context.l10n;
    final reason = _reasonController.text.trim();
    if (_selectedItemIds.isEmpty) {
      setState(() => _error = l10n.replacementSelectItems);
      return;
    }
    if (reason.isEmpty) {
      setState(() => _error = l10n.replacementReasonRequired);
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final items = widget.order.items
          .where((item) => item.id != null && _selectedItemIds.contains(item.id))
          .map((item) => {
                'order_item_id': item.id,
                'quantity': item.quantity,
              })
          .toList();

      await context.read<CustomerAccountService>().submitReplacement(
            orderId: widget.order.id,
            reason: reason,
            notes: _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
            items: items,
          );

      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.88,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    l10n.requestReplacement,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close_rounded)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
              children: [
                Text(l10n.replacementSelectItems, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                ...widget.order.items.map((item) {
                  if (item.id == null) return const SizedBox.shrink();
                  final selected = _selectedItemIds.contains(item.id);
                  return CheckboxListTile(
                    value: selected,
                    contentPadding: EdgeInsets.zero,
                    activeColor: AppColors.storeHeader,
                    title: Text(item.name),
                    subtitle: Text('Qty ${item.quantity}'),
                    onChanged: (value) {
                      setState(() {
                        if (value == true) {
                          _selectedItemIds.add(item.id!);
                        } else {
                          _selectedItemIds.remove(item.id);
                        }
                      });
                    },
                  );
                }),
                const SizedBox(height: 16),
                TextField(
                  controller: _reasonController,
                  decoration: InputDecoration(
                    labelText: l10n.replacementReasonLabel,
                    border: const OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _notesController,
                  minLines: 2,
                  maxLines: 4,
                  decoration: InputDecoration(
                    labelText: l10n.replacementNotesLabel,
                    border: const OutlineInputBorder(),
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: AppColors.error)),
                ],
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              child: FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.storeHeader,
                  minimumSize: const Size.fromHeight(48),
                ),
                child: _submitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : Text(l10n.submitRequest),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
