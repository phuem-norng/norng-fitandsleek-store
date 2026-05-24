<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process as SymfonyProcess;

class BakongInstallKhqrCommand extends Command
{
    protected $signature = 'bakong:install-khqr';

    protected $description = 'Install Node dependencies for Bakong KHQR (backend/node-khqr; run on the server if QR generation fails)';

    public function handle(): int
    {
        $dir = base_path('node-khqr');

        if (! is_dir($dir)) {
            $this->error("Directory not found: {$dir}");

            return self::FAILURE;
        }

        if (! is_file($dir.'/package.json')) {
            $this->error("package.json missing in {$dir}");

            return self::FAILURE;
        }

        $npm = strtoupper(substr(PHP_OS_FAMILY, 0, 3)) === 'WIN' ? 'npm.cmd' : 'npm';
        $this->info("Running `{$npm} ci --omit=dev` in {$dir} ...");

        $process = new SymfonyProcess([$npm, 'ci', '--omit=dev'], $dir, null, null, 300);
        $process->run();

        if (! $process->isSuccessful()) {
            $this->error(trim($process->getErrorOutput() ?: $process->getOutput()));

            return self::FAILURE;
        }

        $this->info('KHQR Node dependencies installed successfully.');

        return self::SUCCESS;
    }
}
