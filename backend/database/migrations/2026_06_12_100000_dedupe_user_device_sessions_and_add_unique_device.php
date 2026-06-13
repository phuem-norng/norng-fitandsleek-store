<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasTable('user_device_sessions')) {
            return;
        }

        DB::table('user_device_sessions')
            ->whereNull('personal_access_token_id')
            ->delete();

        $userIds = DB::table('user_device_sessions')->distinct()->pluck('user_id');

        foreach ($userIds as $userId) {
            $rows = DB::table('user_device_sessions')
                ->where('user_id', $userId)
                ->orderByDesc('last_used_at')
                ->orderByDesc('last_login_at')
                ->orderByDesc('id')
                ->get();

            $keepers = [];

            foreach ($rows as $row) {
                $matchedKeeperId = null;

                foreach ($keepers as $keeperId => $keeper) {
                    $sameDevice = (string) $row->device_id !== '' && (string) $row->device_id === (string) $keeper->device_id;
                    $sameFingerprint = $this->sameFingerprint($row, $keeper);

                    if ($sameDevice || $sameFingerprint) {
                        $matchedKeeperId = $keeperId;
                        break;
                    }
                }

                if ($matchedKeeperId === null) {
                    $keepers[(int) $row->id] = $row;
                    continue;
                }

                $keeper = $keepers[$matchedKeeperId];
                $preferredDeviceId = $this->preferredDeviceId($row->device_id, $keeper->device_id);

                DB::table('user_device_sessions')->where('id', $matchedKeeperId)->update([
                    'personal_access_token_id' => $row->personal_access_token_id ?: $keeper->personal_access_token_id,
                    'device_id' => $preferredDeviceId,
                    'device_name' => $row->device_name ?: $keeper->device_name,
                    'browser' => $row->browser ?: $keeper->browser,
                    'os' => $row->os ?: $keeper->os,
                    'user_agent' => $row->user_agent ?: $keeper->user_agent,
                    'ip_address' => $row->ip_address ?: $keeper->ip_address,
                    'last_login_at' => $row->last_login_at ?: $keeper->last_login_at,
                    'last_used_at' => $row->last_used_at ?: $keeper->last_used_at,
                    'device_verified_at' => $row->device_verified_at ?: $keeper->device_verified_at,
                ]);

                $keepers[$matchedKeeperId] = DB::table('user_device_sessions')->where('id', $matchedKeeperId)->first();
            }

            $keepIds = array_keys($keepers);
            if ($keepIds !== []) {
                DB::table('user_device_sessions')
                    ->where('user_id', $userId)
                    ->whereNotIn('id', $keepIds)
                    ->delete();
            }
        }

        if (! $this->indexExists('user_device_sessions', 'user_device_sessions_user_device_unique')) {
            Schema::table('user_device_sessions', function (Blueprint $table) {
                $table->unique(['user_id', 'device_id'], 'user_device_sessions_user_device_unique');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('user_device_sessions')) {
            return;
        }

        if ($this->indexExists('user_device_sessions', 'user_device_sessions_user_device_unique')) {
            Schema::table('user_device_sessions', function (Blueprint $table) {
                $table->dropUnique('user_device_sessions_user_device_unique');
            });
        }
    }

    private function sameFingerprint(object $a, object $b): bool
    {
        $browser = strtolower(trim((string) ($a->browser ?? '')));
        $os = strtolower(trim((string) ($a->os ?? '')));
        $name = strtolower(trim((string) ($a->device_name ?? '')));

        if ($browser === '' || $os === '') {
            return false;
        }

        return $browser === strtolower(trim((string) ($b->browser ?? '')))
            && $os === strtolower(trim((string) ($b->os ?? '')))
            && $name === strtolower(trim((string) ($b->device_name ?? '')));
    }

    private function preferredDeviceId(?string $a, ?string $b): string
    {
        $a = (string) ($a ?? '');
        $b = (string) ($b ?? '');

        if (str_starts_with($a, 'dev_')) {
            return $a;
        }
        if (str_starts_with($b, 'dev_')) {
            return $b;
        }

        return $a !== '' ? $a : $b;
    }

    private function indexExists(string $table, string $index): bool
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            return (bool) DB::selectOne(
                'SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?',
                [$table, $index]
            );
        }

        if ($driver === 'mysql') {
            return collect(DB::select("SHOW INDEX FROM {$table} WHERE Key_name = ?", [$index]))->isNotEmpty();
        }

        return false;
    }
};
