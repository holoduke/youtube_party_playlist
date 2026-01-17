<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PlaylistStateChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $shareCode;
    public array $data;

    public function __construct(string $shareCode, array $data)
    {
        $this->shareCode = $shareCode;
        $this->data = $data;
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('playlist.' . $this->shareCode),
        ];
    }

    public function broadcastWith(): array
    {
        return $this->data;
    }
}
