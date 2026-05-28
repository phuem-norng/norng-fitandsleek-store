<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        foreach (NeonHostingSeeder::catalogCategories() as $row) {
            $slug = $row['slug'] ?? Str::slug($row['name']);

            Category::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $row['name'],
                    'type' => $row['type'] ?? null,
                    'gender' => $row['gender'] ?? null,
                    'sort_order' => $row['sort_order'] ?? 0,
                    'is_active' => true,
                ]
            );
        }
    }
}
