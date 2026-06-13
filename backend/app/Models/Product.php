<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = [
        'category_id',
        'brand_id',
        'supplier_id',
        'sku',
        'barcode_code',
        'stock_label_id',
        'name',
        'slug',
        'description',
        'price',
        'cost_price',
        'compare_at_price',
        'image_url',
        'stock',
        'is_active',
        'is_vector_indexed',
        'vector_indexed_at',
        'vector_index_error',
        'gallery',
        'attributes',
        'audience',
        'model_info',
        'colors',
        'sizes',
        'variant_matrix',
        'size_guide',
        'delivery_info',
        'support_phone',
        'payment_methods',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'cost_price' => 'decimal:2',
        'compare_at_price' => 'decimal:2',
        'is_active' => 'boolean',
        'is_vector_indexed' => 'boolean',
        'vector_indexed_at' => 'datetime',
        'stock' => 'integer',
        'gallery' => 'array',
        'attributes' => 'array',
        'colors' => 'array',
        'sizes' => 'array',
        'variant_matrix' => 'array',
        'payment_methods' => 'array',
    ];

    protected $appends = [
        'discount_price',
        'discount_percentage',
        'final_price',
        'has_discount',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function discount()
    {
        return $this->hasOne(Discount::class);
    }

    public function images()
    {
        return $this->hasMany(ProductImage::class);
    }

    public function cartItems()
    {
        return $this->hasMany(CartItem::class);
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function wishlistItems()
    {
        return $this->hasMany(WishlistItem::class);
    }

    public function wishlists()
    {
        return $this->belongsToMany(Wishlist::class, 'wishlist_items');
    }

    public function activeDiscount()
    {
        return $this->hasOne(Discount::class)
            ->where('is_active', true)
            ->where('start_date', '<=', now())
            ->where('end_date', '>=', now());
    }

    public function getDiscountPriceAttribute(): ?float
    {
        $activeDiscount = $this->resolveActiveDiscount();
        if (!$activeDiscount || $activeDiscount->sale_price === null) {
            return null;
        }

        return (float) $activeDiscount->sale_price;
    }

    public function getDiscountPercentageAttribute(): ?int
    {
        $activeDiscount = $this->resolveActiveDiscount();
        if (!$activeDiscount) {
            return null;
        }

        if ($activeDiscount->discount_type === 'percentage') {
            return (int) round((float) $activeDiscount->discount_value);
        }

        $basePrice = (float) $this->price;
        $salePrice = $this->discount_price;
        if ($basePrice <= 0 || $salePrice === null || $salePrice >= $basePrice) {
            return null;
        }

        return (int) round((($basePrice - $salePrice) / $basePrice) * 100);
    }

    public function getFinalPriceAttribute(): float
    {
        return (float) ($this->discount_price ?? $this->price);
    }

    public function getHasDiscountAttribute(): bool
    {
        return $this->discount_price !== null && $this->discount_price < (float) $this->price;
    }

    private function resolveActiveDiscount(): ?Discount
    {
        if ($this->relationLoaded('activeDiscount')) {
            return $this->getRelation('activeDiscount');
        }

        return $this->activeDiscount()->first();
    }
}
