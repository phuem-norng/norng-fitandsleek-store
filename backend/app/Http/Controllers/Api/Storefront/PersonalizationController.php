<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Services\ProductRecommendationService;
use App\Services\StorefrontEventService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PersonalizationController extends Controller
{
    public function __construct(
        private ProductRecommendationService $recommendationService,
        private StorefrontEventService $eventService
    ) {
    }

    public function recommendations(Request $request)
    {
        $user = Auth::guard('sanctum')->user();
        $sessionId = $request->header('X-Session-Id') ?: $request->input('session_id');
        $perPage = (int) $request->input('per_page', 8);

        $data = $this->recommendationService->recommendations(
            $user?->id ? (int) $user->id : null,
            $sessionId ? (string) $sessionId : null,
            $perPage
        );

        return response()->json($data);
    }

    public function trackEvent(Request $request)
    {
        $payload = $request->validate([
            'event_type' => ['required', 'string', 'in:product_view,add_to_cart,purchase,search_query,banner_click'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'order_id' => ['nullable', 'integer', 'exists:orders,id'],
            'session_id' => ['nullable', 'string', 'max:120'],
            'meta' => ['nullable', 'array'],
        ]);

        $user = Auth::guard('sanctum')->user();
        $sessionId = (string) ($payload['session_id'] ?? $request->header('X-Session-Id') ?? '');

        $this->eventService->track(
            $payload['event_type'],
            $user?->id ? (int) $user->id : null,
            $sessionId ?: null,
            isset($payload['product_id']) ? (int) $payload['product_id'] : null,
            isset($payload['order_id']) ? (int) $payload['order_id'] : null,
            (array) ($payload['meta'] ?? [])
        );

        return response()->json(['ok' => true]);
    }
}

