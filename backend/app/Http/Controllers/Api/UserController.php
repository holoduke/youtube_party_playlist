<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Playlist;
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

        // Create a default playlist for the new user
        Playlist::create([
            'name' => 'My Playlist',
            'user_id' => $user->id,
            'is_public' => false,
        ]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'default_playlist_id' => $user->default_playlist_id,
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
                'default_playlist_id' => $user->default_playlist_id,
            ]
        ]);
    }

    // POST /api/users/{user}/default-playlist - Set default playlist
    public function setDefaultPlaylist(Request $request, User $user)
    {
        $validated = $request->validate([
            'playlist_id' => 'nullable|exists:playlists,id',
        ]);

        $user->update(['default_playlist_id' => $validated['playlist_id']]);

        return response()->json([
            'success' => true,
            'default_playlist_id' => $user->default_playlist_id,
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

    // DELETE /api/users/{user} - Delete user and all their data
    public function destroy(User $user)
    {
        // Delete all user's playlists (cascade will handle playlist_video pivot)
        $user->playlists()->delete();

        // Delete OAuth tokens if any
        if (method_exists($user, 'oauthTokens')) {
            $user->oauthTokens()->delete();
        }

        // Delete the user
        $user->delete();

        return response()->json(['message' => 'Account and all data deleted successfully']);
    }
}
