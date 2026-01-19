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
            'playlist_name' => 'required|string|max:255',
            'is_public' => 'nullable|boolean',
        ]);

        $user = User::findOrFail($request->user_id);

        try {
            // Fetch videos from YouTube
            $youtubeVideos = $this->youtube->getPlaylistItems($user, $request->youtube_playlist_id);

            // Create local playlist
            $playlist = Playlist::create([
                'name' => $request->playlist_name,
                'user_id' => $user->id,
                'is_public' => $request->is_public ?? false,
                'description' => 'Imported from YouTube',
            ]);

            // Import each video
            $importedCount = 0;
            foreach ($youtubeVideos as $index => $ytVideo) {
                // Find or create video in database
                $video = Video::firstOrCreate(
                    ['youtube_id' => $ytVideo['youtube_id']],
                    [
                        'title' => $ytVideo['title'],
                        'thumbnail_url' => $ytVideo['thumbnail_url'],
                    ]
                );

                // Add to playlist with position
                $playlist->videos()->attach($video->id, ['position' => $index]);
                $importedCount++;
            }

            return response()->json([
                'success' => true,
                'playlist' => $playlist->load('videos'),
                'imported_count' => $importedCount,
            ], 201);

        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
