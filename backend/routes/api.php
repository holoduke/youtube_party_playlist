<?php

use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\PlaylistController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VideoController;
use App\Http\Controllers\Api\YouTubeController;
use Illuminate\Support\Facades\Route;

// Users (simple selection - no auth)
Route::get('/users', [UserController::class, 'index']);
Route::get('/users/{user}', [UserController::class, 'show']);

// Categories and Videos
Route::apiResource('categories', CategoryController::class)->only(['index', 'show']);
Route::apiResource('videos', VideoController::class)->only(['index', 'show']);

// Playlists (with user_id filter support)
Route::get('/playlists/public', [PlaylistController::class, 'publicIndex']);
Route::apiResource('playlists', PlaylistController::class);
Route::post('/playlists/{playlist}/videos', [PlaylistController::class, 'addVideo']);
Route::delete('/playlists/{playlist}/videos/{video}', [PlaylistController::class, 'removeVideo']);
Route::put('/playlists/{playlist}/reorder', [PlaylistController::class, 'reorderVideos']);

// Live session management
Route::get('/playlists/live', [PlaylistController::class, 'liveIndex']);
Route::post('/playlists/{playlist}/go-live', [PlaylistController::class, 'goLive']);
Route::post('/playlists/{hostCode}/stop-live', [PlaylistController::class, 'stopLive']);
Route::get('/playlists/join/{shareCode}', [PlaylistController::class, 'join']);
Route::get('/playlists/host/{hostCode}', [PlaylistController::class, 'joinAsHost']);

// Live session actions (host)
Route::post('/playlists/{hostCode}/sync', [PlaylistController::class, 'sync']);
Route::post('/playlists/{hostCode}/approve', [PlaylistController::class, 'approveFromQueue']);

// Live session actions (guest)
Route::post('/playlists/{shareCode}/queue', [PlaylistController::class, 'queueSong']);
Route::post('/playlists/{shareCode}/like', [PlaylistController::class, 'likeVideo']);

// YouTube search/import
Route::get('/youtube/search', [YouTubeController::class, 'search']);
Route::get('/youtube/video', [YouTubeController::class, 'getVideo']);
Route::post('/youtube/import', [YouTubeController::class, 'import']);

// Player sync routes (for remote display)
Route::post('/player/sync', [PlayerController::class, 'sync']);
Route::get('/player/state', [PlayerController::class, 'state']);
