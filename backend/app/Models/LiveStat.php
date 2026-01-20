<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LiveStat extends Model
{
    protected $fillable = [
        'channel_id',
        'viewer_id',
        'last_seen_at',
    ];

    protected $casts = [
        'last_seen_at' => 'datetime',
    ];

    public function channel()
    {
        return $this->belongsTo(Channel::class);
    }

    /**
     * Scope to get active viewers (seen within last X minutes).
     */
    public function scopeActive($query, $minutes = 5)
    {
        return $query->where('last_seen_at', '>=', now()->subMinutes($minutes));
    }

    /**
     * Scope to get stale records (older than X minutes).
     */
    public function scopeStale($query, $minutes = 5)
    {
        return $query->where('last_seen_at', '<', now()->subMinutes($minutes));
    }
}
