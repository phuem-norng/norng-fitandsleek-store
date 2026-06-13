<?php

namespace App\Services;

use App\Models\StorefrontEvent;

class StorefrontEventService
{
    public function track(
        string $eventType,
        ?int $userId = null,
        ?string $sessionId = null,
        ?int $productId = null,
        ?int $orderId = null,
        array $meta = []
    ): void {
        if (!$userId && !$sessionId) {
            return;
        }

        StorefrontEvent::create([
            'user_id' => $userId,
            'session_id' => $sessionId ?: null,
            'event_type' => $eventType,
            'product_id' => $productId,
            'order_id' => $orderId,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }
}

