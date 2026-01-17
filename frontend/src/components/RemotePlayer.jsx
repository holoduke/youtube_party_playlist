import { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { initEcho, onStateChange, getPlayerState } from '../services/playerSync';

export default function RemotePlayer() {
  const [player1Video, setPlayer1Video] = useState(null);
  const [player2Video, setPlayer2Video] = useState(null);
  const [crossfadeValue, setCrossfadeValue] = useState(50);
  const [connected, setConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const player1Ref = useRef(null);
  const player2Ref = useRef(null);
  const containerRef = useRef(null);

  // Initialize connection and load initial state
  useEffect(() => {
    const init = async () => {
      // Get initial state
      const state = await getPlayerState();
      if (state) {
        setPlayer1Video(state.player1Video);
        setPlayer2Video(state.player2Video);
        setCrossfadeValue(state.crossfadeValue);
      }

      // Initialize WebSocket connection
      initEcho();
      setConnected(true);

      // Listen for state changes
      const unsubscribe = onStateChange((data) => {
        if (data.player1Video !== undefined) setPlayer1Video(data.player1Video);
        if (data.player2Video !== undefined) setPlayer2Video(data.player2Video);
        if (data.crossfadeValue !== undefined) setCrossfadeValue(data.crossfadeValue);
      });

      return unsubscribe;
    };

    const cleanup = init();
    return () => {
      cleanup.then(unsub => unsub?.());
    };
  }, []);

  // Update volumes when crossfade changes
  useEffect(() => {
    if (player1Ref.current) {
      player1Ref.current.setVolume(100 - crossfadeValue);
    }
    if (player2Ref.current) {
      player2Ref.current.setVolume(crossfadeValue);
    }
  }, [crossfadeValue]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const opts = {
    width: '100%',
    height: '100%',
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      enablejsapi: 1,
      playsinline: 1,
    },
  };

  const onPlayer1Ready = (event) => {
    player1Ref.current = event.target;
    event.target.setVolume(100 - crossfadeValue);
  };

  const onPlayer2Ready = (event) => {
    player2Ref.current = event.target;
    event.target.setVolume(crossfadeValue);
  };

  // Calculate opacity based on crossfade
  // At 0: player1 = 1, player2 = 0
  // At 50: both = 1
  // At 100: player1 = 0, player2 = 1
  const player1Opacity = crossfadeValue <= 50 ? 1 : 1 - (crossfadeValue - 50) / 50;
  const player2Opacity = crossfadeValue >= 50 ? 1 : crossfadeValue / 50;

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen bg-black overflow-hidden cursor-none"
      onClick={toggleFullscreen}
    >
      {/* Player 1 (bottom layer) */}
      <div
        className="absolute inset-0 transition-opacity duration-100"
        style={{ opacity: player1Opacity }}
      >
        {player1Video ? (
          <YouTube
            videoId={player1Video.youtube_id}
            opts={opts}
            onReady={onPlayer1Ready}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-purple-500/30 text-2xl">Player 1</div>
          </div>
        )}
      </div>

      {/* Player 2 (top layer) */}
      <div
        className="absolute inset-0 transition-opacity duration-100"
        style={{ opacity: player2Opacity }}
      >
        {player2Video ? (
          <YouTube
            videoId={player2Video.youtube_id}
            opts={opts}
            onReady={onPlayer2Ready}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-pink-500/30 text-2xl">Player 2</div>
          </div>
        )}
      </div>

      {/* Connection Status & Info Overlay (hidden in fullscreen after a delay) */}
      <div className={`absolute top-4 left-4 right-4 flex justify-between items-start transition-opacity duration-500 ${isFullscreen ? 'opacity-0 hover:opacity-100' : ''}`}>
        {/* Status */}
        <div className="flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur rounded-lg">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-white/80 text-sm">
            {connected ? 'Connected' : 'Connecting...'}
          </span>
        </div>

        {/* Crossfade indicator */}
        <div className="px-3 py-2 bg-black/50 backdrop-blur rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 text-xs">P1</span>
            <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100"
                style={{ width: `${crossfadeValue}%` }}
              />
            </div>
            <span className="text-pink-400 text-xs">P2</span>
          </div>
        </div>

        {/* Fullscreen hint */}
        <div className="px-3 py-2 bg-black/50 backdrop-blur rounded-lg text-white/60 text-sm">
          Click for fullscreen
        </div>
      </div>

      {/* Now Playing Info */}
      <div className={`absolute bottom-4 left-4 right-4 transition-opacity duration-500 ${isFullscreen ? 'opacity-0 hover:opacity-100' : ''}`}>
        <div className="flex gap-4">
          {player1Video && player1Opacity > 0.3 && (
            <div className="flex-1 px-4 py-3 bg-black/50 backdrop-blur rounded-lg border border-purple-500/30">
              <p className="text-purple-400 text-xs mb-1">Player 1</p>
              <p className="text-white text-sm truncate">{player1Video.title}</p>
            </div>
          )}
          {player2Video && player2Opacity > 0.3 && (
            <div className="flex-1 px-4 py-3 bg-black/50 backdrop-blur rounded-lg border border-pink-500/30">
              <p className="text-pink-400 text-xs mb-1">Player 2</p>
              <p className="text-white text-sm truncate">{player2Video.title}</p>
            </div>
          )}
        </div>
      </div>

      {/* Waiting state */}
      {!player1Video && !player2Video && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4 animate-pulse">🎵</div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
              BARMANIA
            </h1>
            <p className="text-purple-300/60">Waiting for content...</p>
            <p className="text-purple-300/40 text-sm mt-2">
              Control from the main app
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
