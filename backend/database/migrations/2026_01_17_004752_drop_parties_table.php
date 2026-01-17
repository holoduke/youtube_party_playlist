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
        Schema::dropIfExists('parties');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Parties functionality has been merged into playlists
        // This table is no longer needed
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->string('code', 8)->unique();
            $table->string('host_code', 12)->unique();
            $table->string('name')->nullable();
            $table->foreignId('playlist_id')->constrained()->onDelete('cascade');
            $table->json('state')->nullable();
            $table->json('queue')->nullable();
            $table->json('likes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }
};
