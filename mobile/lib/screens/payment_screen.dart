import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api_client.dart';
import '../models/order_model.dart';
import '../models/payment_model.dart';
import '../services/payment_service.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_button.dart';
import '../widgets/telegram_connect_button.dart';

class PaymentScreen extends StatefulWidget {
  const PaymentScreen({
    super.key,
    required this.orderId,
    required this.orderNumber,
    required this.amount,
    this.currency = 'KHR',
    this.onPaid,
  });

  final int orderId;
  final String orderNumber;
  final double amount;
  final String currency;
  final VoidCallback? onPaid;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  PaymentModel? _payment;
  String _status = 'loading';
  String? _error;
  String? _note;
  Timer? _pollTimer;
  Timer? _countdownTimer;
  Duration _remaining = Duration.zero;
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _createPayment();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown(DateTime? expiresAt) {
    _countdownTimer?.cancel();
    if (expiresAt == null) return;
    void tick() {
      final diff = expiresAt.difference(DateTime.now());
      if (!mounted) return;
      setState(() => _remaining = diff.isNegative ? Duration.zero : diff);
      if (diff.isNegative) {
        _countdownTimer?.cancel();
      }
    }
    tick();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) => tick());
  }

  void _startPolling() {
    _pollTimer?.cancel();
    final paymentId = _payment?.paymentId;
    if (paymentId == null || paymentId == 0) return;

    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _checkStatus());
  }

  Future<void> _createPayment() async {
    setState(() {
      _creating = true;
      _error = null;
      _status = 'loading';
    });
    try {
      final payment = await context.read<PaymentService>().createBakongPayment(widget.orderId);
      if (!mounted) return;
      _applyPayment(payment);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = context.read<ApiClient>().apiMessage(e);
        _status = 'error';
      });
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  Future<void> _checkStatus() async {
    final paymentId = _payment?.paymentId;
    if (paymentId == null || paymentId == 0 || _status == 'paid') return;

    try {
      final payment = await context.read<PaymentService>().checkBakongStatus(paymentId);
      if (!mounted) return;
      _applyPayment(payment);
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() => _note = context.read<ApiClient>().apiMessage(e));
    }
  }

  void _applyPayment(PaymentModel payment) {
    setState(() {
      _payment = payment;
      _status = payment.status;
      _startCountdown(payment.expiresAt);
    });

    if (payment.isPaid) {
      _pollTimer?.cancel();
      widget.onPaid?.call();
      return;
    }

    if (payment.isExpired) {
      _pollTimer?.cancel();
      return;
    }

    _startPolling();
  }

  String _formatAmount() {
    final currency = _payment?.currency ?? widget.currency;
    final amount = _payment?.amount ?? widget.amount;
    if (currency.toUpperCase() == 'KHR') {
      return '${NumberFormat('#,###').format(amount.round())} KHR';
    }
    return NumberFormat.simpleCurrency(name: 'USD').format(amount);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Pay #${widget.orderNumber}')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              _formatAmount(),
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Scan with any Bakong / KHQR app',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            if (_creating || _status == 'loading')
              const Center(child: CircularProgressIndicator())
            else if (_status == 'paid')
              _StatusCard(
                icon: Icons.check_circle_outline,
                color: AppColors.success,
                title: 'Payment received',
                subtitle: 'Your order is being processed.',
              )
            else if (_status == 'expired')
              _StatusCard(
                icon: Icons.timer_off_outlined,
                color: AppColors.warning,
                title: 'QR expired',
                subtitle: 'Generate a new code to continue.',
              )
            else if (_error != null)
              _StatusCard(
                icon: Icons.error_outline,
                color: AppColors.error,
                title: 'Payment unavailable',
                subtitle: _error!,
              )
            else if (_payment?.hasQr == true) ...[
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: QrImageView(
                    data: _payment!.qrString!,
                    version: QrVersions.auto,
                    size: 220,
                    backgroundColor: Colors.white,
                  ),
                ),
              ),
              if (_payment?.billNumber != null) ...[
                const SizedBox(height: 12),
                Text(
                  'Bill: ${_payment!.billNumber}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
              if (_remaining > Duration.zero) ...[
                const SizedBox(height: 8),
                Text(
                  'Expires in ${_remaining.inMinutes}:${(_remaining.inSeconds % 60).toString().padLeft(2, '0')}',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
              const SizedBox(height: 12),
              _StatusPill(status: _status),
            ],
            if (_note != null) ...[
              const SizedBox(height: 16),
              Text(_note!, style: Theme.of(context).textTheme.bodySmall),
            ],
            const SizedBox(height: 24),
            if (_status != 'paid')
              FsButton(
                label: _status == 'expired' || _error != null ? 'Regenerate QR' : 'Refresh status',
                onPressed: _creating
                    ? null
                    : () {
                        if (_status == 'expired' || _error != null) {
                          _createPayment();
                        } else {
                          _checkStatus();
                        }
                      },
                loading: _creating,
              ),
            if (_status == 'paid') ...[
              const SizedBox(height: 12),
              TelegramConnectButton(orderNumber: widget.orderNumber),
              const SizedBox(height: 12),
              FsButton(
                label: 'Done',
                variant: FsButtonVariant.accent,
                onPressed: () => Navigator.of(context).pop(true),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 48),
          const SizedBox(height: 12),
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 6),
          Text(subtitle, textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final label = status.replaceAll('_', ' ');
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          'Status: $label',
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

/// Navigate to payment after checkout.
Future<bool?> openOrderPayment(
  BuildContext context, {
  required OrderModel order,
}) {
  return Navigator.of(context).push<bool>(
    MaterialPageRoute(
      builder: (_) => PaymentScreen(
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.total,
      ),
    ),
  );
}
