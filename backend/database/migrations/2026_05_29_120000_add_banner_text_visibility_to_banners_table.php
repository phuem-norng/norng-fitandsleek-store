<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            if (! Schema::hasColumn('banners', 'show_badge')) {
                $table->boolean('show_badge')->default(true)->after('subtitle');
            }
            if (! Schema::hasColumn('banners', 'show_title')) {
                $table->boolean('show_title')->default(true)->after('show_badge');
            }
            if (! Schema::hasColumn('banners', 'show_subtitle')) {
                $table->boolean('show_subtitle')->default(true)->after('show_title');
            }
            if (! Schema::hasColumn('banners', 'show_cta')) {
                $table->boolean('show_cta')->default(true)->after('show_subtitle');
            }
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $columns = ['show_badge', 'show_title', 'show_subtitle', 'show_cta'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('banners', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
