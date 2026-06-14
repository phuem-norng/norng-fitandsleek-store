import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../services/admin_service.dart';
import '../../theme/app_colors.dart';
import '../../utils/media_url.dart';
import '../../widgets/common/fs_empty_state.dart';
import '../../widgets/product_image.dart';

class AdminReportsScreen extends StatefulWidget {
  const AdminReportsScreen({super.key});

  @override
  State<AdminReportsScreen> createState() => _AdminReportsScreenState();
}

class _AdminReportsScreenState extends State<AdminReportsScreen> {
  List<SalesDayRow> _sales = [];
  List<TopProductRow> _topProducts = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final service = AdminService(context.read<ApiClient>());
    try {
      final sales = await service.fetchSales(periodDays: 30);
      final top = await service.fetchTopProducts(limit: 10);
      if (!mounted) return;
      setState(() {
        _sales = sales;
        _topProducts = top;
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = context.read<ApiClient>().apiMessage(e);
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? FsEmptyState(
                  icon: Icons.bar_chart_outlined,
                  title: 'Could not load reports',
                  subtitle: _error,
                  actionLabel: 'Retry',
                  onAction: _load,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      Text('Sales (last 30 days)', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      if (_sales.isEmpty)
                        const Text('No sales data in this period')
                      else
                        ..._sales.reversed.take(14).map((row) {
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceCard,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                Expanded(child: Text(row.date)),
                                Text('${row.orders} orders'),
                                const SizedBox(width: 12),
                                Text(
                                  currency.format(row.revenue),
                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          );
                        }),
                      const SizedBox(height: 24),
                      Text('Top products', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 12),
                      if (_topProducts.isEmpty)
                        const Text('No product sales yet')
                      else
                        ..._topProducts.map((row) {
                          final imageUrl = resolveMediaUrl(row.imageUrl);
                          return Container(
                            margin: const EdgeInsets.only(bottom: 8),
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceCard,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                if (imageUrl.isNotEmpty)
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(8),
                                    child: SizedBox(
                                      width: 40,
                                      height: 40,
                                      child: ProductImage(imageUrl: imageUrl, fit: BoxFit.cover),
                                    ),
                                  ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(row.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                                      Text('${row.totalSold} sold'),
                                    ],
                                  ),
                                ),
                                Text(
                                  currency.format(row.totalRevenue),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}
