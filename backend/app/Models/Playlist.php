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
        'status',
        'share_code',
        'host_code',
        'state',
        'queue',
        'likes',
    ];

    protected $casts = [
        'state' => 'array',
        'queue' => 'array',
        'likes' => 'array',
    ];

    protected $hidden = ['host_code']; // Don't expose host code to guests

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
