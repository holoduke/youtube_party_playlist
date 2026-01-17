<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;

class UserController extends Controller
{
    // GET /api/users - List all available users (for selection)
    public function index()
    {
        return User::all(['id', 'name', 'email']);
    }

    // GET /api/users/{user} - Get user with their playlists
    public function show(User $user)
    {
        return $user->load(['playlists' => function ($query) {
            $query->withCount('videos');
        }]);
    }
}
