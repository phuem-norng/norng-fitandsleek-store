<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Facades\DB;

class InventoryIntegrityService
{
    public function __construct(
        private readonly StockReceiveService $stockReceive,
    ) {}

    /**
     * @return array{
     *   summary: array{total: int, ok: int, warning: int, error: int},
     *   items: list<array<string, mixed>>
     * }
     */
    public function audit(): array
    {
        $masters = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNull('parent_id')
            ->where('manage_stock', true)
            ->orderBy('name')
            ->get();

        $items = [];
        $counts = ['ok' => 0, 'warning' => 0, 'error' => 0];

        foreach ($masters as $master) {
            $row = $this->auditMaster($master);
            $items[] = $row;
            $counts[$row['status']]++;
        }

        return [
            'summary' => [
                'total' => count($items),
                'ok' => $counts['ok'],
                'warning' => $counts['warning'],
                'error' => $counts['error'],
            ],
            'items' => $items,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function auditMaster(Category $master): array
    {
        $master->refresh();

        $batches = Category::query()
            ->where('parent_id', $master->id)
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->get();

        $batchCount = $batches->count();
        $openingReceipt = $master->stock_received !== null
            ? max(0, (int) $master->stock_received)
            : null;
        $batchReceivedTotal = 0;
        $receiveBreakdown = [];

        if ($openingReceipt !== null && $openingReceipt > 0) {
            $receiveBreakdown[] = [
                'key' => 'opening',
                'label' => 'Opening',
                'quantity' => $openingReceipt,
            ];
        }

        $sortedBatches = $batches->sortBy(fn (Category $b) => $b->created_at?->timestamp ?? 0)->values();
        $batchIndex = 1;
        foreach ($sortedBatches as $batch) {
            $qty = $this->stockReceive->receivedQuantity($batch);
            $batchReceivedTotal += $qty;
            if ($qty > 0) {
                $receiveBreakdown[] = [
                    'key' => 'batch-' . $batch->id,
                    'label' => 'Batch ' . $batchIndex,
                    'quantity' => $qty,
                    'slug' => $batch->slug,
                    'date_in' => $batch->date_in?->format('Y-m-d'),
                ];
                $batchIndex++;
            }
        }

        if ($receiveBreakdown === [] && $batchCount === 0) {
            $standaloneQty = $this->stockReceive->totalReceivedQuantity($master);
            if ($standaloneQty > 0) {
                $receiveBreakdown[] = [
                    'key' => 'standalone',
                    'label' => 'Receipt',
                    'quantity' => $standaloneQty,
                ];
            }
        }

        $totalReceived = $this->stockReceive->totalReceivedQuantity($master);
        $onHand = max(0, (int) ($master->stock ?? 0));
        $impliedSold = max(0, $totalReceived - $onHand);
        $issues = [];

        if ($onHand > $totalReceived) {
            $issues[] = [
                'code' => 'on_hand_exceeds_received',
                'severity' => 'error',
                'message' => 'On-hand stock is higher than total received units.',
            ];
        }

        if ($impliedSold === 0 && $onHand !== $totalReceived) {
            $issues[] = [
                'code' => 'on_hand_receive_mismatch',
                'severity' => 'error',
                'message' => 'No sold/issued units recorded, but on-hand does not match total received.',
            ];
        }

        if ($batchCount > 0 && $openingReceipt === null) {
            $issues[] = [
                'code' => 'missing_opening_receipt',
                'severity' => 'warning',
                'message' => 'Quick Restock batches exist but opening receipt (stock_received) is not set on the master label.',
            ];
        }

        if ($batchCount === 0 && $master->stock_received !== null && $master->stock !== null
            && (int) $master->stock_received !== (int) $master->stock) {
            $issues[] = [
                'code' => 'standalone_stock_fields_differ',
                'severity' => 'warning',
                'message' => 'Standalone label: stock and stock_received differ.',
            ];
        }

        $status = 'ok';
        foreach ($issues as $issue) {
            if ($issue['severity'] === 'error') {
                $status = 'error';
                break;
            }
            if ($issue['severity'] === 'warning') {
                $status = 'warning';
            }
        }

        return [
            'id' => $master->id,
            'name' => $master->name,
            'slug' => $master->slug,
            'is_active' => (bool) ($master->is_active ?? true),
            'batch_count' => $batchCount,
            'opening_receipt' => $openingReceipt,
            'batch_received_total' => $batchReceivedTotal,
            'receive_breakdown' => $receiveBreakdown,
            'total_received' => $totalReceived,
            'on_hand' => $onHand,
            'implied_sold_or_issued' => $impliedSold,
            'corrected_on_hand' => max(0, $totalReceived - $impliedSold),
            'status' => $status,
            'issues' => $issues,
            'can_repair' => $this->stockReceive->isInventoryMaster($master)
                && ($master->manage_stock ?? false)
                && ($status !== 'ok' || $batchCount > 0),
        ];
    }

    /**
     * @return array{repaired: int, items: list<array<string, mixed>>}
     */
    public function repair(?int $masterId = null): array
    {
        $query = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNull('parent_id')
            ->where('manage_stock', true);

        if ($masterId !== null) {
            $query->where('id', $masterId);
        }

        $repaired = 0;
        $items = [];

        DB::transaction(function () use ($query, &$repaired, &$items) {
            foreach ($query->get() as $master) {
                $before = $this->auditMaster($master);
                if ($before['status'] === 'ok' && $before['batch_count'] === 0) {
                    continue;
                }

                $this->stockReceive->recalculateInventoryStock($master);
                $master->refresh();
                $after = $this->auditMaster($master);
                $items[] = [
                    'id' => $master->id,
                    'name' => $master->name,
                    'slug' => $master->slug,
                    'before_on_hand' => $before['on_hand'],
                    'after_on_hand' => $after['on_hand'],
                    'status_before' => $before['status'],
                    'status_after' => $after['status'],
                ];
                $repaired++;
            }
        });

        return [
            'repaired' => $repaired,
            'items' => $items,
        ];
    }
}
