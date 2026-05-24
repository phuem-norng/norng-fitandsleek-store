<?php

namespace App\Console\Commands;

use App\Models\TelegramBroadcast;
use App\Models\TelegramBroadcastDelivery;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

class TelegramMaintenanceCommand extends Command
{
    public const CACHE_KEY = 'telegram_maintenance:last_stats';

    protected $signature = 'telegram:maintenance {--pretend : Show prune counts without deleting}';

    protected $description = 'Prune old Telegram broadcast records and queue batch metadata';

    public function handle(): int
    {
        $retentionDays = max(1, (int) config('services.telegram.broadcast_retention_days', 30));
        $hours = $retentionDays * 24;
        $pretend = (bool) $this->option('pretend');
        $this->info("Running Telegram maintenance with retention of {$retentionDays} day(s).");

        $modelPruneOptions = [
            '--model' => [
                TelegramBroadcast::class,
                TelegramBroadcastDelivery::class,
            ],
        ];

        if ($pretend) {
            $modelPruneOptions['--pretend'] = true;
            $this->warn('Pretend mode enabled: no records will be deleted.');
        }

        $broadcastPrunableCount = (new TelegramBroadcast())->prunable()->count();
        $deliveryPrunableCount = (new TelegramBroadcastDelivery())->prunable()->count();

        Artisan::call('model:prune', $modelPruneOptions);
        $modelPruneOutput = Artisan::output();
        $this->line($modelPruneOutput);

        $batchPruneOptions = ['--hours' => $hours];
        if ($pretend) {
            $batchPruneOptions['--pretend'] = true;
        }

        Artisan::call('queue:prune-batches', $batchPruneOptions);
        $batchPruneOutput = Artisan::output();
        $this->line($batchPruneOutput);

        $stats = [
            'ran_at' => now()->toISOString(),
            'pretend' => $pretend,
            'retention_days' => $retentionDays,
            'batch_prune_hours' => $hours,
            'broadcasts_pruned' => $broadcastPrunableCount,
            'deliveries_pruned' => $deliveryPrunableCount,
            'batches_pruned' => $this->parsePrunedCount($batchPruneOutput),
            'model_prune_output' => trim($modelPruneOutput),
            'batch_prune_output' => trim($batchPruneOutput),
        ];

        Cache::put(self::CACHE_KEY, $stats, now()->addDays(max(1, $retentionDays)));

        $this->info('Telegram maintenance completed.');

        return 0;
    }

    private function parsePrunedCount(string $output): ?int
    {
        if (preg_match('/(\d+)\s+(entries|batches|records|jobs)/i', $output, $matches) === 1) {
            return (int) $matches[1];
        }

        if (preg_match('/pruned\s+(\d+)/i', $output, $matches) === 1) {
            return (int) $matches[1];
        }

        return null;
    }
}
