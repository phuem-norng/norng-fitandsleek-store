<?php

use Illuminate\Database\Migrations\Migration;

/**
 * Hero banners are managed in admin. Do not auto-insert Unsplash demo rows on fresh migrate —
 * the storefront shows a standard placeholder until real banners are added.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Intentionally empty — see frontend Hero + CatalogSectionUnavailable.
    }

    public function down(): void
    {
        //
    }
};
