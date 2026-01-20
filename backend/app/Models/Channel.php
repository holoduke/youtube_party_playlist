<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Channel extends Model
{
    protected $fillable = [
        'user_id',
        'hash',
        'broadcast_code',
        'is_broadcasting',
        'current_playlist_id',
        'state',
    ];

    protected $casts = [
        'is_broadcasting' => 'boolean',
        'state' => 'array',
    ];

    protected $appends = ['idle_image_url'];

    // Characters for URL-safe base64-like encoding
    private const HASH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
    private const HASH_LENGTH = 11;

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($channel) {
            if (empty($channel->hash)) {
                $channel->hash = self::generateHash();
            }
        });

        static::created(function ($channel) {
            $channel->hash = self::generateHash($channel->id);
            $channel->saveQuietly();
        });
    }

    /**
     * Generate a YouTube-style hash (11 characters)
     */
    public static function generateHash(?int $id = null): string
    {
        $chars = self::HASH_CHARS;
        $length = self::HASH_LENGTH;

        $entropy = ($id ?? 0) . microtime(true) . random_bytes(8);
        $hash = hash('sha256', $entropy, true);

        $result = '';
        for ($i = 0; $i < $length; $i++) {
            $byte = ord($hash[$i % strlen($hash)]);
            $result .= $chars[$byte % 64];
        }

        while (self::where('hash', $result)->exists()) {
            $entropy = random_bytes(16);
            $hash = hash('sha256', $entropy, true);
            $result = '';
            for ($i = 0; $i < $length; $i++) {
                $byte = ord($hash[$i % strlen($hash)]);
                $result .= $chars[$byte % 64];
            }
        }

        return $result;
    }

    /**
     * Generate a unique 4-digit broadcast code
     */
    public static function generateBroadcastCode(): string
    {
        do {
            $code = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (self::where('broadcast_code', $code)->where('is_broadcasting', true)->exists());

        return $code;
    }

    /**
     * Get the idle image URL from the current playlist
     */
    public function getIdleImageUrlAttribute(): ?string
    {
        return $this->currentPlaylist?->idle_image_url;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function currentPlaylist()
    {
        return $this->belongsTo(Playlist::class, 'current_playlist_id');
    }

    /**
     * Start broadcasting
     */
    public function startBroadcast(?Playlist $playlist = null): self
    {
        $this->update([
            'is_broadcasting' => true,
            'broadcast_code' => self::generateBroadcastCode(),
            'current_playlist_id' => $playlist?->id,
            'state' => [
                'player1_video' => null,
                'player2_video' => null,
                'player1_playing' => false,
                'player2_playing' => false,
                'player1_time' => 0,
                'player2_time' => 0,
                'crossfade_value' => 50,
                'is_stopped' => true,
                'updated_at' => now()->toISOString(),
            ],
        ]);

        return $this;
    }

    /**
     * Stop broadcasting
     */
    public function stopBroadcast(): self
    {
        $this->update([
            'is_broadcasting' => false,
            'broadcast_code' => null,
            'state' => null,
        ]);

        return $this;
    }

    /**
     * Get or create channel for a user
     */
    public static function getOrCreateForUser(User $user): self
    {
        $channel = self::firstOrCreate(
            ['user_id' => $user->id],
            ['hash' => self::generateHash()]
        );

        // Ensure hash exists (for channels created before hash was added)
        if (empty($channel->hash)) {
            $channel->hash = self::generateHash($channel->id);
            $channel->saveQuietly();
        }

        return $channel;
    }
}
