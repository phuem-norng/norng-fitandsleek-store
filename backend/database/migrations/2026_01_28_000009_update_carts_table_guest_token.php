<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (! Schema::hasColumn('carts', 'session_id')) {
            if (! Schema::hasColumn('carts', 'guest_token')) {
                Schema::table('carts', function (Blueprint $table) {
                    $table->string('guest_token')->nullable()->unique();
                });
            }

            return;
        }

        // SQLite: drop index before dropColumn or rebuild fails (carts_session_id_index).
        Schema::table('carts', function (Blueprint $table) {
            $table->dropIndex(['session_id']);
        });

        Schema::table('carts', function (Blueprint $table) {
            $table->dropColumn('session_id');
        });

        if (! Schema::hasColumn('carts', 'guest_token')) {
            Schema::table('carts', function (Blueprint $table) {
                $table->string('guest_token')->nullable()->unique();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('carts', 'guest_token')) {
            Schema::table('carts', function (Blueprint $table) {
                $table->dropUnique(['guest_token']);
            });

            Schema::table('carts', function (Blueprint $table) {
                $table->dropColumn('guest_token');
            });
        }

        if (! Schema::hasColumn('carts', 'session_id')) {
            Schema::table('carts', function (Blueprint $table) {
                $table->uuid('session_id')->nullable()->index();
            });
        }
    }
};
