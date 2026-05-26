@php
    $isAdmin = ($recipientType ?? 'customer') === 'admin';
    $customerName = $order->user->name ?? 'Customer';
    $payment = $order->payments->sortByDesc('id')->first();
    $method = $payment?->method ?? $order->payment_method ?? 'payment';
@endphp

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6fb;font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:20px 12px;background-color:#f3f6fb;">
        <tr>
            <td align="center" style="padding:0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background-color:#ffffff;border:1px solid #dbe4f0;border-radius:12px;">
                    <tr>
                        <td align="center" style="padding:20px;">
                            <img src="https://pub-93085525881746c1a7b523e463cbfb35.r2.dev/uploads/Fitandsleek/2026-01-30%2003.05.05.jpg" alt="Fit and Sleek" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:10px;" />
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 24px 28px 24px;">
    <h2 style="margin-bottom: 12px;">
        {{ $isAdmin ? 'Payment Finalization & Communication (Admin Alert)' : 'Payment Finalization & Communication' }}
    </h2>

    @if($isAdmin)
        <p>A payment has been completed successfully.</p>
        <p><strong>Customer:</strong> {{ $customerName }} ({{ $order->user->email ?? 'N/A' }})</p>
    @else
        <p>Hi {{ $customerName }},</p>
        <p>Your payment has been received successfully. Your order is now being processed.</p>
    @endif

    <p><strong>Order Number:</strong> {{ $order->order_number }}</p>
    <p><strong>Payment Method:</strong> {{ strtoupper(str_replace('_', ' ', (string) $method)) }}</p>
    <p><strong>Total:</strong> {{ $payment?->currency ?? 'USD' }} {{ number_format((float) $order->total, 2) }}</p>
    <p><strong>Status:</strong> {{ strtoupper((string) $order->payment_status) }}</p>

    @if(!$isAdmin)
        <p>Thank you for shopping with us.</p>
    @endif

    <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">
        Fit and Sleek Team
    </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
