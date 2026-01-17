<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class YouTubeService
{
    protected string $apiKey;
    protected string $baseUrl = 'https://www.googleapis.com/youtube/v3';

    public function __construct()
    {
        $this->apiKey = config('services.youtube.api_key');
    }

    public function search(string $query, int $maxResults = 20): array
    {
        if (empty($this->apiKey)) {
            throw new \Exception('YouTube API key not configured');
        }

        $response = Http::get("{$this->baseUrl}/search", [
            'key' => $this->apiKey,
            'q' => $query,
            'part' => 'snippet',
            'type' => 'video',
            'maxResults' => $maxResults,
            'videoCategoryId' => '10', // Music category
        ]);

        if ($response->failed()) {
            throw new \Exception('YouTube API request failed: ' . $response->body());
        }

        $data = $response->json();

        return collect($data['items'] ?? [])->map(function ($item) {
            return [
                'youtube_id' => $item['id']['videoId'],
                'title' => $item['snippet']['title'],
                'thumbnail_url' => $item['snippet']['thumbnails']['medium']['url'] ?? $item['snippet']['thumbnails']['default']['url'],
                'channel' => $item['snippet']['channelTitle'],
                'published_at' => $item['snippet']['publishedAt'],
            ];
        })->toArray();
    }

    public function getVideoDetails(string $videoId): ?array
    {
        if (empty($this->apiKey)) {
            throw new \Exception('YouTube API key not configured');
        }

        $response = Http::get("{$this->baseUrl}/videos", [
            'key' => $this->apiKey,
            'id' => $videoId,
            'part' => 'snippet,contentDetails',
        ]);

        if ($response->failed()) {
            return null;
        }

        $data = $response->json();
        $item = $data['items'][0] ?? null;

        if (!$item) {
            return null;
        }

        return [
            'youtube_id' => $videoId,
            'title' => $item['snippet']['title'],
            'thumbnail_url' => $item['snippet']['thumbnails']['medium']['url'] ?? $item['snippet']['thumbnails']['default']['url'],
            'channel' => $item['snippet']['channelTitle'],
            'duration' => $this->parseDuration($item['contentDetails']['duration'] ?? 'PT0S'),
        ];
    }

    protected function parseDuration(string $duration): int
    {
        // Parse ISO 8601 duration (e.g., PT4M13S)
        preg_match('/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/', $duration, $matches);

        $hours = (int) ($matches[1] ?? 0);
        $minutes = (int) ($matches[2] ?? 0);
        $seconds = (int) ($matches[3] ?? 0);

        return $hours * 3600 + $minutes * 60 + $seconds;
    }
}
