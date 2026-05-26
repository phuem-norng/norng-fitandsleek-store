<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f6fb;">
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
                        <td style="padding:0 24px 28px 24px;font-family:Arial,Helvetica,sans-serif;color:#10233f;">
    <h2>Hello, {{ $user->name ?? $user->email }}</h2>
    <p>You requested a password reset for your Fit & Sleek account.</p>
    <p>Click the link below to reset your password:</p>
    <p>
        <a href="{{ url('/reset-password?token=' . $token . '&email=' . urlencode($user->email)) }}" style="background:#4f46e5;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Reset Password</a>
    </p>
    <p>If you did not request this, please ignore this email.</p>
    <p>Thank you,<br>Fit & Sleek Team</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
