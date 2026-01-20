<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Video;
use App\Services\YouTubeService;
use Illuminate\Http\Request;

class YouTubeController extends Controller
{
    protected YouTubeService $youtube;

    public function __construct(YouTubeService $youtube)
    {
        $this->youtube = $youtube;
    }

    public function search(Request $request)
    {
        $request->validate([
            'q' => 'required|string|min:2',
        ]);

        try {
            $results = $this->youtube->search($request->q);

            // Mark videos that are already in our database
            $youtubeIds = collect($results)->pluck('youtube_id');
            $existingVideos = Video::whereIn('youtube_id', $youtubeIds)->pluck('id', 'youtube_id');

            $results = collect($results)->map(function ($video) use ($existingVideos) {
                $video['in_database'] = isset($existingVideos[$video['youtube_id']]);
                $video['database_id'] = $existingVideos[$video['youtube_id']] ?? null;
                return $video;
            })->toArray();

            return response()->json($results);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function getVideo(Request $request)
    {
        $request->validate([
            'id' => 'required|string',
        ]);

        try {
            $videoId = $request->id;

            // Check if already in database
            $existing = Video::where('youtube_id', $videoId)->first();
            if ($existing) {
                return response()->json([
                    'youtube_id' => $existing->youtube_id,
                    'title' => $existing->title,
                    'thumbnail_url' => $existing->thumbnail_url,
                    'in_database' => true,
                    'database_id' => $existing->id,
                ]);
            }

            // Fetch from YouTube API
            $video = $this->youtube->getVideoDetails($videoId);

            if (!$video) {
                return response()->json(['error' => 'Video not found'], 404);
            }

            $video['in_database'] = false;
            $video['database_id'] = null;

            return response()->json($video);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function import(Request $request)
    {
        $request->validate([
            'youtube_id' => 'required|string',
            'title' => 'required|string',
            'thumbnail_url' => 'required|string',
            'channel' => 'nullable|string',
            'duration' => 'nullable|integer',
        ]);

        // Check if already exists
        $existing = Video::where('youtube_id', $request->youtube_id)->first();
        if ($existing) {
            // Update metadata if it was missing
            $updates = [];
            if (empty($existing->channel) && $request->channel) {
                $updates['channel'] = $request->channel;
            }
            if (empty($existing->duration) && $request->duration) {
                $updates['duration'] = $request->duration;
            }
            if (!empty($updates)) {
                $existing->update($updates);
            }
            return response()->json($existing->load('categories'));
        }

        // Create new video
        $video = Video::create([
            'youtube_id' => $request->youtube_id,
            'title' => $request->title,
            'thumbnail_url' => $request->thumbnail_url,
            'channel' => $request->channel,
            'duration' => $request->duration,
        ]);

        return response()->json($video->load('categories'), 201);
    }
}
