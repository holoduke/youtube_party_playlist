<?php

namespace App\Services;

use App\Models\User;
use App\Models\OAuthToken;
use Google\Client;
use Google\Service\YouTube;

class YouTubeOAuthService
{
    protected Client $client;

    public function __construct()
    {
        $this->client = new Client();
        $this->client->setClientId(config('services.google.client_id'));
        $this->client->setClientSecret(config('services.google.client_secret'));
    }

    /**
     * Get an authenticated Google Client for the user.
     */
    public function getAuthenticatedClient(User $user): ?Client
    {
        $token = $user->googleToken();

        if (!$token) {
            return null;
        }

        $this->client->setAccessToken([
            'access_token' => $token->access_token,
            'refresh_token' => $token->refresh_token,
            'expires_in' => $token->expires_at?->diffInSeconds(now()) ?? 0,
        ]);

        // Refresh if needed
        if ($token->needsRefresh() && $token->refresh_token) {
            $this->refreshToken($token);
        }

        return $this->client;
    }

    /**
     * Refresh an expired token.
     */
    protected function refreshToken(OAuthToken $token): void
    {
        try {
            $this->client->refreshToken($token->refresh_token);
            $newToken = $this->client->getAccessToken();

            $token->update([
                'access_token' => $newToken['access_token'],
                'expires_at' => now()->addSeconds($newToken['expires_in']),
            ]);
        } catch (\Exception $e) {
            // Token refresh failed - user needs to re-authenticate
            $token->delete();
            throw new \Exception('YouTube access expired. Please reconnect your Google account.');
        }
    }

    /**
     * Get the user's YouTube playlists.
     */
    public function getUserPlaylists(User $user): array
    {
        $client = $this->getAuthenticatedClient($user);

        if (!$client) {
            throw new \Exception('No YouTube access. Please connect your Google account.');
        }

        $youtube = new YouTube($client);

        $playlists = [];
        $pageToken = null;

        do {
            $response = $youtube->playlists->listPlaylists('snippet,contentDetails', [
                'mine' => true,
                'maxResults' => 50,
                'pageToken' => $pageToken,
            ]);

            foreach ($response->getItems() as $playlist) {
                $snippet = $playlist->getSnippet();
                $contentDetails = $playlist->getContentDetails();
                $thumbnails = $snippet->getThumbnails();

                $playlists[] = [
                    'youtube_id' => $playlist->getId(),
                    'title' => $snippet->getTitle(),
                    'description' => $snippet->getDescription(),
                    'thumbnail_url' => $thumbnails?->getMedium()?->getUrl()
                        ?? $thumbnails?->getDefault()?->getUrl(),
                    'item_count' => $contentDetails->getItemCount(),
                    'published_at' => $snippet->getPublishedAt(),
                ];
            }

            $pageToken = $response->getNextPageToken();
        } while ($pageToken);

        return $playlists;
    }

    /**
     * Get items from a YouTube playlist.
     */
    public function getPlaylistItems(User $user, string $playlistId): array
    {
        $client = $this->getAuthenticatedClient($user);

        if (!$client) {
            throw new \Exception('No YouTube access. Please connect your Google account.');
        }

        $youtube = new YouTube($client);

        $videos = [];
        $videoIds = [];
        $pageToken = null;

        // First, get all playlist items
        do {
            $response = $youtube->playlistItems->listPlaylistItems('snippet,contentDetails', [
                'playlistId' => $playlistId,
                'maxResults' => 50,
                'pageToken' => $pageToken,
            ]);

            foreach ($response->getItems() as $item) {
                $snippet = $item->getSnippet();
                $contentDetails = $item->getContentDetails();

                // Skip deleted/private videos
                if ($snippet->getTitle() === 'Deleted video' ||
                    $snippet->getTitle() === 'Private video') {
                    continue;
                }

                $thumbnails = $snippet->getThumbnails();
                $videoId = $contentDetails->getVideoId();

                $videos[$videoId] = [
                    'youtube_id' => $videoId,
                    'title' => $snippet->getTitle(),
                    'thumbnail_url' => $thumbnails?->getMedium()?->getUrl()
                        ?? $thumbnails?->getDefault()?->getUrl(),
                    'channel' => $snippet->getVideoOwnerChannelTitle(),
                    'position' => $snippet->getPosition(),
                    'duration' => 0, // Will be filled in next step
                ];
                $videoIds[] = $videoId;
            }

            $pageToken = $response->getNextPageToken();
        } while ($pageToken);

        // Now fetch video details (including duration) in batches of 50
        $chunks = array_chunk($videoIds, 50);
        foreach ($chunks as $chunk) {
            $videoResponse = $youtube->videos->listVideos('contentDetails', [
                'id' => implode(',', $chunk),
            ]);

            foreach ($videoResponse->getItems() as $videoItem) {
                $videoId = $videoItem->getId();
                $duration = $this->parseDuration($videoItem->getContentDetails()->getDuration());
                if (isset($videos[$videoId])) {
                    $videos[$videoId]['duration'] = $duration;
                }
            }
        }

        // Return as indexed array sorted by position
        $result = array_values($videos);
        usort($result, fn($a, $b) => $a['position'] <=> $b['position']);

        return $result;
    }

    /**
     * Parse ISO 8601 duration to seconds.
     */
    protected function parseDuration(string $duration): int
    {
        preg_match('/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/', $duration, $matches);

        $hours = (int) ($matches[1] ?? 0);
        $minutes = (int) ($matches[2] ?? 0);
        $seconds = (int) ($matches[3] ?? 0);

        return $hours * 3600 + $minutes * 60 + $seconds;
    }
}
