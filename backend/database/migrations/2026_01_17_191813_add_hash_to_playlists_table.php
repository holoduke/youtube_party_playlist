<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('playlists', function (Blueprint $table) {
            $table->string('hash', 11)->unique()->nullable()->after('id');
        });

        // Generate hashes for existing playlists
        $playlists = \App\Models\Playlist::whereNull('hash')->get();
        foreach ($playlists as $playlist) {
            $playlist->hash = \App\Models\Playlist::generateHash($playlist->id);
            $playlist->save();
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('playlists', function (Blueprint $table) {
            $table->dropColumn('hash');
        });
    }
};
