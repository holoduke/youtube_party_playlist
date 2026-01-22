import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { getChannelState, pingViewerPresence, leaveChannel } from '../services/api';

// Generate or retrieve a persistent viewer ID
const getViewerId = () => {
  let viewerId = localStorage.getItem('barmania_viewer_id');
  if (!viewerId) {
    viewerId = 'v_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('barmania_viewer_id', viewerId);
  }
  return viewerId;
};

export default function BroadcastViewer() {
  const { hash } = useParams();
  const [searchParams] = useSearchParams();
  const showDebug = searchParams.get('debug') === '1';
  const [, setPlaylistName] = useState('');
  const [player1Video, setPlayer1Video] = useState(null);
  const [player2Video, setPlayer2Video] = useState(null);
  const [player1Playing, setPlayer1Playing] = useState(false);
  const [player2Playing, setPlayer2Playing] = useState(false);
  const [crossfadeValue, setCrossfadeValue] = useState(0);
  const [animatedCrossfade, setAnimatedCrossfade] = useState(0); // Smoothly animated value
  const [isEnded, setIsEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState({});
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasReceivedState, setHasReceivedState] = useState(false);
  const [, setStartedAt] = useState(null);
  const [fadeTrigger, setFadeTrigger] = useState(null);
  // Stable initial video IDs - set once when first video is received, never changes
  // This prevents YouTube component from re-initializing when videos change
  const [initialPlayer1VideoId, setInitialPlayer1VideoId] = useState(null);
  const [initialPlayer2VideoId, setInitialPlayer2VideoId] = useState(null);
  // Idle screen image URL from playlist settings
  const [idleImageUrl, setIdleImageUrl] = useState(null);
  // Stopped state from DJ (shows idle screen)
  const [isStopped, setIsStopped] = useState(false);

  const player1Ref = useRef(null);
  const player2Ref = useRef(null);
  const pollIntervalRef = useRef(null);
  // Track what we've seen from server (for poll optimization)
  const player1SeenVideoIdRef = useRef(null);
  const player2SeenVideoIdRef = useRef(null);
  // Track what's actually loaded in the player (for video load effect)
  const player1LoadedVideoIdRef = useRef(null);
  const player2LoadedVideoIdRef = useRef(null);
  // Track if a video is currently being loaded (to prevent time sync during load)
  const player1LoadingRef = useRef(false);
  const player2LoadingRef = useRef(false);
  // Track last set volume to avoid unnecessary API calls
  const player1LastVolumeRef = useRef(-1);
  const player2LastVolumeRef = useRef(-1);
  const player1PlayingRef = useRef(false);
  const player2PlayingRef = useRef(false);
  const prevPlayer1PlayingRef = useRef(false);
  const prevPlayer2PlayingRef = useRef(false);
  const crossfadeRef = useRef(0);
  const startedAtRef = useRef(null);
  const fadeAnimationRef = useRef(null);
  const lastFadeTriggerRef = useRef(null);
  const isMutedRef = useRef(true); // Track muted state to re-apply after video loads
  // Track if players have been initialized (to skip API calls before ready)
  const player1InitializedRef = useRef(false);
  const player2InitializedRef = useRef(false);
  // Track when fades end to prevent video loads immediately after
  const lastFadeEndTimeRef = useRef(0);
  // Track last seek time per player to add cooldown between seeks
  const lastSeekTimeRef = useRef({ 1: 0, 2: 0 });
  // Track ended state for polling closure
  const isEndedRef = useRef(false);

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

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    isEndedRef.current = isEnded;
  }, [isEnded]);

  // Handle visibility changes - try to keep playback going when hidden, resume when visible
  useEffect(() => {
    let keepAliveInterval = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab going hidden - set up interval to keep trying to play
        // This fights against browser throttling
        if (!keepAliveInterval) {
          keepAliveInterval = setInterval(() => {
            const player1FadedOut = crossfadeRef.current >= 95;
            const player2FadedOut = crossfadeRef.current <= 5;

            if (player1PlayingRef.current && !player1FadedOut && player1Ref.current) {
              try { player1Ref.current.playVideo(); } catch { /* ignore */ }
            }
            if (player2PlayingRef.current && !player2FadedOut && player2Ref.current) {
              try { player2Ref.current.playVideo(); } catch { /* ignore */ }
            }
          }, 1000);
        }
      } else {
        // Tab visible again - clear interval and immediately resume
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        if (!isMutedRef.current) {
          const player1FadedOut = crossfadeRef.current >= 95;
          const player2FadedOut = crossfadeRef.current <= 5;

          if (player1PlayingRef.current && !player1FadedOut && player1Ref.current) {
            try { player1Ref.current.playVideo(); } catch { /* ignore */ }
          }
          if (player2PlayingRef.current && !player2FadedOut && player2Ref.current) {
            try { player2Ref.current.playVideo(); } catch { /* ignore */ }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (keepAliveInterval) clearInterval(keepAliveInterval);
    };
  }, []);

  // Poll for channel broadcast state
  useEffect(() => {
    const pollState = async () => {
      try {
        const data = await getChannelState(hash);

        if (!data.is_broadcasting) {
          setIsEnded(true);
          // Continue polling to detect when broadcast comes back online
          return;
        }

        // Broadcast is live - if we were showing "ended", reset and reconnect
        if (isEndedRef.current) {
          console.log('Broadcast came back online, reconnecting...');
          setIsEnded(false);
          setLoading(true);
          // Reset video state to re-sync from scratch
          setPlayer1Video(null);
          setPlayer2Video(null);
          setInitialPlayer1VideoId(null);
          setInitialPlayer2VideoId(null);
          player1SeenVideoIdRef.current = null;
          player2SeenVideoIdRef.current = null;
          player1LoadedVideoIdRef.current = null;
          player2LoadedVideoIdRef.current = null;
          player1InitializedRef.current = false;
          player2InitializedRef.current = false;
          setHasReceivedState(false);
        }

        setPlaylistName(data.playlist_name || 'Live Broadcast');
        setIdleImageUrl(data.idle_image_url || null);
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
        // Stopped state (shows idle screen)
        const serverIsStopped = serverState.is_stopped ?? false;
        setIsStopped(serverIsStopped);

        // Update player 1 if video changed
        if (serverPlayer1Video?.youtube_id !== player1SeenVideoIdRef.current) {
          setPlayer1Video(serverPlayer1Video);
          player1SeenVideoIdRef.current = serverPlayer1Video?.youtube_id;
          // Set initial video ID on first video (for stable YouTube component)
          if (serverPlayer1Video?.youtube_id && !initialPlayer1VideoId) {
            setInitialPlayer1VideoId(serverPlayer1Video.youtube_id);
            // Mark as loaded since YouTube component will load it from prop
            player1LoadedVideoIdRef.current = serverPlayer1Video.youtube_id;
          }
        }

        // Update player 2 if video changed
        if (serverPlayer2Video?.youtube_id !== player2SeenVideoIdRef.current) {
          setPlayer2Video(serverPlayer2Video);
          player2SeenVideoIdRef.current = serverPlayer2Video?.youtube_id;
          // Set initial video ID on first video (for stable YouTube component)
          if (serverPlayer2Video?.youtube_id && !initialPlayer2VideoId) {
            setInitialPlayer2VideoId(serverPlayer2Video.youtube_id);
            // Mark as loaded since YouTube component will load it from prop
            player2LoadedVideoIdRef.current = serverPlayer2Video.youtube_id;
          }
        }

        setCrossfadeValue(serverCrossfade);

        // Update individual player playing states
        setPlayer1Playing(serverPlayer1Playing);
        setPlayer2Playing(serverPlayer2Playing);
        setHasReceivedState(true);

        // Check for new fade trigger from DJ app (need to check this before force-play)
        const serverFadeTrigger = serverState.fade_trigger;

        // Force play if server says playing but client isn't
        // Skip during fades and for fully faded-out players to avoid triggering onReady
        // Player 1 is faded out when crossfade >= 95, Player 2 when crossfade <= 5
        const player1FadedOut = serverCrossfade >= 95;
        const player2FadedOut = serverCrossfade <= 5;

        if (!serverFadeTrigger) {
          try {
            // Only sync if player is initialized and not faded out
            if (serverPlayer1Playing && player1Ref.current && !player1FadedOut && player1InitializedRef.current) {
              const state1 = player1Ref.current.getPlayerState?.();
              // State 1 = playing, 3 = buffering - these are OK
              // -1 = unstarted, 0 = ended, 2 = paused, 5 = cued
              if (state1 !== 1 && state1 !== 3) {
                console.log(`[YT API] Poll sync: Player 1.playVideo() (state was ${state1})`);
                player1Ref.current.playVideo();
              }
            }
            if (serverPlayer2Playing && player2Ref.current && !player2FadedOut && player2InitializedRef.current) {
              const state2 = player2Ref.current.getPlayerState?.();
              if (state2 !== 1 && state2 !== 3) {
                console.log(`[YT API] Poll sync: Player 2.playVideo() (state was ${state2})`);
                player2Ref.current.playVideo();
              }
            }
          } catch (e) {
            console.log('[YT API] Poll sync error:', e);
          }
        }

        // Process fade trigger state changes
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
        } catch { /* ignore */ }

        // Sync playback time (use higher threshold to avoid constant seeking)
        const SYNC_THRESHOLD = 20;
        const SEEK_COOLDOWN_MS = 10000; // Don't seek more than once per 10 seconds

        // Helper to safely call player methods (iframe may be destroyed)
        const safeSeek = (playerRef, time) => {
          const playerNum = playerRef === player1Ref ? 1 : 2;
          const now = Date.now();
          // Check cooldown
          if (now - lastSeekTimeRef.current[playerNum] < SEEK_COOLDOWN_MS) {
            return;
          }
          try {
            if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
              console.log(`[YT API] Time sync: Player ${playerNum}.seekTo(${time.toFixed(1)})`);
              playerRef.current.seekTo(time, true);
              lastSeekTimeRef.current[playerNum] = now;
            }
          } catch {
            // Player iframe was destroyed, ignore
          }
        };

        const safePause = (playerRef) => {
          const playerNum = playerRef === player1Ref ? 1 : 2;
          try {
            if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
              console.log(`[YT API] Time sync: Player ${playerNum}.pauseVideo()`);
              playerRef.current.pauseVideo();
            }
          } catch {
            // Player iframe was destroyed, ignore
          }
        };

        // Skip all time sync during fade transitions (causes buffering)
        const isFading = !!serverFadeTrigger;

        // Player 1: Check for pause transition or drift
        // Skip time sync if player not initialized, video is changing, loading, during fade, or player is faded out
        const player1VideoMatches = serverPlayer1Video?.youtube_id === player1LoadedVideoIdRef.current;
        const player1CanSync = player1InitializedRef.current && player1VideoMatches && !player1LoadingRef.current && !isFading && !player1FadedOut;
        const wasPlaying1 = prevPlayer1PlayingRef.current;
        const justPaused1 = wasPlaying1 && !serverPlayer1Playing;

        if (player1CanSync) {
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
        }

        // Player 2: Check for pause transition or drift
        // Skip time sync if player not initialized, video is changing, loading, during fade, or player is faded out
        const player2VideoMatches = serverPlayer2Video?.youtube_id === player2LoadedVideoIdRef.current;
        const player2CanSync = player2InitializedRef.current && player2VideoMatches && !player2LoadingRef.current && !isFading && !player2FadedOut;
        const wasPlaying2 = prevPlayer2PlayingRef.current;
        const justPaused2 = wasPlaying2 && !serverPlayer2Playing;

        if (player2CanSync) {
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

  // Viewer presence tracking - ping every 30 seconds, leave on unmount
  useEffect(() => {
    if (!hash) return;

    const viewerId = getViewerId();
    let pingIntervalId = null;

    // Initial ping
    pingViewerPresence(hash, viewerId).catch(err => {
      console.log('Viewer ping error:', err);
    });

    // Ping every 15 seconds
    pingIntervalId = setInterval(() => {
      pingViewerPresence(hash, viewerId).catch(err => {
        console.log('Viewer ping error:', err);
      });
    }, 15000);

    // Leave on beforeunload (tab close/refresh)
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability on page unload
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      navigator.sendBeacon(
        `${API_BASE_URL}/api/channel/watch/${hash}/leave`,
        JSON.stringify({ viewer_id: viewerId })
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      if (pingIntervalId) clearInterval(pingIntervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Call leave API on unmount (normal navigation)
      leaveChannel(hash, viewerId).catch(() => {});
    };
  }, [hash]);

  // Helper to set volume only if it changed
  const setPlayerVolume = (playerRef, lastVolumeRef, newVolume) => {
    if (lastVolumeRef.current !== newVolume) {
      const playerNum = playerRef === player1Ref ? 1 : 2;
      try {
        if (playerRef.current && typeof playerRef.current.setVolume === 'function') {
          console.log(`[YT API] Sync: Player ${playerNum}.setVolume(${newVolume})`);
          playerRef.current.setVolume(newVolume);
          lastVolumeRef.current = newVolume;
        }
      } catch { /* ignore */ }
    }
  };

  // Sync crossfade when no fade animation is active
  useEffect(() => {
    // Only sync directly when there's no active fade animation
    if (!fadeTrigger) {
      setAnimatedCrossfade(crossfadeValue);
      // Set volumes only if changed
      const vol1 = isMutedRef.current ? 0 : 100 - crossfadeValue;
      const vol2 = isMutedRef.current ? 0 : crossfadeValue;
      setPlayerVolume(player1Ref, player1LastVolumeRef, vol1);
      setPlayerVolume(player2Ref, player2LastVolumeRef, vol2);
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

      // Skip volume updates entirely when muted (volumes are already 0)
      if (isMutedRef.current) {
        // Continue animation but don't touch YouTube API
      } else {
        // Update volumes only if changed by at least 5 (reduces API calls from ~100 to ~20)
        const vol1 = 100 - roundedValue;
        const vol2 = roundedValue;

        // Only update if changed by 5+ or reaching boundaries (0 or 100) for the first time
        const shouldUpdateVol1 = player1LastVolumeRef.current !== vol1 &&
          (Math.abs(player1LastVolumeRef.current - vol1) >= 5 || vol1 === 0 || vol1 === 100);
        const shouldUpdateVol2 = player2LastVolumeRef.current !== vol2 &&
          (Math.abs(player2LastVolumeRef.current - vol2) >= 5 || vol2 === 0 || vol2 === 100);

        if (shouldUpdateVol1) {
          try {
            if (player1Ref.current?.setVolume) {
              console.log(`[YT API] Fade: Player 1.setVolume(${vol1})`);
              player1Ref.current.setVolume(vol1);
              player1LastVolumeRef.current = vol1;
            }
          } catch { /* ignore */ }
        }
        if (shouldUpdateVol2) {
          try {
            if (player2Ref.current?.setVolume) {
              console.log(`[YT API] Fade: Player 2.setVolume(${vol2})`);
              player2Ref.current.setVolume(vol2);
              player2LastVolumeRef.current = vol2;
            }
          } catch { /* ignore */ }
        }
      }

      // Continue animation if not complete
      if (progress < 1) {
        fadeAnimationRef.current = requestAnimationFrame(animate);
      } else {
        console.log('Fade animation complete');
        fadeAnimationRef.current = null;
        // Record fade end time to prevent immediate video loads
        lastFadeEndTimeRef.current = Date.now();
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

  // Logged wrapper for all YouTube API calls - helps debug excessive calls
  const safePlayerCall = (playerRef, method, ...args) => {
    const playerNum = playerRef === player1Ref ? 1 : 2;
    try {
      if (playerRef.current && typeof playerRef.current[method] === 'function') {
        console.log(`[YT API] Player ${playerNum}.${method}(${args.join(', ')})`);
        playerRef.current[method](...args);
      }
    } catch {
      // Ignore API errors
    }
  };

  // Load video via API when video changes (no re-render needed)
  // Skip during fades, delay after fades to avoid spinner
  useEffect(() => {
    // Don't load videos during active fades
    if (fadeTrigger) {
      console.log('Player 1: skipping video load during fade');
      return;
    }
    if (!player1Ref.current || !player1Video?.youtube_id) return;

    const loadedVideoId = player1LoadedVideoIdRef.current;
    if (loadedVideoId === player1Video.youtube_id) return;

    // Delay video load if fade just ended
    const timeSinceFadeEnd = Date.now() - lastFadeEndTimeRef.current;
    const delay = timeSinceFadeEnd < 2000 ? 2000 - timeSinceFadeEnd : 0;

    if (delay > 0) {
      console.log(`Player 1: delaying video load by ${delay}ms after fade`);
    }

    const timeoutId = setTimeout(() => {
      // Re-check conditions after delay
      if (player1LoadedVideoIdRef.current === player1Video.youtube_id) return;
      if (!player1Ref.current) return;

      player1LoadedVideoIdRef.current = player1Video.youtube_id;
      player1LoadingRef.current = true;
      try {
        console.log(`[YT API] Player 1.cueVideoById(${player1Video.youtube_id})`);
        player1Ref.current.cueVideoById(player1Video.youtube_id);
        setTimeout(() => {
          player1LoadingRef.current = false;
          if (!isMutedRef.current) {
            safePlayerCall(player1Ref, 'unMute');
            safePlayerCall(player1Ref, 'setVolume', 100 - crossfadeRef.current);
          }
          if (player1PlayingRef.current) {
            safePlayerCall(player1Ref, 'playVideo');
          }
        }, 500);
      } catch (e) {
        console.log('Player 1 loadVideo error:', e);
        player1LoadingRef.current = false;
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [player1Video?.youtube_id, fadeTrigger]);

  // Skip during fades, delay after fades to avoid spinner
  useEffect(() => {
    // Don't load videos during active fades
    if (fadeTrigger) {
      console.log('Player 2: skipping video load during fade');
      return;
    }
    if (!player2Ref.current || !player2Video?.youtube_id) return;

    const loadedVideoId = player2LoadedVideoIdRef.current;
    if (loadedVideoId === player2Video.youtube_id) return;

    // Delay video load if fade just ended
    const timeSinceFadeEnd = Date.now() - lastFadeEndTimeRef.current;
    const delay = timeSinceFadeEnd < 2000 ? 2000 - timeSinceFadeEnd : 0;

    if (delay > 0) {
      console.log(`Player 2: delaying video load by ${delay}ms after fade`);
    }

    const timeoutId = setTimeout(() => {
      // Re-check conditions after delay
      if (player2LoadedVideoIdRef.current === player2Video.youtube_id) return;
      if (!player2Ref.current) return;

      player2LoadedVideoIdRef.current = player2Video.youtube_id;
      player2LoadingRef.current = true;
      try {
        console.log(`[YT API] Player 2.cueVideoById(${player2Video.youtube_id})`);
        player2Ref.current.cueVideoById(player2Video.youtube_id);
        setTimeout(() => {
          player2LoadingRef.current = false;
          if (!isMutedRef.current) {
            safePlayerCall(player2Ref, 'unMute');
            safePlayerCall(player2Ref, 'setVolume', crossfadeRef.current);
          }
          if (player2PlayingRef.current) {
            safePlayerCall(player2Ref, 'playVideo');
          }
        }, 500);
      } catch (e) {
        console.log('Player 2 loadVideo error:', e);
        player2LoadingRef.current = false;
      }
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [player2Video?.youtube_id, fadeTrigger]);

  // Playback control - each player controlled independently based on DJ app state
  // Skip during fades and for faded-out players to avoid triggering player reinitialization
  useEffect(() => {
    // Don't control playback until we've received state from server
    if (!hasReceivedState) return;
    // Skip during fades to avoid triggering onReady reinitializations
    if (fadeTrigger) return;
    // Skip if Player 1 is fully faded out (no need to control it)
    if (crossfadeValue >= 95) return;

    const controlPlayer = () => {
      if (!player1Ref.current || typeof player1Ref.current.getPlayerState !== 'function') {
        return;
      }

      try {
        const state = player1Ref.current.getPlayerState();
        if (player1Playing) {
          // Only call playVideo if not already playing (state 1) or buffering (state 3)
          if (state !== 1 && state !== 3) {
            console.log(`[YT API] Playback ctrl: Player 1.playVideo() (state was ${state})`);
            player1Ref.current.playVideo();
          }
        } else {
          // Only pause if actually playing
          if (state === 1 || state === 3) {
            console.log(`[YT API] Playback ctrl: Player 1.pauseVideo() (state was ${state})`);
            player1Ref.current.pauseVideo();
          }
        }
      } catch {
        player1Ref.current = null;
      }
    };

    controlPlayer();
    const interval = setInterval(controlPlayer, 1000);
    return () => clearInterval(interval);
  }, [player1Playing, player1Video, hasReceivedState, fadeTrigger, crossfadeValue]);

  useEffect(() => {
    if (!hasReceivedState) return;
    // Skip during fades to avoid triggering onReady reinitializations
    if (fadeTrigger) return;
    // Skip if Player 2 is fully faded out (no need to control it)
    if (crossfadeValue <= 5) return;

    const controlPlayer = () => {
      if (!player2Ref.current || typeof player2Ref.current.getPlayerState !== 'function') {
        return;
      }

      try {
        const state = player2Ref.current.getPlayerState();
        if (player2Playing) {
          // Only call playVideo if not already playing (state 1) or buffering (state 3)
          if (state !== 1 && state !== 3) {
            console.log(`[YT API] Playback ctrl: Player 2.playVideo() (state was ${state})`);
            player2Ref.current.playVideo();
          }
        } else {
          // Only pause if actually playing
          if (state === 1 || state === 3) {
            console.log(`[YT API] Playback ctrl: Player 2.pauseVideo() (state was ${state})`);
            player2Ref.current.pauseVideo();
          }
        }
      } catch {
        player2Ref.current = null;
      }
    };

    controlPlayer();
    const interval = setInterval(controlPlayer, 1000);
    return () => clearInterval(interval);
  }, [player2Playing, player2Video, hasReceivedState, fadeTrigger, crossfadeValue]);

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

  const onPlayer1Ready = (event) => {
    // Always update the ref (player object may change after loadVideoById)
    player1Ref.current = event.target;

    // Skip initialization if already done (loadVideoById can trigger onReady again)
    if (player1InitializedRef.current) {
      console.log('Player 1 onReady (already initialized)');
      player1LoadingRef.current = false; // Video is ready, allow time sync
      // Skip any API calls during fades - the fade animation handles volume
      if (lastFadeTriggerRef.current) {
        console.log('Player 1 onReady: skipping API calls during fade');
        return;
      }
      // Re-apply unmuted state and volume after video load (only when not fading)
      if (!isMutedRef.current) {
        const vol = 100 - crossfadeRef.current;
        safePlayerCall(player1Ref, 'unMute');
        safePlayerCall(player1Ref, 'setVolume', vol);
        player1LastVolumeRef.current = vol;
      }
      return;
    }
    player1InitializedRef.current = true;
    console.log('Player 1 ready, djPlaying:', player1PlayingRef.current, 'crossfade:', crossfadeRef.current);

    // Start playing muted (autoplay allowed when muted)
    safePlayerCall(player1Ref, 'playVideo');

    // Keep trying to play for a few seconds (in case of timing issues)
    for (let i = 1; i <= 3; i++) {
      setTimeout(() => {
        if (player1PlayingRef.current && !lastFadeTriggerRef.current) {
          safePlayerCall(player1Ref, 'playVideo');
        }
      }, i * 1000);
    }
  };

  const onPlayer2Ready = (event) => {
    // Always update the ref (player object may change after loadVideoById)
    player2Ref.current = event.target;

    // Skip initialization if already done (loadVideoById can trigger onReady again)
    if (player2InitializedRef.current) {
      console.log('Player 2 onReady (already initialized)');
      player2LoadingRef.current = false; // Video is ready, allow time sync
      // Skip any API calls during fades - the fade animation handles volume
      if (lastFadeTriggerRef.current) {
        console.log('Player 2 onReady: skipping API calls during fade');
        return;
      }
      // Re-apply unmuted state and volume after video load (only when not fading)
      if (!isMutedRef.current) {
        const vol = crossfadeRef.current;
        safePlayerCall(player2Ref, 'unMute');
        safePlayerCall(player2Ref, 'setVolume', vol);
        player2LastVolumeRef.current = vol;
      }
      return;
    }
    player2InitializedRef.current = true;
    console.log('Player 2 ready, djPlaying:', player2PlayingRef.current, 'crossfade:', crossfadeRef.current);

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
    console.log('User clicked unmute, crossfadeRef:', crossfadeRef.current, 'animatedCrossfade:', animatedCrossfade);
    setIsMuted(false);
    // Use animatedCrossfade for volume to match the visual state
    const vol1 = 100 - animatedCrossfade;
    const vol2 = animatedCrossfade;
    console.log('Setting volumes: vol1=', vol1, 'vol2=', vol2);
    safePlayerCall(player1Ref, 'unMute');
    safePlayerCall(player1Ref, 'setVolume', vol1);
    player1LastVolumeRef.current = vol1;
    safePlayerCall(player2Ref, 'unMute');
    safePlayerCall(player2Ref, 'setVolume', vol2);
    player2LastVolumeRef.current = vol2;

    // IMPORTANT: Start BOTH players in this single user gesture
    // This gives both players "user-initiated" privilege so they continue in background
    // Volume/crossfade will control which one is actually heard
    safePlayerCall(player1Ref, 'playVideo');
    safePlayerCall(player2Ref, 'playVideo');
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

      {/* Idle Screen Overlay - shows when stopped, not playing, or no videos loaded */}
      {idleImageUrl && (
        isStopped ||
        (!initialPlayer1VideoId && !initialPlayer2VideoId) ||
        (hasReceivedState && !player1Playing && !player2Playing && !fadeTrigger)
      ) && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black">
          <img
            src={idleImageUrl}
            alt="Idle screen"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {/* Dual video players - fullscreen overlapping, pointer-events disabled to prevent pause on click */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Player 1 - base layer (only render once we have initial video ID) */}
        <div
          className="absolute inset-0 z-10"
          style={{ opacity: Math.max(0.01, (100 - animatedCrossfade) / 100) }}
        >
          {initialPlayer1VideoId && (
            <div className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full">
              <YouTube
                key="player1"
                videoId={initialPlayer1VideoId}
                opts={opts}
                onReady={onPlayer1Ready}
                className="!w-full !h-full"
                iframeClassName="!w-full !h-full !absolute !inset-0"
              />
            </div>
          )}
        </div>

        {/* Player 2 - overlay layer, opacity controlled by crossfade (only render once we have initial video ID) */}
        <div
          className="absolute inset-0 z-20"
          style={{ opacity: Math.max(0.01, animatedCrossfade / 100) }}
        >
          {initialPlayer2VideoId && (
            <div className="absolute inset-0 [&>div]:!w-full [&>div]:!h-full [&_iframe]:!w-full [&_iframe]:!h-full">
              <YouTube
                key="player2"
                videoId={initialPlayer2VideoId}
                opts={opts}
                onReady={onPlayer2Ready}
                className="!w-full !h-full"
                iframeClassName="!w-full !h-full !absolute !inset-0"
              />
            </div>
          )}
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
