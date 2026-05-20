<?php

namespace App\Http\Controllers\Api\Admin;

use App\Jobs\SyncProductToQdrant;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Message;
use App\Services\PaidOrderInventory;
use App\Services\ProductGalleryImageProcessor;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductAdminController extends Controller
{
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
     * @return array<int, array{color: string, size: string, qty: int, sku_barcode: ?string}>|null
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
            $key = mb_strtolower($c)."\0".mb_strtolower($s);
            $byKey[$key] = [
                'color' => $c,
                'size' => $s,
                'qty' => $q,
                'sku_barcode' => $skuBarcode !== '' ? Str::limit($skuBarcode, 120, '') : null,
            ];
        }

        return count($byKey) > 0 ? array_values($byKey) : null;
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

        $path = app(ProductGalleryImageProcessor::class)->storeNormalized($request->file('image'));
        // Same-origin path so clients never receive Docker-internal APP_URL (e.g. http://localhost:8001/...).
        $normalizedPath = str_replace('\\', '/', $path);
        $url = '/storage/'.$normalizedPath;

        return response()->json([
            'message' => 'Image uploaded',
            'image_url' => $url,
        ], 200);
    }
    public function index()
    {
        return Product::with(['category', 'brand', 'activeSale'])->orderByDesc('id')->paginate(20);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
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
        }

        $product = Product::create($data);

        if ($product->is_active && filled($product->image_url)) {
            SyncProductToQdrant::dispatch($product->id)->afterCommit();
        }

        // Auto-create a customer/guest message for new products (EN + KM)
        try {
            $payload = [
                'title' => 'New Product: ' . $product->name,
                'content' => 'Just added: ' . $product->name,
                'target_audience' => 'all',
                'is_active' => true,
                'created_by' => $request->user()->id,
                'link_url' => url('/p/' . $product->slug),
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
        return $product->load(['category', 'brand', 'activeSale']);
    }

    public function update(Request $request, Product $product)
    {
        $data = $request->validate([
            'category_id' => ['sometimes', 'integer'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
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
        }

        $product->update($data);

        if ($product->is_active && filled($product->image_url)
            && (array_key_exists('image_url', $data) || array_key_exists('is_active', $data))) {
            SyncProductToQdrant::dispatch($product->id)->afterCommit();
        }

        return $product->load(['category', 'brand', 'activeSale']);
    }

    public function destroy(Product $product)
    {
        $product->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
