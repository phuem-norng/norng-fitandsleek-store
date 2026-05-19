<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Fresh databases (e.g. after pointing DB_DATABASE at a new schema) often have no rows in `banners`,
 * which leaves the storefront hero empty. Seed a small default set only when the table is completely empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('banners')) {
            return;
        }

        if (DB::table('banners')->count() > 0) {
            return;
        }

        $now = now();
        $rows = [
            [
                'title' => 'Up to 50% Off',
                'subtitle' => 'Limited-time discounts on selected items.',
                'image_url' => 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=70',
                'link_url' => '/search?gender=sale',
                'position' => 'hero',
                'is_active' => true,
                'order' => 1,
                'page' => 'home',
                'sort_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Fresh street-ready drops',
                'subtitle' => 'New arrivals curated for daily wear.',
                'image_url' => 'https://images.unsplash.com/photo-1520975916090-3105956dac38?auto=format&fit=crop&w=1200&q=70',
                'link_url' => '/search?tab=new',
                'position' => 'hero',
                'is_active' => true,
                'order' => 2,
                'page' => 'home',
                'sort_order' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ];

        foreach ($rows as $row) {
            $insert = $row;
            if (!Schema::hasColumn('banners', 'page')) {
                unset($insert['page']);
            }
            if (!Schema::hasColumn('banners', 'sort_order')) {
                unset($insert['sort_order']);
            }
            DB::table('banners')->insert($insert);
        }
    }

    public function down(): void
    {
        //
    }
};
