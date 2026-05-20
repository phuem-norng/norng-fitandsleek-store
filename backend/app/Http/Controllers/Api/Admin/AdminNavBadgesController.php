<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Message;
use App\Models\Order;
use Illuminate\Support\Facades\Cache;

class AdminNavBadgesController extends Controller
{
    private const PENDING_STATUSES = ['pending', 'pending_payment', 'processing'];

    public function index()
    {
        $badges = Cache::remember('admin_nav_badges', 30, function () {
            return [
                'orders' => Order::query()
                    ->whereIn('status', self::PENDING_STATUSES)
                    ->count(),
                'messages' => Message::query()
                    ->where('is_active', true)
                    ->count(),
            ];
        });

        return response()->json($badges);
    }
}
