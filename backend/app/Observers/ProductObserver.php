<?php

namespace App\Observers;

use App\Models\Product;
use App\Services\ProductQdrantSync;

class ProductObserver
{
    public function saved(Product $product): void
    {
        $wasCreated = $product->wasRecentlyCreated;
        $changed = array_keys($product->getChanges());

        if (ProductQdrantSync::shouldRemoveAfterSave($product, $wasCreated, $changed)) {
            ProductQdrantSync::scheduleRemove($product);

            return;
        }

        if (ProductQdrantSync::shouldSyncAfterSave($product, $wasCreated, $changed)) {
            ProductQdrantSync::scheduleIndex($product);
        }
    }

    public function deleted(Product $product): void
    {
        if (! ProductQdrantSync::isConfigured()) {
            return;
        }

        ProductQdrantSync::scheduleRemove($product);
    }
}
