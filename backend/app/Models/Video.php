<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Video extends Model
{
    protected $fillable = [
        'title',
        'youtube_id',
        'thumbnail_url',
        'duration',
        'start_time',
        'end_time',
    ];

    public function categories()
    {
        return $this->belongsToMany(Category::class)->withTimestamps();
    }
}
