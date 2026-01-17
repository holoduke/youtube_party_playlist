import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Make Pusher available globally for Echo
window.Pusher = Pusher;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'khw9h8uvx8evmv0mbnqf';
const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || 'localhost';
const REVERB_PORT = import.meta.env.VITE_REVERB_PORT || 8080;

let echo = null;
let stateListeners = [];

/**
 * Initialize Echo connection to Reverb
 */
export function initEcho() {
  if (echo) return echo;

  echo = new Echo({
    broadcaster: 'reverb',
    key: REVERB_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT,
    forceTLS: false,
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
  });

  // Listen for player state changes
  echo.channel('player-sync')
    .listen('PlayerStateChanged', (data) => {
      stateListeners.forEach(listener => listener(data));
    });

  return echo;
}

/**
 * Subscribe to player state changes
 */
export function onStateChange(callback) {
  stateListeners.push(callback);
  return () => {
    stateListeners = stateListeners.filter(l => l !== callback);
  };
}

/**
 * Broadcast player state to all connected clients
 */
export async function broadcastState(state) {
  try {
    await fetch(`${API_URL}/api/player/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(state),
    });
  } catch (error) {
    console.error('Failed to broadcast state:', error);
  }
}

/**
 * Get current player state (for initial sync)
 */
export async function getPlayerState() {
  try {
    const response = await fetch(`${API_URL}/api/player/state`);
    return await response.json();
  } catch (error) {
    console.error('Failed to get player state:', error);
    return null;
  }
}

/**
 * Disconnect Echo
 */
export function disconnectEcho() {
  if (echo) {
    echo.disconnect();
    echo = null;
  }
}
