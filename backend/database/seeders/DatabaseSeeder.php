<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Playlist;
use App\Models\User;
use App\Models\Video;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Hardcoded users for simple user selection (username:password)
        $users = [
            ['name' => 'Arjan', 'email' => 'arjan@barmania.local', 'password' => bcrypt('arjan')],
            ['name' => 'Gillis', 'email' => 'gillis@barmania.local', 'password' => bcrypt('gillis')],
        ];

        foreach ($users as $userData) {
            $user = User::create($userData);

            // Create a default playlist for each user
            Playlist::create([
                'name' => 'My Playlist',
                'user_id' => $user->id,
                'is_public' => false,
            ]);
        }

        // Categories: 1=60's, 2=70's, 3=80's, 4=90's, 5=Rock, 6=Pop, 7=Hiphop, 8=Dance,
        // 9=Techno/House, 10=Soul & Funk, 11=R&B, 12=Latin, 13=Reggae, 14=Nederlands, 15=Funny
        $categories = [
            ['name' => "60's", 'slug' => '60s'],
            ['name' => "70's", 'slug' => '70s'],
            ['name' => "80's", 'slug' => '80s'],
            ['name' => "90's", 'slug' => '90s'],
            ['name' => 'Rock', 'slug' => 'rock'],
            ['name' => 'Pop', 'slug' => 'pop'],
            ['name' => 'Hiphop', 'slug' => 'hiphop'],
            ['name' => 'Dance', 'slug' => 'dance'],
            ['name' => 'Techno/House', 'slug' => 'techno-house'],
            ['name' => 'Soul & Funk', 'slug' => 'soul-funk'],
            ['name' => 'R&B', 'slug' => 'rnb'],
            ['name' => 'Latin', 'slug' => 'latin'],
            ['name' => 'Reggae', 'slug' => 'reggae'],
            ['name' => 'Nederlands', 'slug' => 'nederlands'],
            ['name' => 'Funny', 'slug' => 'funny'],
        ];

        foreach ($categories as $category) {
            Category::create($category);
        }

        // Videos with category_ids array for many-to-many
        $videos = [
            // 70's Rock
            ['title' => 'Queen - Bohemian Rhapsody', 'youtube_id' => 'fJ9rUzIMcZQ', 'category_ids' => [2, 5]],
            ['title' => 'ABBA - Dancing Queen', 'youtube_id' => 'xFrGuyw1V8s', 'category_ids' => [2, 6, 8]],
            ['title' => 'Bee Gees - Stayin Alive', 'youtube_id' => 'fNFzfwLM72c', 'category_ids' => [2, 8, 10]],

            // 80's
            ['title' => 'Michael Jackson - Thriller', 'youtube_id' => 'sOnqjkJTMaA', 'category_ids' => [3, 6, 10]],
            ['title' => 'a-ha - Take On Me', 'youtube_id' => 'djV11Xbc914', 'category_ids' => [3, 6]],
            ['title' => 'Bon Jovi - Livin on a Prayer', 'youtube_id' => 'lDK9QqIzhwk', 'category_ids' => [3, 5]],
            ['title' => 'Guns N Roses - Sweet Child O Mine', 'youtube_id' => '1w7OgIMMRc4', 'category_ids' => [3, 5]],
            ['title' => 'Prince - Purple Rain', 'youtube_id' => 'TvnYmWpD_T8', 'category_ids' => [3, 6, 10, 11]],

            // 90's
            ['title' => 'Nirvana - Smells Like Teen Spirit', 'youtube_id' => 'hTWKbfoikeg', 'category_ids' => [4, 5]],
            ['title' => 'Backstreet Boys - I Want It That Way', 'youtube_id' => '4fndeDfaWCg', 'category_ids' => [4, 6]],
            ['title' => 'Spice Girls - Wannabe', 'youtube_id' => 'gJLIiF15wjQ', 'category_ids' => [4, 6, 8]],
            ['title' => 'Oasis - Wonderwall', 'youtube_id' => 'bx1Bh8ZvH84', 'category_ids' => [4, 5]],

            // Rock
            ['title' => 'AC/DC - Back In Black', 'youtube_id' => 'pAgnJDJN4VA', 'category_ids' => [3, 5]],
            ['title' => 'Led Zeppelin - Stairway to Heaven', 'youtube_id' => 'QkF3oxziUI4', 'category_ids' => [2, 5]],
            ['title' => 'Foo Fighters - Everlong', 'youtube_id' => 'eBG7P-K-r1Y', 'category_ids' => [4, 5]],
            ['title' => 'Red Hot Chili Peppers - Californication', 'youtube_id' => 'YlUKcNNmywk', 'category_ids' => [4, 5]],

            // Pop
            ['title' => 'Dua Lipa - Levitating', 'youtube_id' => 'TUVcZfQe-Kw', 'category_ids' => [6, 8]],
            ['title' => 'The Weeknd - Blinding Lights', 'youtube_id' => '4NRXx6U8ABQ', 'category_ids' => [6, 8, 11]],
            ['title' => 'Bruno Mars - Uptown Funk', 'youtube_id' => 'OPf0YbXqDm0', 'category_ids' => [6, 10, 8]],
            ['title' => 'Ed Sheeran - Shape of You', 'youtube_id' => 'JGwWNGJdvx8', 'category_ids' => [6]],

            // Hiphop
            ['title' => 'Eminem - Lose Yourself', 'youtube_id' => '_Yhyp-_hX2s', 'category_ids' => [7]],
            ['title' => 'Dr. Dre ft. Snoop Dogg - Still D.R.E.', 'youtube_id' => '_CL6n0FJZpk', 'category_ids' => [7]],
            ['title' => 'Kendrick Lamar - HUMBLE', 'youtube_id' => 'tvTRZJ-4EyI', 'category_ids' => [7]],
            ['title' => '50 Cent - In Da Club', 'youtube_id' => '5qm8PH4xAss', 'category_ids' => [7, 11]],

            // Dance
            ['title' => 'Avicii - Wake Me Up', 'youtube_id' => 'IcrbM1l_BoI', 'category_ids' => [8, 6]],
            ['title' => 'David Guetta - Titanium', 'youtube_id' => 'JRfuAukYTKg', 'category_ids' => [8, 6]],
            ['title' => 'Calvin Harris - Summer', 'youtube_id' => 'ebXbLfLACGM', 'category_ids' => [8, 6]],

            // Techno/House
            ['title' => 'Daft Punk - Around The World', 'youtube_id' => 's9MszVE7aR4', 'category_ids' => [9, 8]],
            ['title' => 'Daft Punk - One More Time', 'youtube_id' => 'FGBhQbmPwH8', 'category_ids' => [9, 8]],
            ['title' => 'The Chemical Brothers - Block Rockin Beats', 'youtube_id' => 'iTxOKsyZ0Lw', 'category_ids' => [9]],

            // Soul & Funk
            ['title' => 'James Brown - I Got You (I Feel Good)', 'youtube_id' => 'U5TqIdff_DQ', 'category_ids' => [1, 10]],
            ['title' => 'Earth Wind & Fire - September', 'youtube_id' => 'Gs069dndIYk', 'category_ids' => [2, 10, 8]],
            ['title' => 'Stevie Wonder - Superstition', 'youtube_id' => '0CFuCYNx-1g', 'category_ids' => [2, 10]],

            // R&B
            ['title' => 'Usher - Yeah!', 'youtube_id' => 'GxBSyx85Kp8', 'category_ids' => [11, 7, 8]],
            ['title' => 'Beyonce - Crazy In Love', 'youtube_id' => 'ViwtNLUqkMY', 'category_ids' => [11, 6]],
            ['title' => 'Rihanna - Umbrella', 'youtube_id' => 'CvBfHwUxHIk', 'category_ids' => [11, 6]],

            // Latin
            ['title' => 'Luis Fonsi - Despacito', 'youtube_id' => 'kJQP7kiw5Fk', 'category_ids' => [12, 6, 13]],
            ['title' => 'Shakira - Hips Dont Lie', 'youtube_id' => 'DUT5rEU6pqM', 'category_ids' => [12, 6, 8]],

            // Reggae
            ['title' => 'Bob Marley - Three Little Birds', 'youtube_id' => 'zaGUr6wzyT8', 'category_ids' => [13]],
            ['title' => 'Bob Marley - One Love', 'youtube_id' => 'vdB-8eLEW8g', 'category_ids' => [13]],

            // Nederlands
            ['title' => 'Andre Hazes - Bloed Zweet en Tranen', 'youtube_id' => 'ZbGuxGGOIV0', 'category_ids' => [14]],
            ['title' => 'Marco Borsato - Dromen Zijn Bedrog', 'youtube_id' => 'xbkpj9jU0oc', 'category_ids' => [14, 6]],

            // Funny
            ['title' => 'Psy - Gangnam Style', 'youtube_id' => '9bZkp7q19f0', 'category_ids' => [15, 8, 6]],
            ['title' => 'Rick Astley - Never Gonna Give You Up', 'youtube_id' => 'dQw4w9WgXcQ', 'category_ids' => [15, 3, 6]],
        ];

        foreach ($videos as $videoData) {
            $categoryIds = $videoData['category_ids'];
            unset($videoData['category_ids']);

            $videoData['thumbnail_url'] = 'https://img.youtube.com/vi/' . $videoData['youtube_id'] . '/mqdefault.jpg';

            $video = Video::create($videoData);
            $video->categories()->attach($categoryIds);
        }
    }
}
