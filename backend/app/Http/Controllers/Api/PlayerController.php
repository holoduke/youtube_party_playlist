<?php

namespace App\Http\Controllers\Api;

use App\Events\PlayerStateChanged;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PlayerController extends Controller
{
    /**
     * Broadcast player state to all connected clients.
     */
    public function sync(Request $request)
    {
        $state = $request->validate([
            'player1Video' => 'nullable|array',
            'player2Video' => 'nullable|array',
            'crossfadeValue' => 'required|numeric|min:0|max:100',
            'player1State' => 'nullable|string', // playing, paused, ended
            'player2State' => 'nullable|string',
            'player1Time' => 'nullable|numeric',
            'player2Time' => 'nullable|numeric',
        ]);

        // Store current state for new connections
        Cache::put('player_state', $state, now()->addHours(1));

        // Broadcast to all listeners
        event(new PlayerStateChanged($state));

        return response()->json(['success' => true]);
    }

    /**
     * Get current player state (for initial sync).
     */
    public function state()
    {
        $state = Cache::get('player_state', [
            'player1Video' => null,
            'player2Video' => null,
            'crossfadeValue' => 50,
            'player1State' => 'paused',
            'player2State' => 'paused',
            'player1Time' => 0,
            'player2Time' => 0,
        ]);

        return response()->json($state);
    }
}
