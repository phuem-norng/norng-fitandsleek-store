import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../l10n/l10n_extension.dart';
import '../services/telegram_service.dart';

class TelegramConnectButton extends StatefulWidget {
  const TelegramConnectButton({
    super.key,
    this.orderNumber,
    this.connectUrl,
    this.compact = false,
  });

  final String? orderNumber;
  final String? connectUrl;
  final bool compact;

  @override
  State<TelegramConnectButton> createState() => _TelegramConnectButtonState();
}

class _TelegramConnectButtonState extends State<TelegramConnectButton> {
  String? _url;
  bool _enabled = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (widget.connectUrl != null && widget.connectUrl!.isNotEmpty) {
      setState(() {
        _url = widget.connectUrl;
        _enabled = true;
        _loading = false;
      });
      return;
    }

    final service = context.read<TelegramService>();
    try {
      if (!await service.isEnabled()) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      final info = widget.orderNumber != null
          ? await service.fetchOrderLink(widget.orderNumber!)
          : await service.fetchAccountStatus();

      if (!mounted) return;
      setState(() {
        _enabled = info.enabled;
        _url = info.connectUrl ?? info.accountConnectUrl;
        _loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open() async {
    final url = _url;
    if (url == null) return;
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || !_enabled || _url == null) {
      return const SizedBox.shrink();
    }

    final l10n = context.l10n;
    final label = widget.orderNumber != null
        ? l10n.telegramOrderUpdates
        : l10n.connectTelegram;

    return SizedBox(
      width: widget.compact ? null : double.infinity,
      child: FilledButton.icon(
        onPressed: _open,
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFF229ED9),
          foregroundColor: Colors.white,
          padding: EdgeInsets.symmetric(
            horizontal: widget.compact ? 16 : 20,
            vertical: widget.compact ? 12 : 14,
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        icon: Icon(widget.compact ? Icons.send_outlined : Icons.telegram, size: 20),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
      ),
    );
  }
}

class TelegramAccountConnectTile extends StatelessWidget {
  const TelegramAccountConnectTile({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF229ED9).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF229ED9).withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.telegramNotificationsTitle,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            l10n.telegramNotificationsHint,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 12),
          const TelegramConnectButton(compact: true),
        ],
      ),
    );
  }
}
