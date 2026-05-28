<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('telegram:maintenance')->dailyAt('03:00');

// PostgreSQL → Qdrant: index active products that have image_url but no vector yet (no manual artisan needed).
// Backfill any products that missed the queue (failed jobs, worker was down, etc.).
Schedule::command('qdrant:index-products --only-missing')
    ->everyFiveMinutes()
    ->withoutOverlapping(25);
