<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// PostgreSQL → Qdrant: index active products that have image_url but no vector yet (no manual artisan needed).
Schedule::command('qdrant:index-products --only-missing')
    ->everyTenMinutes()
    ->withoutOverlapping(25);
