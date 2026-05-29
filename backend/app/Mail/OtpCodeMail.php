<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Symfony\Component\Mime\Email;

class OtpCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $code;

    public string $purpose;

    public int $expiresMinutes;

    public string $purposeAction;

    public function __construct(string $code, string $purpose, int $expiresMinutes)
    {
        $this->code = $code;
        $this->purpose = $purpose;
        $this->expiresMinutes = $expiresMinutes;
        $this->purposeAction = match ($purpose) {
            'register' => 'complete your registration',
            'login' => 'sign in to your account',
            'forgot' => 'reset your password',
            default => 'continue',
        };
    }

    public function envelope(): Envelope
    {
        $appName = (string) config('app.name', 'Fit and Sleek');
        $replyTo = config('mail.admin_address') ?: config('mail.from.address');

        return new Envelope(
            subject: "{$appName} — verification code",
            replyTo: is_string($replyTo) && $replyTo !== '' ? [$replyTo] : [],
            using: [
                function (Email $message): void {
                    $headers = $message->getHeaders();
                    $headers->addTextHeader('Auto-Submitted', 'auto-generated');
                    $headers->addTextHeader('X-Auto-Response-Suppress', 'OOF, AutoReply');
                },
            ],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp-code',
            text: 'emails.otp-code-text',
            with: [
                'code' => $this->code,
                'purpose' => $this->purpose,
                'purposeAction' => $this->purposeAction,
                'expiresMinutes' => $this->expiresMinutes,
                'appName' => config('app.name', 'Fit and Sleek'),
            ],
        );
    }
}
