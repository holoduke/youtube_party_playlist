<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Playlist extends Model
{
    protected $fillable = [
        'name',
        'description',
        'user_id',
        'is_public',
        'is_broadcasting',
        'broadcast_code',
        'status',
        'share_code',
        'host_code',
        'state',
        'queue',
        'likes',
        'hash',
    ];

    protected $casts = [
        'is_public' => 'boolean',
        'is_broadcasting' => 'boolean',
        'state' => 'array',
        'queue' => 'array',
        'likes' => 'array',
    ];

    protected $hidden = ['host_code']; // Don't expose host code to guests

    // Characters for URL-safe base64-like encoding (YouTube uses similar)
    private const HASH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_';
    private const HASH_LENGTH = 11;

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($playlist) {
            // Generate hash before saving if not set
            if (empty($playlist->hash)) {
                // We need an ID for the hash, but on create we don't have one yet
                // So we'll generate a random base first and add ID after
                $playlist->hash = self::generateHash();
            }
        });

        static::created(function ($playlist) {
            // After creation, regenerate hash with actual ID for better uniqueness
            $playlist->hash = self::generateHash($playlist->id);
            $playlist->saveQuietly();
        });
    }

    /**
     * Generate a YouTube-style hash (11 characters)
     * Uses ID + timestamp + random bytes for uniqueness
     */
    public static function generateHash(?int $id = null): string
    {
        $chars = self::HASH_CHARS;
        $length = self::HASH_LENGTH;

        // Create entropy from ID, time, and random bytes
        $entropy = ($id ?? 0) . microtime(true) . random_bytes(8);
        $hash = hash('sha256', $entropy, true);

        $result = '';
        for ($i = 0; $i < $length; $i++) {
            $byte = ord($hash[$i % strlen($hash)]);
            $result .= $chars[$byte % 64];
        }

        // Ensure uniqueness
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

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function videos()
    {
        return $this->belongsToMany(Video::class)
            ->withPivot('position')
            ->orderBy('pivot_position');
    }

    // Generate a unique 4-digit broadcast code
    public static function generateBroadcastCode(): string
    {
        do {
            $code = str_pad(random_int(0, 9999), 4, '0', STR_PAD_LEFT);
        } while (self::where('broadcast_code', $code)->exists());

        return $code;
    }

    // Generate a unique share code (6 chars for guests)
    public static function generateShareCode(): string
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (self::where('share_code', $code)->exists());

        return $code;
    }

    // Generate a unique host code (12 chars for owner/admin)
    public static function generateHostCode(): string
    {
        do {
            $code = strtoupper(Str::random(12));
        } while (self::where('host_code', $code)->exists());

        return $code;
    }

    // Check if the provided code matches the host code
    public function isHost(string $code): bool
    {
        return $this->host_code === strtoupper($code);
    }

    // Start a live session
    public function goLive(): self
    {
        $videos = $this->videos;

        $this->update([
            'status' => 'live',
            'share_code' => self::generateShareCode(),
            'host_code' => self::generateHostCode(),
            'state' => [
                'player1Video' => $videos[0] ?? null,
                'player2Video' => $videos[1] ?? null,
                'crossfadeValue' => 0,
                'playlistIndex' => 0,
                'isPlaying' => false,
            ],
            'queue' => [],
            'likes' => [],
        ]);

        return $this;
    }

    // Stop a live session
    public function stopLive(): self
    {
        $this->update([
            'status' => 'stopped',
            'share_code' => null,
            'host_code' => null,
            'state' => null,
            'queue' => null,
            'likes' => null,
        ]);

        return $this;
    }

    // Check if playlist is currently live
    public function isLive(): bool
    {
        return $this->status === 'live';
    }

    // Check if playlist is playing (locally)
    public function isPlaying(): bool
    {
        return $this->status === 'playing';
    }
}
