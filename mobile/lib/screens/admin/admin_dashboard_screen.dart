import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api_client.dart';
import '../../services/admin_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/common/fs_stat_card.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  AdminDashboardStats? _stats;
  SuperAdminStats? _superStats;
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
      final stats = await service.fetchDashboard();
      final superStats = await service.fetchSuperAdminStats();
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _superStats = superStats;
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
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final stats = _stats!;
    final currency = NumberFormat.simpleCurrency(name: 'USD');

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text(
            'Overview',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 4),
          Text(
            'Business metrics at a glance',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.15,
            children: [
              FsStatCard(
                label: 'Revenue',
                value: currency.format(stats.totalRevenue),
                subtitle: 'Today ${currency.format(stats.todayRevenue)}',
                icon: Icons.payments_outlined,
                accentColor: AppColors.success,
              ),
              FsStatCard(
                label: 'Orders',
                value: '${stats.totalOrders}',
                subtitle: '${stats.pendingOrders} pending',
                icon: Icons.receipt_long_outlined,
                accentColor: AppColors.accent,
              ),
              FsStatCard(
                label: 'Products',
                value: '${stats.totalProducts}',
                subtitle: '${stats.lowStockProducts} low stock',
                icon: Icons.inventory_2_outlined,
                accentColor: AppColors.warning,
              ),
              FsStatCard(
                label: 'Customers',
                value: '${stats.totalCustomers}',
                icon: Icons.people_outline,
                accentColor: AppColors.adminBadge,
              ),
            ],
          ),
          if (_superStats != null) ...[
            const SizedBox(height: 24),
            Text('System', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            _QuickActionsCard(superStats: _superStats!),
          ],
          const SizedBox(height: 16),
          _InfoBanner(
            icon: Icons.laptop_mac_outlined,
            title: 'Full admin on web',
            body: 'Product editing, orders, reports, and POS are available in the web admin panel.',
          ),
        ],
      ),
    );
  }
}

class _QuickActionsCard extends StatelessWidget {
  const _QuickActionsCard({required this.superStats});

  final SuperAdminStats superStats;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          _row(context, 'Total users', '${superStats.totalUsers}'),
          const Divider(height: 20),
          _row(context, 'Admins', '${superStats.totalAdmins}'),
          const Divider(height: 20),
          _row(context, 'Customers', '${superStats.totalCustomers}'),
          const Divider(height: 20),
          _row(context, 'Active users', '${superStats.activeUsers}'),
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: Theme.of(context).textTheme.bodyMedium),
        Text(value, style: Theme.of(context).textTheme.titleMedium),
      ],
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.accent.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.accent.withValues(alpha: 0.2)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.accentDark),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(body, style: Theme.of(context).textTheme.bodyMedium),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
