<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Playlist;
use App\Models\Video;
use App\Services\YouTubeOAuthService;
use Illuminate\Http\Request;

class YouTubePlaylistController extends Controller
{
    protected YouTubeOAuthService $youtube;

    public function __construct(YouTubeOAuthService $youtube)
    {
        $this->youtube = $youtube;
    }

    /**
     * Get user's YouTube playlists.
     */
    public function myPlaylists(Request $request)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $user = User::findOrFail($request->user_id);

        if (!$user->hasGoogleConnected()) {
            return response()->json([
                'error' => 'Google account not connected',
                'needs_auth' => true,
            ], 401);
        }

        try {
            $playlists = $this->youtube->getUserPlaylists($user);
            return response()->json($playlists);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
                'needs_auth' => str_contains($e->getMessage(), 'reconnect'),
            ], 401);
        }
    }

    /**
     * Get items from a YouTube playlist.
     */
    public function playlistItems(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'playlist_id' => 'required|string',
        ]);

        $user = User::findOrFail($request->user_id);

        try {
            $videos = $this->youtube->getPlaylistItems($user, $request->playlist_id);
            return response()->json($videos);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 401);
        }
    }

    /**
     * Import a YouTube playlist into the app.
     */
    public function importPlaylist(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'youtube_playlist_id' => 'required|string',
            'playlist_name' => 'nullable|string|max:255',
            'is_public' => 'nullable|boolean',
            'target_playlist_id' => 'nullable|exists:playlists,id',
        ]);

        $user = User::findOrFail($request->user_id);

        try {
            // Fetch videos from YouTube
            $youtubeVideos = $this->youtube->getPlaylistItems($user, $request->youtube_playlist_id);

            // Either use existing playlist or create new one
            if ($request->target_playlist_id) {
                $playlist = Playlist::findOrFail($request->target_playlist_id);
                // Get current max position
                $maxPosition = $playlist->videos()->max('position') ?? -1;
            } else {
                // Create local playlist
                $playlist = Playlist::create([
                    'name' => $request->playlist_name ?? 'Imported Playlist',
                    'user_id' => $user->id,
                    'is_public' => $request->is_public ?? false,
                    'description' => 'Imported from YouTube',
                ]);
                $maxPosition = -1;
            }

            // Import each video
            $importedCount = 0;
            foreach ($youtubeVideos as $index => $ytVideo) {
                // Find or create video in database
                $video = Video::firstOrCreate(
                    ['youtube_id' => $ytVideo['youtube_id']],
                    [
                        'title' => $ytVideo['title'],
                        'thumbnail_url' => $ytVideo['thumbnail_url'],
                        'channel' => $ytVideo['channel'] ?? null,
                        'duration' => $ytVideo['duration'] ?? null,
                    ]
                );

                // Update existing video with metadata if it was missing
                if ($video->wasRecentlyCreated === false) {
                    $updates = [];
                    if (empty($video->channel) && !empty($ytVideo['channel'])) {
                        $updates['channel'] = $ytVideo['channel'];
                    }
                    if (empty($video->duration) && !empty($ytVideo['duration'])) {
                        $updates['duration'] = $ytVideo['duration'];
                    }
                    if (!empty($updates)) {
                        $video->update($updates);
                    }
                }

                // Skip if video already in playlist
                if ($playlist->videos()->where('video_id', $video->id)->exists()) {
                    continue;
                }

                // Add to playlist with position
                $playlist->videos()->attach($video->id, ['position' => $maxPosition + 1 + $index]);
                $importedCount++;
            }

            return response()->json([
                'success' => true,
                'playlist' => $playlist->load('videos'),
                'imported_count' => $importedCount,
                'added_to_existing' => (bool) $request->target_playlist_id,
            ], 201);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
