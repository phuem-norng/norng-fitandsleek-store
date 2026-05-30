<?php

namespace App\Services;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TelegramProductSearchService
{
    private const RESULT_LIMIT = 8;

    /**
     * @return Collection<int, Product>
     */
    public function search(string $query): Collection
    {
        $term = trim($query);
        if ($term === '') {
            return collect();
        }

        $words = $this->tokenize($term);
        $driver = DB::connection()->getDriverName();

        $products = Product::query()
            ->with([
                'brand:id,name',
                'category:id,name,slug',
                'images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order'),
            ])
            ->where('is_active', true)
            ->where(function (Builder $builder) use ($term, $words, $driver) {
                $this->applyTermMatch($builder, $term, $driver);

                foreach ($words as $word) {
                    if (mb_strlen($word) < 2) {
                        continue;
                    }
                    $builder->orWhere(function (Builder $wordQuery) use ($word, $driver) {
                        $this->applyTermMatch($wordQuery, $word, $driver);
                    });
                }

                if (mb_strlen($term) >= 4) {
                    $fuzzy = $this->fuzzyPattern($term);
                    if ($fuzzy !== '') {
                        $builder->orWhere(function (Builder $fuzzyQuery) use ($fuzzy, $driver) {
                            $this->applyLike($fuzzyQuery, 'name', $fuzzy, $driver);
                            $this->applyLike($fuzzyQuery, 'slug', str_replace('%', '', $fuzzy), $driver, true);
                        });
                    }
                }
            })
            ->orderByDesc('id')
            ->limit(self::RESULT_LIMIT * 3)
            ->get();

        return $this->rankResults($products, $term, $words)
            ->take(self::RESULT_LIMIT)
            ->values();
    }

    /**
     * @return Collection<int, Product>
     */
    public function searchByCategorySlug(string $slug): Collection
    {
        $slug = trim($slug);
        if ($slug === '') {
            return collect();
        }

        return Product::query()
            ->with([
                'brand:id,name',
                'category:id,name,slug',
                'images' => fn ($q) => $q->orderByDesc('is_primary')->orderBy('sort_order'),
            ])
            ->where('is_active', true)
            ->whereHas('category', function (Builder $query) use ($slug) {
                $query->catalogOnly()
                    ->where('slug', $slug);
            })
            ->orderByDesc('id')
            ->limit(self::RESULT_LIMIT)
            ->get();
    }

    /**
     * @return list<string>
     */
    public function popularTerms(): array
    {
        $fromDb = Product::query()
            ->where('is_active', true)
            ->whereNotNull('name')
            ->orderByDesc('id')
            ->limit(30)
            ->pluck('name')
            ->flatMap(fn (string $name) => $this->tokenize($name))
            ->filter(fn (string $w) => mb_strlen($w) >= 3)
            ->unique()
            ->take(6)
            ->values()
            ->all();

        $brandIds = Product::query()
            ->where('is_active', true)
            ->whereNotNull('brand_id')
            ->distinct()
            ->pluck('brand_id');

        $brands = Brand::query()
            ->whereIn('id', $brandIds)
            ->orderBy('name')
            ->limit(4)
            ->pluck('name')
            ->map(fn (string $n) => mb_strtolower(trim($n)))
            ->all();

        $defaults = ['belt', 'cardigan', 'nike', 'shirt', 'dress', 'shoes', 'carpenter', 'tactical', 'harness', 'knit'];

        $merged = array_merge($brands, $fromDb, $defaults);

        return array_values(array_unique(array_filter($merged, fn (string $t) => preg_match('/^[a-z0-9]{2,20}$/', $t) === 1)));
    }

    /**
     * @return Collection<int, Category>
     */
    public function catalogCategories(): Collection
    {
        return Category::query()
            ->catalogOnly()
            ->where('is_active', true)
            ->whereHas('products', fn (Builder $q) => $q->where('is_active', true))
            ->orderBy('sort_order')
            ->orderBy('name')
            ->limit(8)
            ->get(['id', 'name', 'slug']);
    }

    /**
     * @return list<string>
     */
    private function tokenize(string $text): array
    {
        $text = mb_strtolower(trim($text));
        $parts = preg_split('/[\s\-_\/]+/u', $text) ?: [];

        return array_values(array_filter($parts, fn (string $p) => mb_strlen($p) >= 2));
    }

    private function applyTermMatch(Builder $query, string $term, string $driver): void
    {
        $like = '%'.$term.'%';

        $query->where(function (Builder $inner) use ($like, $term, $driver) {
            $this->applyLike($inner, 'name', $like, $driver);
            $this->applyLike($inner, 'description', $like, $driver, true);
            $this->applyLike($inner, 'sku', $like, $driver, true);
            $this->applyLike($inner, 'slug', str_replace(' ', '-', mb_strtolower($term)), $driver, true);

            $inner->orWhereHas('brand', function (Builder $brand) use ($like, $driver) {
                $this->applyLike($brand, 'name', $like, $driver);
            });

            $inner->orWhereHas('category', function (Builder $category) use ($like, $driver) {
                $category->catalogOnly();
                $this->applyLike($category, 'name', $like, $driver);
                $this->applyLike($category, 'slug', $like, $driver, true);
            });
        });
    }

    private function applyLike(
        Builder $query,
        string $column,
        string $value,
        string $driver,
        bool $or = false
    ): void {
        $method = $or ? 'orWhere' : 'where';

        if ($driver === 'pgsql') {
            $query->{$method}($column, 'ilike', $value);

            return;
        }

        $query->{$method.'Raw'}('LOWER('.$column.') LIKE ?', [mb_strtolower($value)]);
    }

    private function fuzzyPattern(string $term): string
    {
        $term = mb_strtolower(trim($term));
        if (mb_strlen($term) < 4) {
            return '';
        }

        $chars = preg_split('//u', $term, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return $chars === [] ? '' : '%'.implode('%', $chars).'%';
    }

    /**
     * @param  Collection<int, Product>  $products
     * @param  list<string>  $words
     * @return Collection<int, Product>
     */
    private function rankResults(Collection $products, string $term, array $words): Collection
    {
        $termLower = mb_strtolower($term);

        return $products
            ->sortByDesc(function (Product $product) use ($termLower, $words) {
                $name = mb_strtolower((string) $product->name);
                $brand = mb_strtolower((string) ($product->brand?->name ?? ''));
                $category = mb_strtolower((string) ($product->category?->name ?? ''));
                $slug = mb_strtolower((string) $product->slug);

                $score = 0;

                if ($name === $termLower) {
                    $score += 100;
                } elseif (str_starts_with($name, $termLower)) {
                    $score += 80;
                } elseif (str_contains($name, $termLower)) {
                    $score += 60;
                }

                if ($brand === $termLower || str_contains($brand, $termLower)) {
                    $score += 50;
                }

                if (str_contains($category, $termLower)) {
                    $score += 35;
                }

                if (str_contains($slug, str_replace(' ', '-', $termLower))) {
                    $score += 25;
                }

                foreach ($words as $word) {
                    if (str_contains($name, $word)) {
                        $score += 15;
                    }
                }

                return $score;
            })
            ->values();
    }
}
