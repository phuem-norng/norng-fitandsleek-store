import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../core/api_client.dart';
import '../providers/auth_provider.dart';
import '../theme/app_colors.dart';
import '../widgets/common/fs_button.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({
    super.key,
    required this.email,
    required this.purpose,
  });

  final String email;
  final String purpose;

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _codeController = TextEditingController();

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    final auth = context.read<AuthProvider>();
    final api = context.read<ApiClient>();
    try {
      await auth.verifyOtp(
        email: widget.email,
        code: _codeController.text.trim(),
        purpose: widget.purpose,
      );
      if (!mounted) return;
      Navigator.of(context).popUntil((route) => route.isFirst);
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(api.apiMessage(e))),
      );
    }
  }

  Future<void> _resend() async {
    final auth = context.read<AuthProvider>();
    final api = context.read<ApiClient>();
    try {
      await auth.resendOtp(email: widget.email, purpose: widget.purpose);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('A new code was sent to your email')),
      );
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(api.apiMessage(e))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      appBar: AppBar(title: const Text('Verify email')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.mark_email_read_outlined, size: 56, color: AppColors.accent),
              const SizedBox(height: 16),
              Text(
                'Check your inbox',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontSize: 24),
              ),
              const SizedBox(height: 8),
              Text(
                'We sent a verification code to ${widget.email}',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 28),
              TextField(
                controller: _codeController,
                keyboardType: TextInputType.number,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: 8),
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                decoration: const InputDecoration(
                  labelText: '6-digit code',
                  hintText: '000000',
                ),
              ),
              const SizedBox(height: 28),
              FsButton(
                label: 'Verify & continue',
                onPressed: auth.busy ? null : _verify,
                loading: auth.busy,
                icon: Icons.verified_user_outlined,
              ),
              const SizedBox(height: 12),
              TextButton(onPressed: _resend, child: const Text('Resend code')),
            ],
          ),
        ),
      ),
    );
  }
}
