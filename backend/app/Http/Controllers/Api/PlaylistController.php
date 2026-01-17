<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Playlist;
use App\Models\Video;
use App\Events\PlaylistStateChanged;
use Illuminate\Http\Request;

class PlaylistController extends Controller
{
    // GET /api/playlists?user_id=X - Get playlists (optionally filtered by user)
    public function index(Request $request)
    {
        $query = Playlist::withCount('videos')->with('user:id,name');

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        return $query->get();
    }

    // GET /api/playlists/public?search=X&exclude_user_id=X - Search public playlists
    public function publicIndex(Request $request)
    {
        $query = Playlist::withCount('videos')
            ->with('user:id,name')
            ->where('is_public', true);

        // Exclude current user's playlists from public list
        if ($request->has('exclude_user_id')) {
            $query->where('user_id', '!=', $request->exclude_user_id);
        }

        if ($request->has('search') && $request->search) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        return $query->orderBy('created_at', 'desc')->limit(50)->get();
    }

    // POST /api/playlists - Create playlist with user ownership
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'user_id' => 'required|exists:users,id',
            'is_public' => 'nullable|boolean',
        ]);

        $playlist = Playlist::create($validated);

        return response()->json($playlist, 201);
    }

    // GET /api/playlists/{playlist} - Get single playlist with videos
    public function show(Playlist $playlist)
    {
        return $playlist->load(['videos.categories', 'user:id,name']);
    }

    // PUT /api/playlists/{playlist} - Update playlist
    public function update(Request $request, Playlist $playlist)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'is_public' => 'nullable|boolean',
        ]);

        $playlist->update($validated);

        return response()->json($playlist);
    }

    // DELETE /api/playlists/{playlist} - Delete playlist
    public function destroy(Playlist $playlist)
    {
        // Stop live session if active
        if ($playlist->isLive()) {
            event(new PlaylistStateChanged($playlist->share_code, ['type' => 'ended']));
        }

        $playlist->delete();

        return response()->json(null, 204);
    }

    // POST /api/playlists/{playlist}/videos - Add video to playlist
    public function addVideo(Request $request, Playlist $playlist)
    {
        $validated = $request->validate([
            'video_id' => 'required|exists:videos,id',
        ]);

        // Check if video already in playlist
        if ($playlist->videos()->where('video_id', $validated['video_id'])->exists()) {
            return $playlist->load(['videos.categories']);
        }

        $maxPosition = $playlist->videos()->max('position') ?? -1;

        $playlist->videos()->attach($validated['video_id'], [
            'position' => $maxPosition + 1
        ]);

        return $playlist->load(['videos.categories']);
    }

    // DELETE /api/playlists/{playlist}/videos/{video} - Remove video from playlist
    public function removeVideo(Playlist $playlist, int $videoId)
    {
        $playlist->videos()->detach($videoId);

        // Reorder remaining videos
        $videos = $playlist->videos()->orderBy('pivot_position')->get();
        foreach ($videos as $index => $video) {
            $playlist->videos()->updateExistingPivot($video->id, ['position' => $index]);
        }

        return $playlist->load(['videos.categories']);
    }

    // PUT /api/playlists/{playlist}/reorder - Reorder videos in playlist
    public function reorderVideos(Request $request, Playlist $playlist)
    {
        $validated = $request->validate([
            'video_ids' => 'required|array',
            'video_ids.*' => 'exists:videos,id',
        ]);

        foreach ($validated['video_ids'] as $index => $videoId) {
            $playlist->videos()->updateExistingPivot($videoId, ['position' => $index]);
        }

        return $playlist->load(['videos.categories']);
    }

    // ==================== LIVE SESSION ENDPOINTS ====================

    // POST /api/playlists/{playlist}/go-live - Start a live session
    public function goLive(Playlist $playlist)
    {
        $playlist->goLive();
        $playlist->makeVisible('host_code');
        $playlist->load('videos');

        return response()->json([
            'playlist' => $playlist,
            'host_code' => $playlist->host_code,
            'share_code' => $playlist->share_code,
        ]);
    }

    // POST /api/playlists/{hostCode}/stop-live - Stop a live session
    public function stopLive(string $hostCode)
    {
        $playlist = Playlist::where('host_code', strtoupper($hostCode))->firstOrFail();

        // Broadcast end event before clearing codes
        event(new PlaylistStateChanged($playlist->share_code, ['type' => 'ended']));

        $playlist->stopLive();

        return response()->json(['success' => true]);
    }

    // GET /api/playlists/join/{shareCode} - Join a live playlist as guest
    public function join(string $shareCode)
    {
        $playlist = Playlist::with('videos')
            ->where('share_code', strtoupper($shareCode))
            ->where('status', 'live')
            ->firstOrFail();

        return response()->json([
            'playlist' => $playlist,
            'isHost' => false,
        ]);
    }

    // GET /api/playlists/host/{hostCode} - Join as host
    public function joinAsHost(string $hostCode)
    {
        $playlist = Playlist::with('videos')
            ->where('host_code', strtoupper($hostCode))
            ->where('status', 'live')
            ->firstOrFail();

        $playlist->makeVisible('host_code');

        return response()->json([
            'playlist' => $playlist,
            'isHost' => true,
        ]);
    }

    // POST /api/playlists/{hostCode}/sync - Host syncs state to all participants
    public function sync(Request $request, string $hostCode)
    {
        $playlist = Playlist::where('host_code', strtoupper($hostCode))
            ->where('status', 'live')
            ->firstOrFail();

        $state = $request->validate([
            'player1Video' => 'nullable|array',
            'player2Video' => 'nullable|array',
            'crossfadeValue' => 'nullable|numeric|min:0|max:100',
            'playlistIndex' => 'nullable|integer|min:0',
            'isPlaying' => 'nullable|boolean',
        ]);

        // Merge with existing state
        $newState = array_merge($playlist->state ?? [], $state);
        $playlist->update(['state' => $newState]);

        // Broadcast to all participants
        event(new PlaylistStateChanged($playlist->share_code, [
            'type' => 'state',
            'state' => $newState,
        ]));

        return response()->json(['success' => true, 'state' => $newState]);
    }

    // POST /api/playlists/{shareCode}/queue - Guest requests a song
    public function queueSong(Request $request, string $shareCode)
    {
        $playlist = Playlist::where('share_code', strtoupper($shareCode))
            ->where('status', 'live')
            ->firstOrFail();

        $request->validate([
            'video_id' => 'required|exists:videos,id',
        ]);

        $video = Video::findOrFail($request->video_id);

        $queue = $playlist->queue ?? [];
        $queue[] = [
            'id' => $video->id,
            'title' => $video->title,
            'youtube_id' => $video->youtube_id,
            'thumbnail_url' => $video->thumbnail_url,
            'requested_at' => now()->toISOString(),
        ];

        $playlist->update(['queue' => $queue]);

        // Broadcast queue update
        event(new PlaylistStateChanged($playlist->share_code, [
            'type' => 'queue',
            'queue' => $queue,
        ]));

        return response()->json(['success' => true, 'queue' => $queue]);
    }

    // POST /api/playlists/{shareCode}/like - Guest likes a video
    public function likeVideo(Request $request, string $shareCode)
    {
        $playlist = Playlist::where('share_code', strtoupper($shareCode))
            ->where('status', 'live')
            ->firstOrFail();

        $request->validate([
            'video_id' => 'required|exists:videos,id',
        ]);

        $videoId = (string) $request->video_id;
        $likes = $playlist->likes ?? [];
        $likes[$videoId] = ($likes[$videoId] ?? 0) + 1;

        $playlist->update(['likes' => $likes]);

        // Broadcast likes update
        event(new PlaylistStateChanged($playlist->share_code, [
            'type' => 'likes',
            'likes' => $likes,
        ]));

        return response()->json(['success' => true, 'likes' => $likes]);
    }

    // POST /api/playlists/{hostCode}/approve - Host approves a song from queue
    public function approveFromQueue(Request $request, string $hostCode)
    {
        $playlist = Playlist::where('host_code', strtoupper($hostCode))
            ->where('status', 'live')
            ->firstOrFail();

        $request->validate([
            'queue_index' => 'required|integer|min:0',
        ]);

        $queue = $playlist->queue ?? [];

        if (isset($queue[$request->queue_index])) {
            $approved = $queue[$request->queue_index];
            array_splice($queue, $request->queue_index, 1);
            $playlist->update(['queue' => $queue]);

            // Broadcast queue update with approved item
            event(new PlaylistStateChanged($playlist->share_code, [
                'type' => 'queue',
                'queue' => $queue,
                'approved' => $approved,
            ]));

            return response()->json(['success' => true, 'approved' => $approved, 'queue' => $queue]);
        }

        return response()->json(['error' => 'Invalid queue index'], 400);
    }

    // GET /api/playlists/live - Get all live playlists
    public function liveIndex()
    {
        return Playlist::with('user:id,name')
            ->withCount('videos')
            ->where('status', 'live')
            ->get();
    }
}
