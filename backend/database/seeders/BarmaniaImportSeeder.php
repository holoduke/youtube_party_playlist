<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Video;
use App\Models\Playlist;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BarmaniaImportSeeder extends Seeder
{
    public function run(): void
    {
        // Clear existing data (SQLite compatible)
        DB::statement('PRAGMA foreign_keys = OFF');
        DB::table('category_video')->delete();
        DB::table('playlist_video')->delete();
        Video::query()->delete();
        Category::query()->delete();
        Playlist::query()->delete();
        DB::statement('PRAGMA foreign_keys = ON');

        $this->command->info('Cleared existing data');

        // Load scraped data
        $clipsPath = '/tmp/barmania_all_clips.json';
        $playlistsPath = '/tmp/barmania_playlists.json';
        $playlistContentsDir = '/tmp/barmania_playlist_contents';

        if (!file_exists($clipsPath)) {
            $this->command->error("Clips file not found: $clipsPath");
            return;
        }

        $clips = json_decode(file_get_contents($clipsPath), true);
        $this->command->info("Loaded " . count($clips) . " clips");

        // Extract unique categories
        $categoryNames = [];
        foreach ($clips as $clip) {
            if (!empty($clip['category'])) {
                $categoryNames[$clip['category']] = true;
            }
        }

        // Create categories
        $categoryMap = [];
        foreach (array_keys($categoryNames) as $name) {
            $category = Category::create([
                'name' => $name,
                'slug' => Str::slug($name),
            ]);
            $categoryMap[$name] = $category->id;
        }
        $this->command->info("Created " . count($categoryMap) . " categories");

        // Import videos
        $videoMap = []; // barmania_id => our_id
        $count = 0;
        foreach ($clips as $clip) {
            // Parse duration (format: "3:45" or "1:23:45")
            $durationSeconds = $this->parseDuration($clip['duration'] ?? '0:00');

            // Get thumbnail
            $thumb = $clip['thumb'] ?? '';
            if (empty($thumb) || $thumb === 'images/banaan.gif') {
                $thumb = 'https://img.youtube.com/vi/' . $clip['code'] . '/mqdefault.jpg';
            }

            $video = Video::create([
                'title' => $clip['title'] ?? 'Unknown',
                'youtube_id' => $clip['code'],
                'thumbnail_url' => $thumb,
                'duration' => $durationSeconds,
                'start_time' => 0,
                'end_time' => $durationSeconds,
            ]);

            // Attach category
            if (!empty($clip['category']) && isset($categoryMap[$clip['category']])) {
                $video->categories()->attach($categoryMap[$clip['category']]);
            }

            $videoMap[$clip['id']] = $video->id;
            $count++;

            if ($count % 500 === 0) {
                $this->command->info("Imported $count videos...");
            }
        }
        $this->command->info("Imported $count videos total");

        // Import playlists
        if (file_exists($playlistsPath)) {
            $playlists = json_decode(file_get_contents($playlistsPath), true);

            foreach ($playlists as $pl) {
                $playlist = Playlist::create([
                    'name' => $pl['title'],
                    'description' => 'Created by ' . ($pl['user'] ?? 'unknown'),
                ]);

                // Load playlist contents
                $contentFile = "$playlistContentsDir/playlist_{$pl['id']}.json";
                if (file_exists($contentFile)) {
                    $contents = json_decode(file_get_contents($contentFile), true);

                    if (is_array($contents) && !isset($contents['empty'])) {
                        $position = 0;
                        $addedVideos = [];
                        foreach ($contents as $item) {
                            if (isset($item['empty']) && $item['empty'] === true) {
                                continue;
                            }

                            $barmaniVideoId = $item['id'] ?? null;
                            if ($barmaniVideoId && isset($videoMap[$barmaniVideoId])) {
                                $ourVideoId = $videoMap[$barmaniVideoId];
                                // Skip duplicates
                                if (isset($addedVideos[$ourVideoId])) {
                                    continue;
                                }
                                $playlist->videos()->attach($ourVideoId, [
                                    'position' => $position++
                                ]);
                                $addedVideos[$ourVideoId] = true;
                            }
                        }
                    }
                }
            }
            $this->command->info("Imported " . count($playlists) . " playlists");
        }

        $this->command->info('Import completed!');
    }

    private function parseDuration(string $duration): int
    {
        $parts = array_reverse(explode(':', $duration));
        $seconds = 0;

        if (isset($parts[0])) $seconds += (int)$parts[0];
        if (isset($parts[1])) $seconds += (int)$parts[1] * 60;
        if (isset($parts[2])) $seconds += (int)$parts[2] * 3600;

        return $seconds;
    }
}
