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
            // User ownership
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('set null');

            // Status: 'stopped' (default), 'playing' (local), 'live' (shareable)
            $table->string('status', 20)->default('stopped');

            // Share codes (only set when going live)
            $table->string('share_code', 8)->nullable()->unique();
            $table->string('host_code', 12)->nullable()->unique();

            // Live state JSON fields
            $table->json('state')->nullable();   // Player state (crossfade, current videos)
            $table->json('queue')->nullable();   // Song requests from guests
            $table->json('likes')->nullable();   // Video likes {video_id: count}
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('playlists', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn([
                'user_id',
                'status',
                'share_code',
                'host_code',
                'state',
                'queue',
                'likes',
            ]);
        });
    }
};
