<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SecurityAuditLog;
use Illuminate\Http\Request;

class SecurityAuditController extends Controller
{
    public function myActivity(Request $request)
    {
        $logs = SecurityAuditLog::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (SecurityAuditLog $log) => $this->formatLog($log));

        return response()->json([
            'message' => 'Security activity retrieved',
            'data' => $logs,
        ]);
    }

    public function adminIndex(Request $request)
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'event_type' => ['nullable', 'string', 'max:64'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $query = SecurityAuditLog::query()->with('user:id,name,email');

        if (! empty($data['user_id'])) {
            $query->where('user_id', $data['user_id']);
        }

        if (! empty($data['event_type'])) {
            $query->where('event_type', $data['event_type']);
        }

        $paginated = $query
            ->orderByDesc('id')
            ->paginate($data['per_page'] ?? 25);

        $paginated->getCollection()->transform(fn (SecurityAuditLog $log) => $this->formatLog($log, includeUser: true));

        return response()->json($paginated);
    }

    private function formatLog(SecurityAuditLog $log, bool $includeUser = false): array
    {
        $location = collect([$log->ip_city, $log->ip_region, $log->ip_country])
            ->filter()
            ->unique()
            ->implode(', ');

        $row = [
            'id' => $log->id,
            'event_type' => $log->event_type,
            'ip_address' => $log->ip_address,
            'location' => $location !== '' ? $location : null,
            'ip_city' => $log->ip_city,
            'ip_region' => $log->ip_region,
            'ip_country' => $log->ip_country,
            'ip_country_code' => $log->ip_country_code,
            'device_id' => $log->device_id,
            'device_name' => $log->device_name,
            'browser' => $log->browser,
            'os' => $log->os,
            'metadata' => $log->metadata,
            'created_at' => optional($log->created_at)?->toDateTimeString(),
        ];

        if ($includeUser && $log->relationLoaded('user') && $log->user) {
            $row['user'] = [
                'id' => $log->user->id,
                'name' => $log->user->name,
                'email' => $log->user->email,
            ];
        }

        return $row;
    }
}
