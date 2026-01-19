import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { getBroadcastState } from '../services/api';

export default function BroadcastViewer() {
  const { hash } = useParams();
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1';
  const [playlistName, setPlaylistName] = useState('');
  const [player1Video, setPlayer1Video] = useState(null);
  const [player2Video, setPlayer2Video] = useState(null);
  const [player1Playing, setPlayer1Playing] = useState(false);
  const [player2Playing, setPlayer2Playing] = useState(false);
  const [crossfadeValue, setCrossfadeValue] = useState(50);
  const [animatedCrossfade, setAnimatedCrossfade] = useState(50); // Smoothly animated value
  const [isEnded, setIsEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({});
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasReceivedState, setHasReceivedState] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [fadeTrigger, setFadeTrigger] = useState(null);

  const player1Ref = useRef(null);
  const player2Ref = useRef(null);
  const pollIntervalRef = useRef(null);
  const player1VideoIdRef = useRef(null);
  const player2VideoIdRef = useRef(null);
  const player1PlayingRef = useRef(false);
  const player2PlayingRef = useRef(false);
  const prevPlayer1PlayingRef = useRef(false);
  const prevPlayer2PlayingRef = useRef(false);
  const crossfadeRef = useRef(50);
  const startedAtRef = useRef(null);
  const fadeAnimationRef = useRef(null);
  const lastFadeTriggerRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => {
    player1PlayingRef.current = player1Playing;
  }, [player1Playing]);

  useEffect(() => {
    player2PlayingRef.current = player2Playing;
  }, [player2Playing]);

  useEffect(() => {
    crossfadeRef.current = crossfadeValue;
  }, [crossfadeValue]);

  // Poll for broadcast state
  useEffect(() => {
    const pollState = async () => {
      try {
        const data = await getBroadcastState(hash);

        if (!data.is_broadcasting) {
          setIsEnded(true);
          return;
        }

        setPlaylistName(data.name);
        setLoading(false);

        const serverState = data.state;
        if (!serverState) return;

        // Support both new (player1_video) and old (current_video) field names
        const serverPlayer1Video = serverState.player1_video || serverState.current_video;
        const serverPlayer2Video = serverState.player2_video || serverState.next_video;
        const serverCrossfade = serverState.crossfade_value ?? 0;
        // Individual player playing states from DJ app
        const serverPlayer1Playing = serverState.player1_playing ?? false;
        const serverPlayer2Playing = serverState.player2_playing ?? false;
        // DJ app playback times
        const serverPlayer1Time = serverState.player1_time ?? 0;
        const serverPlayer2Time = serverState.player2_time ?? 0;

        // Update player 1 if video changed
        if (serverPlayer1Video?.youtube_id !== player1VideoIdRef.current) {
          setPlayer1Video(serverPlayer1Video);
          player1VideoIdRef.current = serverPlayer1Video?.youtube_id;
        }

        // Update player 2 if video changed
        if (serverPlayer2Video?.youtube_id !== player2VideoIdRef.current) {
          setPlayer2Video(serverPlayer2Video);
          player2VideoIdRef.current = serverPlayer2Video?.youtube_id;
        }

        setCrossfadeValue(serverCrossfade);

        // Update individual player playing states
        setPlayer1Playing(serverPlayer1Playing);
        setPlayer2Playing(serverPlayer2Playing);
        setHasReceivedState(true);

        // Force play if server says playing but client isn't
        // This provides immediate sync on each poll
        try {
          if (serverPlayer1Playing && player1Ref.current) {
            const state1 = player1Ref.current.getPlayerState?.();
            // State 1 = playing, 3 = buffering - these are OK
            // -1 = unstarted, 0 = ended, 2 = paused, 5 = cued
            if (state1 !== 1 && state1 !== 3) {
              console.log(`Poll sync: Player 1 should play but state=${state1}, forcing play`);
              player1Ref.current.playVideo();
            }
          }
          if (serverPlayer2Playing && player2Ref.current) {
            const state2 = player2Ref.current.getPlayerState?.();
            if (state2 !== 1 && state2 !== 3) {
              console.log(`Poll sync: Player 2 should play but state=${state2}, forcing play`);
              player2Ref.current.playVideo();
            }
          }
        } catch (e) {
          console.log('Poll sync play error:', e);
        }

        // Check for new fade trigger from DJ app
        const serverFadeTrigger = serverState.fade_trigger;
        if (serverFadeTrigger && serverFadeTrigger.started_at !== lastFadeTriggerRef.current?.started_at) {
          console.log('New fade trigger received:', serverFadeTrigger);
          lastFadeTriggerRef.current = serverFadeTrigger;
          setFadeTrigger(serverFadeTrigger);
        } else if (!serverFadeTrigger && lastFadeTriggerRef.current) {
          // Fade completed on DJ side
          lastFadeTriggerRef.current = null;
          setFadeTrigger(null);
        }

        // Update started_at (ref for effect, state for debug display)
        const serverStartedAt = serverState.started_at;
        startedAtRef.current = serverStartedAt;
        setStartedAt(serverStartedAt);

        // Get viewer's current playback times
        let viewerPlayer1Time = 0;
        let viewerPlayer2Time = 0;
        try {
          if (player1Ref.current && typeof player1Ref.current.getCurrentTime === 'function') {
            viewerPlayer1Time = player1Ref.current.getCurrentTime() || 0;
          }
          if (player2Ref.current && typeof player2Ref.current.getCurrentTime === 'function') {
            viewerPlayer2Time = player2Ref.current.getCurrentTime() || 0;
          }
        } catch (e) {}

        // Sync playback time
        const SYNC_THRESHOLD = 5;

        // Helper to safely call player methods (iframe may be destroyed)
        const safeSeek = (playerRef, time) => {
          try {
            if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
              playerRef.current.seekTo(time, true);
            }
          } catch (e) {
            // Player iframe was destroyed, ignore
          }
        };

        const safePause = (playerRef) => {
          try {
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
              playerRef.current.pauseVideo();
            }
          } catch (e) {
            // Player iframe was destroyed, ignore
          }
        };

        // Player 1: Check for pause transition or drift
        const wasPlaying1 = prevPlayer1PlayingRef.current;
        const justPaused1 = wasPlaying1 && !serverPlayer1Playing;

        if (justPaused1 && serverPlayer1Time > 0) {
          console.log(`Player 1 PAUSED: seeking to DJ position ${serverPlayer1Time.toFixed(1)}s`);
          safePause(player1Ref);
          safeSeek(player1Ref, serverPlayer1Time);
        } else if (serverPlayer1Playing) {
          const diff1 = Math.abs(serverPlayer1Time - viewerPlayer1Time);
          if (diff1 > SYNC_THRESHOLD && serverPlayer1Time > 0) {
            console.log(`Player 1 time sync: DJ=${serverPlayer1Time.toFixed(1)}s, Viewer=${viewerPlayer1Time.toFixed(1)}s, diff=${diff1.toFixed(1)}s - seeking`);
            safeSeek(player1Ref, serverPlayer1Time);
          }
        }

        // Player 2: Check for pause transition or drift
        const wasPlaying2 = prevPlayer2PlayingRef.current;
        const justPaused2 = wasPlaying2 && !serverPlayer2Playing;

        if (justPaused2 && serverPlayer2Time > 0) {
          console.log(`Player 2 PAUSED: seeking to DJ position ${serverPlayer2Time.toFixed(1)}s`);
          safePause(player2Ref);
          safeSeek(player2Ref, serverPlayer2Time);
        } else if (serverPlayer2Playing) {
          const diff2 = Math.abs(serverPlayer2Time - viewerPlayer2Time);
          if (diff2 > SYNC_THRESHOLD && serverPlayer2Time > 0) {
            console.log(`Player 2 time sync: DJ=${serverPlayer2Time.toFixed(1)}s, Viewer=${viewerPlayer2Time.toFixed(1)}s, diff=${diff2.toFixed(1)}s - seeking`);
            safeSeek(player2Ref, serverPlayer2Time);
          }
        }

        // Update previous playing state refs
        prevPlayer1PlayingRef.current = serverPlayer1Playing;
        prevPlayer2PlayingRef.current = serverPlayer2Playing;

        // Calculate elapsed time since video started
        const elapsedSeconds = serverStartedAt ? Math.floor((Date.now() - serverStartedAt) / 1000) : 0;

        // Helper to format time as MM:SS
        const formatTime = (seconds) => {
          const mins = Math.floor(seconds / 60);
          const secs = Math.floor(seconds % 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };

        // Update debug info
        setDebugInfo({
          // DJ App player states
          djPlayer1Playing: serverPlayer1Playing,
          djPlayer2Playing: serverPlayer2Playing,
          crossfade: serverCrossfade,
          fadeTrigger: serverFadeTrigger ? `${serverFadeTrigger.start_value}→${serverFadeTrigger.end_value}` : 'none',
          // Video info
          player1Title: serverPlayer1Video?.title || 'none',
          player1Id: serverPlayer1Video?.youtube_id || 'none',
          player2Title: serverPlayer2Video?.title || 'none',
          player2Id: serverPlayer2Video?.youtube_id || 'none',
          // Playback times
          djPlayer1Time: formatTime(serverPlayer1Time),
          djPlayer2Time: formatTime(serverPlayer2Time),
          viewerPlayer1Time: formatTime(viewerPlayer1Time),
          viewerPlayer2Time: formatTime(viewerPlayer2Time),
          player1Diff: Math.abs(serverPlayer1Time - viewerPlayer1Time).toFixed(1),
          player2Diff: Math.abs(serverPlayer2Time - viewerPlayer2Time).toFixed(1),
          // Viewer state
          player1Ready: !!player1Ref.current,
          player2Ready: !!player2Ref.current,
          player1Volume: 100 - serverCrossfade,
          player2Volume: serverCrossfade,
          startedAt: serverStartedAt ? new Date(serverStartedAt).toLocaleTimeString() : 'none',
          elapsedSeconds,
          lastUpdate: new Date().toLocaleTimeString(),
          rawState: JSON.stringify(serverState, null, 0),
        });

      } catch (err) {
        if (err.response?.status === 404) {
          setIsEnded(true);
        }
      }
    };

    pollState();
    pollIntervalRef.current = setInterval(pollState, 2000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [hash]);

  // Sync crossfade when no fade animation is active
  useEffect(() => {
    // Only sync directly when there's no active fade animation
    if (!fadeTrigger) {
      setAnimatedCrossfade(crossfadeValue);
      // Set volumes directly
      try {
        if (player1Ref.current && typeof player1Ref.current.setVolume === 'function') {
          player1Ref.current.setVolume(100 - crossfadeValue);
        }
        if (player2Ref.current && typeof player2Ref.current.setVolume === 'function') {
          player2Ref.current.setVolume(crossfadeValue);
        }
      } catch (e) {}
    }
  }, [crossfadeValue, fadeTrigger]);

  // Fade animation effect - only triggers on fadeTrigger changes
  useEffect(() => {
    if (!fadeTrigger) {
      return;
    }

    // Cancel any existing animation
    if (fadeAnimationRef.current) {
      cancelAnimationFrame(fadeAnimationRef.current);
    }

    const { started_at, start_value, end_value, duration } = fadeTrigger;
    console.log('Starting fade animation:', { start_value, end_value, duration });

    const animate = () => {
      const now = Date.now();
      const elapsed = now - started_at;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out curve
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentValue = start_value + (end_value - start_value) * easeProgress;
      const roundedValue = Math.round(currentValue);

      // Update animated crossfade (drives opacity)
      setAnimatedCrossfade(roundedValue);

      // Update volumes
      try {
        if (player1Ref.current && typeof player1Ref.current.setVolume === 'function') {
          player1Ref.current.setVolume(100 - roundedValue);
        }
        if (player2Ref.current && typeof player2Ref.current.setVolume === 'function') {
          player2Ref.current.setVolume(roundedValue);
        }
      } catch (e) {}

      // Continue animation if not complete
      if (progress < 1) {
        fadeAnimationRef.current = requestAnimationFrame(animate);
      } else {
        console.log('Fade animation complete');
        fadeAnimationRef.current = null;
      }
    };

    // Start animation
    fadeAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
    };
  }, [fadeTrigger]);

  // Load video via API when video changes (no re-render needed)
  useEffect(() => {
    if (player1Ref.current && player1Video?.youtube_id) {
      const currentVideoId = player1VideoIdRef.current;
      if (currentVideoId !== player1Video.youtube_id) {
        console.log('Player 1: loading new video via API:', player1Video.youtube_id);
        player1VideoIdRef.current = player1Video.youtube_id;
        try {
          if (player1PlayingRef.current) {
            player1Ref.current.loadVideoById(player1Video.youtube_id);
          } else {
            player1Ref.current.cueVideoById(player1Video.youtube_id);
          }
        } catch (e) {
          console.log('Player 1 loadVideo error:', e);
        }
      }
    }
  }, [player1Video?.youtube_id]);

  useEffect(() => {
    if (player2Ref.current && player2Video?.youtube_id) {
      const currentVideoId = player2VideoIdRef.current;
      if (currentVideoId !== player2Video.youtube_id) {
        console.log('Player 2: loading new video via API:', player2Video.youtube_id);
        player2VideoIdRef.current = player2Video.youtube_id;
        try {
          if (player2PlayingRef.current) {
            player2Ref.current.loadVideoById(player2Video.youtube_id);
          } else {
            player2Ref.current.cueVideoById(player2Video.youtube_id);
          }
        } catch (e) {
          console.log('Player 2 loadVideo error:', e);
        }
      }
    }
  }, [player2Video?.youtube_id]);

  // Playback control - each player controlled independently based on DJ app state
  useEffect(() => {
    // Don't control playback until we've received state from server
    if (!hasReceivedState) return;

    const controlPlayer = () => {
      if (!player1Ref.current || typeof player1Ref.current.getPlayerState !== 'function') {
        return;
      }

      try {
        const state = player1Ref.current.getPlayerState();
        if (player1Playing) {
          // Only call playVideo if not already playing (state 1) or buffering (state 3)
          if (state !== 1 && state !== 3) {
            player1Ref.current.playVideo();
          }
        } else {
          // Only pause if actually playing
          if (state === 1 || state === 3) {
            player1Ref.current.pauseVideo();
          }
        }
      } catch (e) {
        player1Ref.current = null;
      }
    };

    controlPlayer();
    const interval = setInterval(controlPlayer, 1000);
    return () => clearInterval(interval);
  }, [player1Playing, player1Video, hasReceivedState]);

  useEffect(() => {
    if (!hasReceivedState) return;

    const controlPlayer = () => {
      if (!player2Ref.current || typeof player2Ref.current.getPlayerState !== 'function') {
        return;
      }

      try {
        const state = player2Ref.current.getPlayerState();
        if (player2Playing) {
          // Only call playVideo if not already playing (state 1) or buffering (state 3)
          if (state !== 1 && state !== 3) {
            player2Ref.current.playVideo();
          }
        } else {
          // Only pause if actually playing
          if (state === 1 || state === 3) {
            player2Ref.current.pauseVideo();
          }
        }
      } catch (e) {
        player2Ref.current = null;
      }
    };

    controlPlayer();
    const interval = setInterval(controlPlayer, 1000);
    return () => clearInterval(interval);
  }, [player2Playing, player2Video, hasReceivedState]);

  const opts = {
    width: '100%',
    height: '100%',
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,  // Auto-start (muted to bypass browser restrictions)
      controls: 0,
      disablekb: 1,  // Disable keyboard controls
      fs: 0,  // Disable fullscreen button
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      playsinline: 1,
      mute: 1,  // Start muted to allow autoplay
    },
  };

  const safePlayerCall = (playerRef, method, ...args) => {
    try {
      if (playerRef.current && typeof playerRef.current[method] === 'function') {
        playerRef.current[method](...args);
      }
    } catch (e) {
      // Player was destroyed, ignore
    }
  };

  const onPlayer1Ready = (event) => {
    console.log('Player 1 ready, djPlaying:', player1PlayingRef.current, 'crossfade:', crossfadeRef.current);
    player1Ref.current = event.target;

    // Start playing muted (autoplay allowed when muted)
    safePlayerCall(player1Ref, 'playVideo');

    // Keep trying to play for a few seconds (in case of timing issues)
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        if (player1PlayingRef.current) {
          safePlayerCall(player1Ref, 'playVideo');
        }
      }, i * 1000);
    }
  };

  const onPlayer2Ready = (event) => {
    console.log('Player 2 ready, djPlaying:', player2PlayingRef.current, 'crossfade:', crossfadeRef.current);
    player2Ref.current = event.target;

    // Start playing muted (autoplay allowed when muted)
    safePlayerCall(player2Ref, 'playVideo');

    // Keep trying to play for a few seconds (in case of timing issues)
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        if (player2PlayingRef.current) {
          safePlayerCall(player2Ref, 'playVideo');
        }
      }, i * 1000);
    }
  };

  // Handle unmute button click
  const handleUnmute = () => {
    console.log('User clicked unmute');
    setIsMuted(false);
    safePlayerCall(player1Ref, 'unMute');
    safePlayerCall(player1Ref, 'setVolume', 100 - crossfadeRef.current);
    safePlayerCall(player2Ref, 'unMute');
    safePlayerCall(player2Ref, 'setVolume', crossfadeRef.current);
  };

  // Handle fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading && !isEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-300">Connecting...</p>
        </div>
      </div>
    );
  }

  if (isEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl text-white mb-2">Broadcast Ended</h1>
          <p className="text-purple-300/60 mb-4">This broadcast is no longer active.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Broadcast icon */}
      <div className="absolute top-4 left-4 z-30">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
        </div>
      </div>

      {/* Control buttons - top right */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {/* Unmute button - shows when muted */}
        {isMuted && (
          <button
            onClick={handleUnmute}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full px-4 py-2 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
            <span className="text-white text-sm font-medium">Tap to unmute</span>
          </button>
        )}

        {/* Fullscreen button */}
        <button
          onClick={toggleFullscreen}
          className="flex items-center justify-center w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors cursor-pointer"
        >
          {isFullscreen ? (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      </div>

      {/* Dual video players - fullscreen overlapping, pointer-events disabled to prevent pause on click */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Player 1 - base layer */}
        <div
          className="absolute inset-0 z-10"
          style={{ opacity: Math.max(0.01, (100 - animatedCrossfade) / 100) }}
        >
          <div className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full">
            <YouTube
              key="player1"
              videoId={player1Video?.youtube_id || ''}
              opts={opts}
              onReady={onPlayer1Ready}
              className="!w-full !h-full"
              iframeClassName="!w-full !h-full !absolute !inset-0"
            />
          </div>
        </div>

        {/* Player 2 - overlay layer, opacity controlled by crossfade */}
        <div
          className="absolute inset-0 z-20"
          style={{ opacity: Math.max(0.01, animatedCrossfade / 100) }}
        >
          <div className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full">
            <YouTube
              key="player2"
              videoId={player2Video?.youtube_id || ''}
              opts={opts}
              onReady={onPlayer2Ready}
              className="!w-full !h-full"
              iframeClassName="!w-full !h-full !absolute !inset-0"
            />
          </div>
        </div>
      </div>

      {/* Debug panel - only shown with ?debug=1 */}
      {showDebug && (
      <div className="absolute bottom-2 left-2 z-50 bg-black/80 text-white text-[10px] font-mono p-2 rounded-lg max-w-xs max-h-[50vh] overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {/* DJ App Status */}
          <div className="col-span-2 text-purple-400 font-bold border-b border-purple-400/30 mb-1">DJ APP STATUS</div>
          <div>DJ Player 1 Playing: <span className={debugInfo.djPlayer1Playing ? 'text-green-400 font-bold' : 'text-red-400'}>{String(debugInfo.djPlayer1Playing)}</span></div>
          <div>DJ Player 2 Playing: <span className={debugInfo.djPlayer2Playing ? 'text-green-400 font-bold' : 'text-red-400'}>{String(debugInfo.djPlayer2Playing)}</span></div>
          <div>Server Crossfade: <span className="text-cyan-400">{debugInfo.crossfade}</span></div>
          <div>Animated: <span className="text-green-400 font-bold">{animatedCrossfade}</span></div>
          <div>Fade Trigger: <span className={debugInfo.fadeTrigger !== 'none' ? 'text-green-400 font-bold' : 'text-gray-400'}>{debugInfo.fadeTrigger}</span></div>
          <div>Elapsed: {debugInfo.elapsedSeconds}s</div>

          {/* Player 1 */}
          <div className="col-span-2 text-yellow-400 font-bold border-b border-yellow-400/30 mt-2 mb-1">VIEWER PLAYER 1</div>
          <div>DJ Playing: <span className={debugInfo.djPlayer1Playing ? 'text-green-400 font-bold' : 'text-red-400'}>{String(debugInfo.djPlayer1Playing)}</span></div>
          <div>Ready: <span className={debugInfo.player1Ready ? 'text-green-400' : 'text-red-400'}>{String(debugInfo.player1Ready)}</span></div>
          <div>Volume: <span className="text-yellow-400">{100 - animatedCrossfade}</span></div>
          <div>Opacity: <span className="text-yellow-400">{Math.round(100 - animatedCrossfade)}%</span></div>
          <div>Local Playing: <span className={player1Playing ? 'text-green-400' : 'text-red-400'}>{String(player1Playing)}</span></div>
          <div>DJ Time: <span className="text-yellow-400">{debugInfo.djPlayer1Time}</span></div>
          <div>Viewer Time: <span className="text-yellow-400">{debugInfo.viewerPlayer1Time}</span> <span className={parseFloat(debugInfo.player1Diff) > 5 ? 'text-red-400 font-bold' : 'text-green-400'}>(diff: {debugInfo.player1Diff}s)</span></div>
          <div className="col-span-2">Title: <span className="text-yellow-300">{debugInfo.player1Title}</span></div>

          {/* Player 2 */}
          <div className="col-span-2 text-cyan-400 font-bold border-b border-cyan-400/30 mt-2 mb-1">VIEWER PLAYER 2</div>
          <div>DJ Playing: <span className={debugInfo.djPlayer2Playing ? 'text-green-400 font-bold' : 'text-red-400'}>{String(debugInfo.djPlayer2Playing)}</span></div>
          <div>Ready: <span className={debugInfo.player2Ready ? 'text-green-400' : 'text-red-400'}>{String(debugInfo.player2Ready)}</span></div>
          <div>Volume: <span className="text-cyan-400">{animatedCrossfade}</span></div>
          <div>Opacity: <span className="text-cyan-400">{animatedCrossfade}%</span></div>
          <div>Local Playing: <span className={player2Playing ? 'text-green-400' : 'text-red-400'}>{String(player2Playing)}</span></div>
          <div>DJ Time: <span className="text-cyan-400">{debugInfo.djPlayer2Time}</span></div>
          <div>Viewer Time: <span className="text-cyan-400">{debugInfo.viewerPlayer2Time}</span> <span className={parseFloat(debugInfo.player2Diff) > 5 ? 'text-red-400 font-bold' : 'text-green-400'}>(diff: {debugInfo.player2Diff}s)</span></div>
          <div className="col-span-2">Title: <span className="text-cyan-300">{debugInfo.player2Title}</span></div>

          {/* Raw State */}
          <div className="col-span-2 text-gray-400 font-bold border-b border-gray-400/30 mt-2 mb-1">RAW SERVER STATE</div>
          <div className="col-span-2 text-gray-400 break-all text-[10px] max-h-20 overflow-y-auto">{debugInfo.rawState}</div>

          <div className="col-span-2 text-white/50 mt-2">Last update: {debugInfo.lastUpdate}</div>

          <div className="col-span-2 mt-1 flex gap-1 flex-wrap">
            <button
              onClick={() => {
                console.log('Force play clicked');
                player1Ref.current?.playVideo();
                player2Ref.current?.playVideo();
              }}
              className="px-2 py-0.5 bg-green-600 hover:bg-green-500 rounded text-[9px]"
            >
              Play
            </button>
            <button
              onClick={() => {
                const state1 = player1Ref.current?.getPlayerState();
                const state2 = player2Ref.current?.getPlayerState();
                const msg = `P1: ${state1}, P2: ${state2}`;
                console.log(msg);
                alert(msg);
              }}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 rounded text-[9px]"
            >
              States
            </button>
            <button
              onClick={() => {
                console.log('Debug info:', debugInfo);
                console.log('Player 1 ref:', player1Ref.current);
                console.log('Player 2 ref:', player2Ref.current);
              }}
              className="px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded text-[9px]"
            >
              Log
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
