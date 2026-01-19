<?php

use App\Http\Controllers\Api\GoogleAuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// Google OAuth routes (need session for state verification)
Route::get('/api/auth/google/redirect', [GoogleAuthController::class, 'redirect']);
Route::get('/api/auth/google/callback', [GoogleAuthController::class, 'callback']);
