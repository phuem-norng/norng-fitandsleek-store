import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../core/api_client.dart';
import '../../services/admin_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/fs_button.dart';

class AdminPosScreen extends StatefulWidget {
  const AdminPosScreen({super.key});

  @override
  State<AdminPosScreen> createState() => _AdminPosScreenState();
}

class _AdminPosScreenState extends State<AdminPosScreen> {
  final _codeController = TextEditingController();
  final List<PosLine> _lines = [];
  String _paymentMethod = 'cash';
  bool _busy = false;

  static const _methods = [
    ('cash', 'Cash'),
    ('khqr', 'Bakong KHQR'),
    ('debit', 'Debit card'),
    ('credit', 'Credit card'),
  ];

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  double get _subtotal => _lines.fold(0, (sum, l) => sum + l.lineTotal);

  Future<void> _lookupAndAdd([String? code]) async {
    final raw = (code ?? _codeController.text).trim();
    if (raw.isEmpty) return;

    setState(() => _busy = true);
    try {
      final row = await AdminService(context.read<ApiClient>()).barcodeLookup(raw);
      if (!mounted) return;
      if (row == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No product matches this code')),
        );
        return;
      }
      final existing = _lines.indexWhere((l) => l.code == row.code);
      setState(() {
        if (existing >= 0) {
          final old = _lines[existing];
          _lines[existing] = PosLine(
            code: old.code,
            name: old.name,
            qty: old.qty + 1,
            unitPrice: old.unitPrice,
          );
        } else {
          _lines.add(PosLine(code: row.code, name: row.name, qty: 1, unitPrice: row.price));
        }
        _codeController.clear();
      });
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _completeSale() async {
    if (_lines.isEmpty) return;
    setState(() => _busy = true);
    try {
      final result = await AdminService(context.read<ApiClient>()).completePosSale(
        lines: _lines,
        paymentMethod: _paymentMethod,
      );
      if (!mounted) return;
      setState(() => _lines.clear());
      if (result.qrString != null) {
        await showDialog<void>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text('Receipt ${result.orderNumber}'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Ask customer to scan this KHQR'),
                const SizedBox(height: 12),
                QrImageView(data: result.qrString!, size: 200),
              ],
            ),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done')),
            ],
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sale ${result.orderNumber} recorded')),
        );
      }
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.read<ApiClient>().apiMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: const Text('POS')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _codeController,
              decoration: const InputDecoration(
                hintText: 'Barcode / slug / product URL',
                prefixIcon: Icon(Icons.qr_code_scanner),
              ),
              onSubmitted: (_) => _lookupAndAdd(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FsButton(
              label: 'Add item',
              onPressed: _busy ? null : () => _lookupAndAdd(),
              loading: _busy,
            ),
          ),
          Expanded(
            child: _lines.isEmpty
                ? const Center(child: Text('Enter a barcode or slug to start'))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _lines.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final line = _lines[index];
                      return ListTile(
                        tileColor: AppColors.surfaceCard,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        title: Text(line.name),
                        subtitle: Text('${currency.format(line.unitPrice)} × ${line.qty}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove),
                              onPressed: () {
                                setState(() {
                                  if (line.qty <= 1) {
                                    _lines.removeAt(index);
                                  } else {
                                    _lines[index] = PosLine(
                                      code: line.code,
                                      name: line.name,
                                      qty: line.qty - 1,
                                      unitPrice: line.unitPrice,
                                    );
                                  }
                                });
                              },
                            ),
                            IconButton(
                              icon: const Icon(Icons.add),
                              onPressed: () {
                                setState(() {
                                  _lines[index] = PosLine(
                                    code: line.code,
                                    name: line.name,
                                    qty: line.qty + 1,
                                    unitPrice: line.unitPrice,
                                  );
                                });
                              },
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surfaceCard,
              border: Border(top: BorderSide(color: AppColors.border)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: _paymentMethod,
                  decoration: const InputDecoration(labelText: 'Payment method'),
                  items: _methods
                      .map((m) => DropdownMenuItem(value: m.$1, child: Text(m.$2)))
                      .toList(),
                  onChanged: _busy ? null : (v) => setState(() => _paymentMethod = v ?? 'cash'),
                ),
                const SizedBox(height: 12),
                Text(
                  'Total: ${currency.format(_subtotal)}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 12),
                FsButton(
                  label: 'Complete sale',
                  variant: FsButtonVariant.accent,
                  loading: _busy,
                  onPressed: _lines.isEmpty || _busy ? null : _completeSale,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
