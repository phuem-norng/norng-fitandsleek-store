<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $fillable = [
        'parent_id',
        'name',
        'slug',
        'type',
        'image_path',
        'sort_order',
        'is_active',
        'description',
        'details',
        'price',
        'compare_at_price',
        'label_color',
        'image_url',
        'gallery',
        'sku',
        'cost',
        'unit',
        'origin',
        'brand_id',
        'label_category_id',
        'label_category_ids',
        'manage_stock',
        'stock',
        'stock_received',
        'min_stock',
        'date_in',
        'product_condition',
        'second_hand_sale_type',
        'bundle_total_cost',
        'bundle_total_quantity',
        'has_variation',
        'variation_product_type',
        'variation_colors',
        'variation_sizes',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'price' => 'float',
        'compare_at_price' => 'float',
        'cost' => 'float',
        'manage_stock' => 'boolean',
        'has_variation' => 'boolean',
        'stock' => 'integer',
        'stock_received' => 'integer',
        'min_stock' => 'integer',
        'date_in' => 'date',
        'bundle_total_cost' => 'float',
        'bundle_total_quantity' => 'integer',
        'variation_sizes' => 'array',
        'label_category_ids' => 'array',
    ];

    // Relationships
    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id');
    }

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
