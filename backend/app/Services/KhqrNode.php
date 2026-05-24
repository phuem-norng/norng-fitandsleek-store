<?php

namespace App\Services;

use JsonException;
use RuntimeException;
use Symfony\Component\Process\Process as SymfonyProcess;

class KhqrNode
{
    public function generate(array $data): array
    {
        $script = base_path('node-khqr/generate.mjs');

        if (! is_file($script)) {
            throw new RuntimeException('KHQR generator script not found.');
        }

        try {
            $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            throw new RuntimeException('Failed to encode KHQR payload: ' . $e->getMessage(), 0, $e);
        }

        $nodeBinary = $this->resolveNodeBinary();

        $process = new SymfonyProcess([$nodeBinary, $script, $json], dirname($script), null, null, 30);
        $process->run();

        if (! $process->isSuccessful()) {
            $stderr = trim($process->getErrorOutput());
            $stdout = trim($process->getOutput());
            $details = $stderr !== '' ? $stderr : $stdout;
            $exitCode = $process->getExitCode();
            $exitText = $process->getExitCodeText();

            $message = sprintf(
                'Node KHQR generator failed (bin=%s, exit=%s %s): %s',
                $nodeBinary,
                $exitCode ?? 'null',
                $exitText ?? '',
                $details !== '' ? $details : 'Unknown error'
            );

            if ($this->looksLikeMissingNodeModules($details)) {
                $message .= ' — Install deps on this server: `php artisan bakong:install-khqr` (requires npm in PATH), or `cd node-khqr && npm ci`.';
            }

            throw new RuntimeException($message);
        }

        $decoded = json_decode(trim($process->getOutput()), true);

        if (! is_array($decoded) || empty($decoded['qr']) || empty($decoded['md5'])) {
            throw new RuntimeException('Invalid KHQR output: ' . $process->getOutput());
        }

        return [
            'qr' => $decoded['qr'],
            'md5' => $decoded['md5'],
        ];
    }

    private function resolveNodeBinary(): string
    {
        $configured = trim((string) config('services.bakong.node_binary', 'node'));

        if ($configured !== '') {
            // If an absolute/explicit path is configured but missing on this machine,
            // fall back to PATH lookups instead of failing immediately.
            if ($this->looksLikePath($configured) && !is_file($configured)) {
                return strtoupper(substr(PHP_OS_FAMILY, 0, 3)) === 'WIN' ? 'node.exe' : 'node';
            }

            return $configured;
        }

        return strtoupper(substr(PHP_OS_FAMILY, 0, 3)) === 'WIN' ? 'node.exe' : 'node';
    }

    private function looksLikePath(string $value): bool
    {
        if (str_contains($value, '/') || str_contains($value, '\\')) {
            return true;
        }

        // Windows drive path, e.g. C:\...
        return (bool) preg_match('/^[a-zA-Z]:\\\\/', $value);
    }

    private function looksLikeMissingNodeModules(string $details): bool
    {
        $lower = strtolower($details);

        return str_contains($lower, 'cannot find module')
            || str_contains($lower, 'module_not_found')
            || str_contains($lower, "can't find module");
    }
}
