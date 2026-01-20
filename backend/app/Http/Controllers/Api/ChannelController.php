<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\Playlist;
use App\Models\User;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    /**
     * GET /api/channel/{userId} - Get or create channel for user
     */
    public function show(int $userId)
    {
        $user = User::findOrFail($userId);
        $channel = Channel::getOrCreateForUser($user);

        return response()->json([
            'channel' => $channel->load('currentPlaylist'),
        ]);
    }

    /**
     * POST /api/channel/{userId}/start-broadcast - Start broadcasting
     */
    public function startBroadcast(Request $request, int $userId)
    {
        $user = User::findOrFail($userId);
        $channel = Channel::getOrCreateForUser($user);

        $validated = $request->validate([
            'playlist_id' => 'nullable|exists:playlists,id',
        ]);

        $playlist = null;
        if (!empty($validated['playlist_id'])) {
            $playlist = Playlist::find($validated['playlist_id']);
        }

        $channel->startBroadcast($playlist);

        return response()->json([
            'success' => true,
            'channel' => $channel->fresh()->load('currentPlaylist'),
            'broadcast_url' => "/broadcast/{$channel->hash}",
        ]);
    }

    /**
     * POST /api/channel/{userId}/stop-broadcast - Stop broadcasting
     */
    public function stopBroadcast(int $userId)
    {
        $user = User::findOrFail($userId);
        $channel = Channel::where('user_id', $user->id)->first();

        if (!$channel || !$channel->is_broadcasting) {
            return response()->json(['error' => 'Not broadcasting'], 400);
        }

        $channel->stopBroadcast();

        return response()->json(['success' => true]);
    }

    /**
     * POST /api/channel/{userId}/sync - Sync broadcast state
     */
    public function sync(Request $request, int $userId)
    {
        $user = User::findOrFail($userId);
        $channel = Channel::where('user_id', $user->id)
            ->where('is_broadcasting', true)
            ->firstOrFail();

        $validated = $request->validate([
            'playlist_id' => 'nullable|exists:playlists,id',
            'player1_video' => 'nullable|array',
            'player2_video' => 'nullable|array',
            'player1_playing' => 'nullable|boolean',
            'player2_playing' => 'nullable|boolean',
            'player1_time' => 'nullable|numeric',
            'player2_time' => 'nullable|numeric',
            'crossfade_value' => 'required|numeric|min:0|max:100',
            'started_at' => 'nullable|numeric',
            'fade_trigger' => 'nullable|array',
            'is_stopped' => 'nullable|boolean',
        ]);

        // Update current playlist if changed
        if (isset($validated['playlist_id'])) {
            $channel->current_playlist_id = $validated['playlist_id'];
        }

        $channel->state = [
            'player1_video' => $validated['player1_video'] ?? null,
            'player2_video' => $validated['player2_video'] ?? null,
            'player1_playing' => $validated['player1_playing'] ?? false,
            'player2_playing' => $validated['player2_playing'] ?? false,
            'player1_time' => $validated['player1_time'] ?? 0,
            'player2_time' => $validated['player2_time'] ?? 0,
            'crossfade_value' => $validated['crossfade_value'],
            'started_at' => $validated['started_at'] ?? null,
            'fade_trigger' => $validated['fade_trigger'] ?? null,
            'is_stopped' => $validated['is_stopped'] ?? false,
            'updated_at' => now()->toISOString(),
        ];

        $channel->save();

        return response()->json(['success' => true]);
    }

    /**
     * GET /api/channel/watch/{hash} - Get channel state for viewers
     */
    public function watch(string $hash)
    {
        $channel = Channel::with('currentPlaylist')
            ->where('hash', $hash)
            ->where('is_broadcasting', true)
            ->first();

        if (!$channel) {
            return response()->json([
                'is_broadcasting' => false,
                'message' => 'Channel not found or not broadcasting',
            ], 404);
        }

        return response()->json([
            'is_broadcasting' => true,
            'state' => $channel->state,
            'idle_image_url' => $channel->idle_image_url,
            'playlist_name' => $channel->currentPlaylist?->name,
        ]);
    }

    /**
     * GET /api/channel/code/{code} - Lookup channel by 4-digit code
     */
    public function getByCode(string $code)
    {
        $channel = Channel::where('broadcast_code', $code)
            ->where('is_broadcasting', true)
            ->first();

        if (!$channel) {
            return response()->json([
                'success' => false,
                'message' => 'Channel not found or not broadcasting',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'hash' => $channel->hash,
            'broadcast_url' => "/broadcast/{$channel->hash}",
        ]);
    }

    /**
     * GET /api/channels/live - Get all live channels
     */
    public function liveIndex()
    {
        $channels = Channel::with(['user:id,name', 'currentPlaylist:id,name'])
            ->where('is_broadcasting', true)
            ->get();

        return response()->json($channels);
    }
}
