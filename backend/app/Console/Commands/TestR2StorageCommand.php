<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Support\MediaDisk;
use Illuminate\Support\Facades\Storage;
use Throwable;

class TestR2StorageCommand extends Command
{
    protected $signature = 'storage:test-r2';

    protected $description = 'Upload a test file to Cloudflare R2 (s3 disk) and print the public URL';

    public function handle(): int
    {
        $required = [
            'AWS_ACCESS_KEY_ID',
            'AWS_SECRET_ACCESS_KEY',
            'AWS_BUCKET',
            'AWS_ENDPOINT',
        ];

        $missing = [];
        foreach ($required as $key) {
            if (trim((string) env($key, '')) === '') {
                $missing[] = $key;
            }
        }

        if ($missing !== []) {
            $this->error('Missing environment variables: '.implode(', ', $missing));
            $this->line('Add R2 API credentials in backend/.env (see .env.example), then run: php artisan config:clear');

            return self::FAILURE;
        }

        if (trim((string) env('AWS_URL', '')) === '') {
            $this->warn('AWS_URL is empty — set your R2 public URL (r2.dev or custom domain) so browsers can load files.');
        }

        $path = 'healthchecks/r2-'.now()->format('Ymd-His').'.txt';
        $payload = 'fitandsleek-r2-ok-'.now()->toIso8601String();

        try {
            $disk = MediaDisk::disk();
            $disk->put($path, $payload);
            $exists = $disk->exists($path);
            $url = $disk->url($path);
            $disk->delete($path);

            if (! $exists) {
                $this->error('Upload reported success but file was not found on R2.');

                return self::FAILURE;
            }

            $this->info('R2 connection OK.');
            $this->line('Test object (deleted after check): '.$path);
            $this->line('Public URL would be: '.$url);

            return self::SUCCESS;
        } catch (Throwable $e) {
            $this->error('R2 test failed: '.$e->getMessage());

            return self::FAILURE;
        }
    }
}
