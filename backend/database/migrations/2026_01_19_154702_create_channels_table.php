<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->onDelete('cascade');
            $table->string('hash', 12)->unique(); // Permanent channel URL identifier
            $table->string('broadcast_code', 4)->nullable(); // 4-digit code for easy joining
            $table->boolean('is_broadcasting')->default(false);
            $table->foreignId('current_playlist_id')->nullable()->constrained('playlists')->onDelete('set null');
            $table->json('state')->nullable(); // Current broadcast state (videos, crossfade, etc.)
            $table->timestamps();

            $table->index('broadcast_code');
            $table->index('is_broadcasting');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channels');
    }
};
