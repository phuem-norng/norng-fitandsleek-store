<?php

namespace App\Http\Controllers\Api\Storefront;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Support\Media;
use Illuminate\Support\Facades\Cache;

class CategoryController extends Controller
{
    public function index()
    {
        $cats = Cache::remember('storefront:categories:v1', 600, function () {
            return Category::query()
                ->where('is_active', true)
                ->catalogOnly()
                ->orderBy('sort_order')
                ->get()
                ->map(fn ($c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'slug' => $c->slug,
                    'type' => $c->type,
                    'image_url' => Media::url($c->image_path),
                ])
                ->values()
                ->all();
        });

        return response()->json($cats);
    }
}
