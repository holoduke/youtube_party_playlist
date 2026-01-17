<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    // POST /api/login - Simple login with username/password
    public function login(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        // Find user by name (case-insensitive)
        $user = User::whereRaw('LOWER(name) = ?', [strtolower($request->username)])->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['error' => 'Invalid username or password'], 401);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ]
        ]);
    }

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
