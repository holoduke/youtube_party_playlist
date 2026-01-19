<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    // POST /api/register - Register new account
    public function register(Request $request)
    {
        $request->validate([
            'username' => 'required|string|min:3|max:50|unique:users,name',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6|confirmed',
        ], [
            'username.unique' => 'This username is already taken.',
            'email.unique' => 'This email is already registered.',
            'password.confirmed' => 'Passwords do not match.',
        ]);

        $user = User::create([
            'name' => $request->username,
            'email' => $request->email,
            'password' => $request->password, // Will be hashed by the model's cast
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ]
        ], 201);
    }

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
