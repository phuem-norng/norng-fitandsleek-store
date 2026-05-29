<?php

require __DIR__.'/../vendor/autoload.php';

$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$to = $argv[1] ?? 'khatvanna2008@gmail.com';

echo 'mailer='.config('mail.default').PHP_EOL;
echo 'host='.config('mail.mailers.smtp.host').PHP_EOL;
echo 'port='.config('mail.mailers.smtp.port').PHP_EOL;
echo 'username='.config('mail.mailers.smtp.username').PHP_EOL;
echo 'scheme='.json_encode(config('mail.mailers.smtp.scheme')).PHP_EOL;
echo 'from='.config('mail.from.address').PHP_EOL;

try {
    Illuminate\Support\Facades\Mail::raw('Fit and Sleek SMTP test at '.now(), function ($m) use ($to) {
        $m->to($to)->subject('SMTP test');
    });
    echo 'RESULT=SENT_OK'.PHP_EOL;
} catch (Throwable $e) {
    echo 'RESULT=FAIL'.PHP_EOL;
    echo $e->getMessage().PHP_EOL;
    exit(1);
}
