<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'google_id',
        'avatar',
        'default_playlist_id',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Get the playlists owned by this user.
     */
    public function playlists()
    {
        return $this->hasMany(Playlist::class);
    }

    /**
     * Get the user's default playlist.
     */
    public function defaultPlaylist()
    {
        return $this->belongsTo(Playlist::class, 'default_playlist_id');
    }

    /**
     * Get the OAuth tokens for this user.
     */
    public function oauthTokens()
    {
        return $this->hasMany(OAuthToken::class);
    }

    /**
     * Get the Google OAuth token for this user.
     */
    public function googleToken()
    {
        return $this->oauthTokens()->where('provider', 'google')->first();
    }

    /**
     * Check if user has connected their Google account.
     */
    public function hasGoogleConnected(): bool
    {
        return !is_null($this->google_id);
    }
}
