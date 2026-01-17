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
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->string('code', 8)->unique(); // Shareable party code (for guests)
            $table->string('host_code', 12)->unique(); // Host/admin code (for full control)
            $table->string('name')->nullable(); // Party name
            $table->foreignId('playlist_id')->constrained()->onDelete('cascade');
            $table->json('state')->nullable(); // Current player state (videos, crossfade, etc.)
            $table->json('queue')->nullable(); // Guest-requested songs queue
            $table->json('likes')->nullable(); // Liked videos {video_id: count}
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('parties');
    }
};
