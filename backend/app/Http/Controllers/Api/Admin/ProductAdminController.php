<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\Message;
use App\Services\InventoryLotService;
use App\Services\PaidOrderInventory;
use App\Services\ProductGalleryImageProcessor;
use App\Support\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductAdminController extends Controller
{
    public function __construct(
        private readonly InventoryLotService $inventoryLots,
    ) {
    }

    private function isInlineDataUrl(?string $value): bool
    {
        return str_starts_with(strtolower(trim((string) $value)), 'data:');
    }

    private function persistInlineImageUrl(string $dataUrl, string $folder = 'products'): ?string
    {
        if (! preg_match('/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s', trim($dataUrl), $matches)) {
            return null;
        }

        $ext = match (strtolower($matches[1])) {
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/png' => 'png',
            'image/webp' => 'webp',
            'image/gif' => 'gif',
            default => 'jpg',
        };

        $content = base64_decode($matches[2], true);
        if ($content === false || $content === '') {
            return null;
        }

        $filename = trim($folder, '/').'/'.Str::uuid().'.'.$ext;

        return Media::put($filename, $content);
    }

    private function materializeImageReference(?string $url, string $folder): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        if (! $this->isInlineDataUrl($url)) {
            return $url;
        }

        return $this->persistInlineImageUrl($url, $folder) ?? $url;
    }

    /**
     * Upload base64 cover/gallery/color swatch URLs to Cloudinary before save.
     *
     * @param  array<string, mixed>  $data
     */
    private function materializeProductMedia(array &$data): void
    {
        if (array_key_exists('image_url', $data)) {
            $data['image_url'] = $this->materializeImageReference($data['image_url'] ?? null, 'products/cover');
        }

        if (array_key_exists('gallery', $data) && is_array($data['gallery'])) {
            $out = [];
            foreach ($data['gallery'] as $line) {
                $line = is_string($line) ? trim($line) : '';
                if ($line === '') {
                    continue;
                }
                $out[] = $this->materializeImageReference($line, 'products/gallery') ?? $line;
            }
            $data['gallery'] = $out;
        }

        if (array_key_exists('colors', $data) && is_array($data['colors'])) {
            foreach ($data['colors'] as $i => $color) {
                if (! is_array($color)) {
                    continue;
                }
                $img = $color['image_url'] ?? null;
                if (! is_string($img) || trim($img) === '') {
                    continue;
                }
                $data['colors'][$i]['image_url'] = $this->materializeImageReference($img, 'products/colors');
            }
        }
    }

     /**
     * @param  mixed  $raw
     * @return array<int, array{name: string, image_url: ?string}>|null
     */
    private function normalizeProductColorsInput(mixed $raw): ?array
    {
        if ($raw === null || $raw === '' || $raw === []) {
            return null;
        }
        if (! is_array($raw)) {
            return null;
        }
        $out = [];
        foreach ($raw as $item) {
            if (is_string($item)) {
                $n = trim($item);
                if ($n !== '') {
                    $out[] = ['name' => $n, 'image_url' => null];
                }

                continue;
            }
            if (! is_array($item)) {
                continue;
            }
            $n = trim((string) ($item['name'] ?? ''));
            if ($n === '') {
                continue;
            }
            $img = $item['image_url'] ?? $item['imageUrl'] ?? null;
            $img = is_string($img) ? trim($img) : '';
            $out[] = [
                'name' => $n,
                'image_url' => $img !== '' ? $img : null,
            ];
        }

        return count($out) > 0 ? $out : null;
    }

    /**
     * Color × Size matrix rows; duplicate color+size keys keep the last row.
     *
     * @param  mixed  $raw
     * @return array<int, array{color: string, size: string, qty: int, sku_barcode: ?string, barcode_format: string}>|null
     */
    private function normalizeVariantMatrixInput(mixed $raw): ?array
    {
        if ($raw === null || $raw === '' || $raw === []) {
            return null;
        }
        if (! is_array($raw)) {
            return null;
        }
        $byKey = [];
        foreach ($raw as $item) {
            if (! is_array($item)) {
                continue;
            }
            $c = trim((string) ($item['color'] ?? ''));
            $s = trim((string) ($item['size'] ?? ''));
            if ($c === '' || $s === '') {
                continue;
            }
            $q = 0;
            if (isset($item['qty']) && filter_var($item['qty'], FILTER_VALIDATE_INT) !== false && (int) $item['qty'] >= 0) {
                $q = (int) $item['qty'];
            }
            $skuBarcode = trim((string) ($item['sku_barcode'] ?? $item['skuBarcode'] ?? $item['barcode'] ?? ''));
            $fmt = strtoupper(trim((string) ($item['barcode_format'] ?? $item['barcodeFormat'] ?? 'EAN13')));
            $barcodeFormat = match ($fmt) {
                'UPC' => 'UPC',
                'CODE128', 'CODE-128' => 'CODE128',
                default => 'EAN13',
            };
            $key = mb_strtolower($c)."\0".mb_strtolower($s);
            $byKey[$key] = [
                'color' => $c,
                'size' => $s,
                'qty' => $q,
                'sku_barcode' => $skuBarcode !== '' ? Str::limit($skuBarcode, 120, '') : null,
                'barcode_format' => $barcodeFormat,
            ];
        }

        return count($byKey) > 0 ? array_values($byKey) : null;
    }

    /**
     * Keep product.stock aligned with variant rows so storefront cart caps stay correct.
     *
     * @param  array<string, mixed>  $data
     */
    private function syncProductStockFromVariantMatrix(array &$data): void
    {
        $matrix = $data['variant_matrix'] ?? null;
        if (! is_array($matrix) || $matrix === []) {
            return;
        }

        $sum = 0;
        foreach ($matrix as $row) {
            if (! is_array($row)) {
                continue;
            }
            $sum += max(0, (int) ($row['qty'] ?? 0));
        }

        $data['stock'] = $sum;
    }

    /**
     * Variant barcodes are scannable, so they must resolve to one exact Color × Size row.
     *
     * @param  array<int, array{color: string, size: string, qty: int, sku_barcode: ?string}>|null  $rows
     */
    private function assertVariantSkuBarcodesUnique(?array $rows, ?int $ignoreProductId = null): void
    {
        if (! is_array($rows) || $rows === []) {
            return;
        }

        $seen = [];
        foreach ($rows as $row) {
            $code = trim((string) ($row['sku_barcode'] ?? ''));
            if ($code === '') {
                continue;
            }

            $key = mb_strtolower($code);
            if (isset($seen[$key])) {
                throw ValidationException::withMessages([
                    'variant_matrix' => ['Each Variant Barcode must be unique across variant rows.'],
                ]);
            }
            $seen[$key] = true;
        }

        if ($seen === []) {
            return;
        }

        $products = Product::query()
            ->when($ignoreProductId, fn ($q) => $q->where('id', '!=', $ignoreProductId))
            ->whereNotNull('variant_matrix')
            ->get(['id', 'name', 'variant_matrix']);

        foreach ($products as $product) {
            $matrix = $product->variant_matrix;
            if (! is_array($matrix)) {
                continue;
            }
            foreach ($matrix as $row) {
                if (! is_array($row)) {
                    continue;
                }
                $code = trim((string) ($row['sku_barcode'] ?? $row['skuBarcode'] ?? $row['barcode'] ?? ''));
                if ($code !== '' && isset($seen[mb_strtolower($code)])) {
                    throw ValidationException::withMessages([
                        'variant_matrix' => ['Variant Barcode "'.$code.'" is already used by another product variant.'],
                    ]);
                }
            }
        }
    }

    public function uploadGalleryImage(Request $request)
    {
        $request->validate([
            'image' => [
                'required',
                'file',
                'max:10240',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (! $value instanceof \Illuminate\Http\UploadedFile || ! $value->isValid()) {
                        $fail('Invalid file upload.');

                        return;
                    }
                    $mime = strtolower((string) $value->getMimeType());
                    if (str_starts_with($mime, 'image/')) {
                        return;
                    }
                    $ext = strtolower((string) $value->getClientOriginalExtension());
                    $allowedExt = ['jpg', 'jpeg', 'jfif', 'pjpeg', 'png', 'apng', 'gif', 'webp', 'svg', 'bmp', 'dib', 'ico', 'tif', 'tiff', 'avif', 'heic', 'heif', 'heics', 'jxl', 'qoi'];
                    if (($mime === 'application/octet-stream' || $mime === 'binary/octet-stream' || $mime === '') && in_array($ext, $allowedExt, true)) {
                        return;
                    }
                    $fail('The image must be a valid image file.');
                },
            ],
        ]);

        try {
            $stored = app(ProductGalleryImageProcessor::class)->storeNormalized($request->file('image'));
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'Image upload failed.',
                'errors' => ['image' => ['Could not upload image to media storage. Please retry.']],
            ], 503);
        }

        $stored = str_replace('\\', '/', trim($stored));
        $url = Media::isExternalUrl($stored)
            ? $stored
            : (Media::url($stored) ?? (str_starts_with($stored, '/storage/') ? $stored : '/storage/'.$stored));

        return response()->json([
            'message' => 'Image uploaded',
            'image_url' => $url,
        ], 200);
    }
    public function index(Request $request)
    {
        $perPage = min(max((int) $request->input('per_page', 20), 1), 500);

        $paginator = Product::with(['category', 'brand', 'supplier', 'activeDiscount'])
            ->orderByDesc('id')
            ->paginate($perPage);

        $paginator->getCollection()->transform(fn (Product $product) => $this->withLotCatalogPricing($product));

        return $paginator;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'sku' => ['nullable', 'string', 'max:60'],
            'barcode_code' => [
                'nullable',
                'string',
                'max:120',
                Rule::exists('categories', 'slug')->where(fn ($q) => $q->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)),
            ],
            'stock_label_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)),
            ],
            'name' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'image_url' => ['nullable', 'string'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'model_info' => ['nullable', 'string'],
            'colors' => ['nullable', 'array'],
            'variant_matrix' => ['nullable', 'array'],
            'sizes' => ['nullable', 'array'],
            'size_guide' => ['nullable', 'string'],
            'delivery_info' => ['nullable', 'string'],
            'support_phone' => ['nullable', 'string'],
            'payment_methods' => ['nullable', 'array'],
            'gallery' => ['nullable', 'array'],
        ]);

        if (array_key_exists('barcode_code', $data)) {
            $bc = trim((string) $data['barcode_code']);
            $data['barcode_code'] = $bc === '' ? null : $bc;
        }

        $sku = trim((string) ($data['sku'] ?? ''));
        if ($sku === '') {
            do {
                $sku = 'AUTO-' . strtoupper(Str::random(10));
            } while (Product::where('sku', $sku)->exists());
        }
        $data['sku'] = $sku;

        $data['slug'] = Str::slug($data['name']);
        // Ensure unique slug
        $baseSlug = $data['slug'];
        $i = 1;
        while (Product::where('slug', $data['slug'])->exists()) {
            $data['slug'] = $baseSlug . '-' . $i++;
        }

        // Ensure unique SKU
        $baseSku = $data['sku'];
        $skuIndex = 1;
        while (Product::where('sku', $data['sku'])->exists()) {
            $suffix = '-' . $skuIndex++;
            $data['sku'] = Str::limit($baseSku, 60 - strlen($suffix), '') . $suffix;
        }

        if (array_key_exists('colors', $data)) {
            $data['colors'] = $this->normalizeProductColorsInput($data['colors'] ?? null);
        }

        if (array_key_exists('variant_matrix', $data)) {
            $data['variant_matrix'] = $this->normalizeVariantMatrixInput($data['variant_matrix'] ?? null);
            $this->assertVariantSkuBarcodesUnique($data['variant_matrix']);
            $this->syncProductStockFromVariantMatrix($data);
        }

        $data = $this->applyStockLabelPricing($data);
        $this->materializeProductMedia($data);

        $product = Product::create($data);

        // Auto-create a customer/guest message for new products (EN + KM)
        try {
            $payload = [
                'title' => 'New Product: ' . $product->name,
                'content' => 'Just added: ' . $product->name,
                'target_audience' => 'all',
                'is_active' => true,
                'created_by' => $request->user()->id,
                'link_url' => '/p/' . $product->slug,
                'media_url' => $product->image_url,
                'media_type' => $product->image_url ? 'image' : null,
            ];

            Message::create(array_merge($payload, ['language' => 'en']));
            Message::create(array_merge($payload, ['language' => 'km']));
        } catch (\Throwable $e) {
            // Ignore message creation failures
        }

        return response()->json($product, 201);
    }

    public function show(Product $product)
    {
        return $this->withLotCatalogPricing(
            $product->load(['category', 'brand', 'supplier', 'activeDiscount']),
        );
    }

    private function withLotCatalogPricing(Product $product): Product
    {
        $product->setAttribute('sellable_stock', $this->inventoryLots->productSellableStock($product));

        $pricing = $this->inventoryLots->catalogPricingFromLots($product);

        $product->setAttribute('pricing_source', $pricing['source']);
        $product->setAttribute('lot_pricing_varies', (bool) ($pricing['varies_by_variant'] ?? false));
        $product->setAttribute('lot_pricing_variant_label', $pricing['variant_label'] ?? null);

        if ($pricing['source'] === 'inventory_lot') {
            $product->setAttribute('cost_price', $pricing['cost_per_unit']);
            $product->setAttribute('price', $pricing['sell_price']);

            if ($pricing['varies_by_variant'] ?? false) {
                $product->setAttribute('lot_cost_price_max', $pricing['cost_max']);
                $product->setAttribute('lot_sell_price_max', $pricing['sell_max']);
            }
        }

        return $product;
    }

    public function variantPricing(Request $request, Product $product)
    {
        $validated = $request->validate([
            'size' => ['nullable', 'string', 'max:40'],
            'color' => ['nullable', 'string', 'max:80'],
        ]);

        return response()->json([
            'data' => $this->inventoryLots->variantPricingHints(
                $product,
                $validated['size'] ?? null,
                $validated['color'] ?? null,
            ),
        ]);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'category_id' => ['sometimes', 'integer'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'sku' => ['sometimes', 'string', 'max:60'],
            'barcode_code' => [
                'nullable',
                'string',
                'max:120',
                Rule::exists('categories', 'slug')->where(fn ($q) => $q->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)),
            ],
            'stock_label_id' => [
                'nullable',
                'integer',
                Rule::exists('categories', 'id')->where(fn ($q) => $q->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)),
            ],
            'name' => ['sometimes', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'image_url' => ['nullable', 'string'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'model_info' => ['nullable', 'string'],
            'colors' => ['nullable', 'array'],
            'variant_matrix' => ['nullable', 'array'],
            'sizes' => ['nullable', 'array'],
            'size_guide' => ['nullable', 'string'],
            'delivery_info' => ['nullable', 'string'],
            'support_phone' => ['nullable', 'string'],
            'payment_methods' => ['nullable', 'array'],
            'gallery' => ['nullable', 'array'],
        ]);

        if (array_key_exists('barcode_code', $data)) {
            $bc = trim((string) $data['barcode_code']);
            $data['barcode_code'] = $bc === '' ? null : $bc;
        }

        if (isset($data['name'])) $data['slug'] = Str::slug($data['name']);
        // Ensure unique slug on update
        if (isset($data['slug'])) {
            $baseSlug = $data['slug'];
            $i = 1;
            while (Product::where('slug', $data['slug'])->where('id', '!=', $product->id)->exists()) {
                $data['slug'] = $baseSlug . '-' . $i++;
            }
        }

        if (array_key_exists('colors', $data)) {
            $data['colors'] = $this->normalizeProductColorsInput($data['colors'] ?? null);
        }

        if (array_key_exists('variant_matrix', $data)) {
            $data['variant_matrix'] = $this->normalizeVariantMatrixInput($data['variant_matrix'] ?? null);
            $this->assertVariantSkuBarcodesUnique($data['variant_matrix'], $product->id);
            $this->syncProductStockFromVariantMatrix($data);
        }

        $data = $this->applyStockLabelPricing($data);
        $this->materializeProductMedia($data);

        $product->update($data);

        return $product->load(['category', 'brand', 'supplier', 'activeDiscount']);
    }

    public function destroy(Product $product)
    {
        DB::transaction(function () use ($product) {
            $this->deleteStockReceivedLedgerForProduct($product->id);
            $product->delete();
        });

        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Second-hand average bundle: set product unit price from the linked label (or cost ÷ qty).
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function applyStockLabelPricing(array $data): array
    {
        if (empty($data['stock_label_id'])) {
            return $data;
        }

        $label = Category::query()
            ->where('id', (int) $data['stock_label_id'])
            ->where('type', PaidOrderInventory::BARCODE_CATEGORY_TYPE)
            ->first();

        if (! $label) {
            return $data;
        }

        $master = $label->parent_id
            ? Category::query()->find($label->parent_id)
            : $label;

        if (! $master) {
            return $data;
        }

        if ($this->isAverageBundleCategory($master)) {
            $data['price'] = $this->averageBundleUnitPrice($master);
        }

        $barcode = trim((string) ($data['barcode_code'] ?? ''));
        if ($barcode === '' && filled($master->slug)) {
            $data['barcode_code'] = $master->slug;
        }

        return $data;
    }

    private function isAverageBundleCategory(Category $category): bool
    {
        return ($category->product_condition ?? 'new') === 'second_hand'
            && ($category->second_hand_sale_type ?? 'single') === 'average_bundle';
    }

    private function averageBundleUnitPrice(Category $master): float
    {
        if ($master->price !== null && (float) $master->price >= 0) {
            return round((float) $master->price, 2);
        }

        $cost = (float) ($master->bundle_total_cost ?? 0);
        $qty = (int) ($master->bundle_total_quantity ?? 0);
        if ($qty > 0 && $cost >= 0) {
            return round($cost / $qty, 2);
        }

        return 0.0;
    }

    /**
     * Remove immutable ledger rows that reference this product (FK restrictOnDelete).
     */
    private function deleteStockReceivedLedgerForProduct(int $productId): void
    {
        if (! Schema::hasTable('stock_received')) {
            return;
        }

        $ledgerIds = DB::table('stock_received')
            ->where('product_id', $productId)
            ->pluck('id');

        if ($ledgerIds->isEmpty()) {
            return;
        }

        DB::table('stock_received')
            ->whereIn('corrects_stock_received_id', $ledgerIds)
            ->update(['corrects_stock_received_id' => null]);

        DB::table('stock_received')
            ->where('product_id', $productId)
            ->delete();
    }
}
