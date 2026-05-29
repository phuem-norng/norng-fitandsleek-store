<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
        $soldByCode = $this->buildSoldQuantityByBarcode();

        $masters = Category::query()
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->whereNull('parent_id')
            ->where('manage_stock', true)
            ->orderBy('name')
            ->get();

        $items = [];
        $counts = ['ok' => 0, 'warning' => 0, 'error' => 0];

        foreach ($masters as $master) {
            $row = $this->auditMaster($master, $soldByCode);
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
     * @param  array<string, int>  $soldByCode
     * @return array<string, mixed>
     */
    public function auditMaster(Category $master, ?array $soldByCode = null): array
    {
        if ($soldByCode === null) {
            $soldByCode = $this->buildSoldQuantityByBarcode();
        }

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

        $loggedReceived = $this->stockReceive->totalReceivedQuantity($master);
        $onHand = max(0, (int) ($master->stock ?? 0));
        $soldFromOrders = $this->soldQuantityForLabel($master, $soldByCode);

        $reconciled = $this->reconcileTotals($loggedReceived, $onHand, $soldFromOrders);
        $totalReceived = $reconciled['total_received'];
        $impliedSold = $reconciled['implied_sold_or_issued'];
        $inferredTotal = $reconciled['inferred_from_inventory'];

        if ($inferredTotal && $receiveBreakdown === []) {
            $receiveBreakdown[] = [
                'key' => 'inferred',
                'label' => 'Inferred (on-hand + sales)',
                'quantity' => $totalReceived,
            ];
        }

        $issues = [];

        if ($inferredTotal && $loggedReceived === 0) {
            $issues[] = [
                'code' => 'missing_receive_log',
                'severity' => 'warning',
                'message' => 'No Stock Received log on file; total is inferred from on-hand plus paid sales.',
            ];
        }

        if ($loggedReceived > 0 && $onHand > $totalReceived) {
            $issues[] = [
                'code' => 'on_hand_exceeds_received',
                'severity' => 'error',
                'message' => sprintf(
                    'Sellable on-hand (%d) is higher than Stock Received total (%d). Use Fix to align on-hand with received minus sold.',
                    $onHand,
                    $totalReceived,
                ),
            ];
        }

        if ($batchCount > 0 && $openingReceipt === null) {
            $issues[] = [
                'code' => 'missing_opening_receipt',
                'severity' => 'warning',
                'message' => 'Quick Restock batches exist but opening receipt (stock_received) is not set on the master label.',
            ];
        }

        $stockReceivedField = $master->stock_received !== null ? (int) $master->stock_received : null;
        if (
            $batchCount === 0
            && $stockReceivedField !== null
            && $master->stock !== null
            && $stockReceivedField !== (int) $master->stock
            && $onHand <= $totalReceived
            && ! $this->isExpectedStockReceiveGap($stockReceivedField, $onHand, $impliedSold)
        ) {
            $issues[] = [
                'code' => 'standalone_stock_fields_differ',
                'severity' => 'warning',
                'message' => 'Sellable stock does not match Stock Received minus sold/issued. Use Fix to sync on-hand.',
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
            'logged_received' => $loggedReceived,
            'total_received' => $totalReceived,
            'on_hand' => $onHand,
            'sold_from_orders' => $soldFromOrders,
            'implied_sold_or_issued' => $impliedSold,
            'corrected_on_hand' => max(0, $totalReceived - $impliedSold),
            'status' => $status,
            'issues' => $issues,
            'can_repair' => $this->stockReceive->isInventoryMaster($master)
                && ($master->manage_stock ?? false)
                && $status !== 'ok',
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

        $soldByCode = $this->buildSoldQuantityByBarcode();
        $repaired = 0;
        $items = [];

        DB::transaction(function () use ($query, $soldByCode, &$repaired, &$items) {
            foreach ($query->get() as $master) {
                $before = $this->auditMaster($master, $soldByCode);
                if ($before['status'] === 'ok') {
                    continue;
                }

                $this->repairMaster($master, $before);
                $master->refresh();
                $after = $this->auditMaster($master, $soldByCode);
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

    /**
     * @param  array<string, mixed>  $audit
     */
    private function repairMaster(Category $master, array $audit): void
    {
        $total = (int) $audit['total_received'];
        $sold = (int) $audit['implied_sold_or_issued'];
        $batchCount = (int) ($audit['batch_count'] ?? 0);

        if ($batchCount === 0 && $total > 0 && $master->stock_received === null) {
            $master->stock_received = $total;
        }

        $master->stock = max(0, $total - $sold);
        $master->save();

        if ($batchCount > 0) {
            $this->stockReceive->recalculateInventoryStock($master->fresh());
        }
    }

    /**
     * Normal when stock_received is total ever received and stock is on-hand after sales.
     */
    private function isExpectedStockReceiveGap(int $stockReceived, int $onHand, int $impliedSold): bool
    {
        if ($stockReceived < $onHand) {
            return false;
        }

        return ($stockReceived - $onHand) === $impliedSold;
    }

    /**
     * @return array<string, int>
     */
    private function buildSoldQuantityByBarcode(): array
    {
        if (
            ! Schema::hasTable('order_items')
            || ! Schema::hasTable('orders')
            || ! Schema::hasTable('products')
        ) {
            return [];
        }

        $rows = DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->where('orders.payment_status', 'paid')
            ->whereNotNull('products.barcode_code')
            ->where('products.barcode_code', '!=', '')
            ->groupBy(DB::raw('LOWER(products.barcode_code)'))
            ->selectRaw('LOWER(products.barcode_code) as code, COALESCE(SUM(order_items.qty), 0) as sold')
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $map[(string) $row->code] = (int) $row->sold;
        }

        return $map;
    }

    /**
     * @param  array<string, int>  $soldByCode
     */
    private function soldQuantityForLabel(Category $master, array $soldByCode): int
    {
        $total = 0;
        foreach ($this->barcodeKeysForLabel($master) as $key) {
            $total += (int) ($soldByCode[$key] ?? 0);
        }

        return $total;
    }

    /**
     * @return list<string>
     */
    private function barcodeKeysForLabel(Category $master): array
    {
        $keys = [];
        foreach (['slug', 'sku'] as $field) {
            $value = strtolower(trim((string) ($master->{$field} ?? '')));
            if ($value !== '') {
                $keys[$value] = true;
            }
        }

        return array_keys($keys);
    }

    /**
     * @return array{
     *   total_received: int,
     *   implied_sold_or_issued: int,
     *   inferred_from_inventory: bool
     * }
     */
    private function reconcileTotals(int $loggedReceived, int $onHand, int $soldFromOrders): array
    {
        if ($loggedReceived > 0) {
            $totalReceived = $loggedReceived;
            $gapSold = max(0, $totalReceived - $onHand);
            $soldOrIssued = max($gapSold, $soldFromOrders);

            return [
                'total_received' => $totalReceived,
                'implied_sold_or_issued' => $soldOrIssued,
                'inferred_from_inventory' => false,
            ];
        }

        $totalReceived = $onHand + $soldFromOrders;
        $soldOrIssued = $soldFromOrders > 0
            ? $soldFromOrders
            : max(0, $totalReceived - $onHand);

        return [
            'total_received' => $totalReceived,
            'implied_sold_or_issued' => $soldOrIssued,
            'inferred_from_inventory' => $totalReceived > 0,
        ];
    }
}
