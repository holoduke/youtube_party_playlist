import YouTube from 'react-youtube';
import { useRef, useEffect, useState, useImperativeHandle, forwardRef, memo, useMemo, useCallback } from 'react';

const VideoPlayer = forwardRef(({ video, volume, playerNumber, isActive, onTimeUpdate, onEnded, onStateUpdate, onError, autoStart = true, onAddToPlaylist, isInPlaylist, onVideoDrop, showDropOverlay, hideOverlays = false }, ref) => {
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

  // Track the currently loaded video ID to prevent unnecessary reloads
  const loadedVideoIdRef = useRef(null);
  // Track the initial video ID for the YouTube component (stable after first set)
  const [initialVideoId, setInitialVideoId] = useState(null);
  // Track autoStart value for when player becomes ready
  const autoStartRef = useRef(autoStart);

  // Keep ref updated until player is ready (to catch late state updates)
  useEffect(() => {
    if (!isPlayerReady) {
      autoStartRef.current = autoStart;
    }
  }, [autoStart, isPlayerReady]);

  // Reset drag over state when overlay is hidden
  useEffect(() => {
    if (!showDropOverlay) {
      setIsDragOver(false);
    }
  }, [showDropOverlay]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData && onVideoDrop) {
      try {
        const videoData = JSON.parse(jsonData);
        if (videoData && videoData.youtube_id) {
          onVideoDrop(videoData, playerNumber);
        }
      } catch (err) {
        console.error('Failed to parse drop data:', err);
      }
    }
  };

  const stopTimeTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimeTracking = useCallback(() => {
    stopTimeTracking();

    intervalRef.current = setInterval(() => {
      if (playerRef.current) {
        try {
          const time = playerRef.current.getCurrentTime() || 0;
          const dur = playerRef.current.getDuration() || 0;
          setCurrentTime(time);
          setDuration(dur);

          if (onTimeUpdate && dur > 0) {
            onTimeUpdate(playerNumber, time, dur);
          }
        } catch {
          // Player might be in an invalid state (iframe destroyed)
        }
      }
    }, 500);
  }, [onTimeUpdate, playerNumber, stopTimeTracking]);

  // Load video using YouTube API (internal function)
  const loadVideoInternal = useCallback((videoId, shouldAutoPlay) => {
    if (!playerRef.current || !videoId) return;

    // Don't reload if already loaded
    if (loadedVideoIdRef.current === videoId) return;

    loadedVideoIdRef.current = videoId;
    setCurrentTime(0);
    setDuration(0);

    try {
      if (shouldAutoPlay) {
        playerRef.current.loadVideoById(videoId);
      } else {
        playerRef.current.cueVideoById(videoId);
      }
    } catch {
      // Player might be in an invalid state
    }
  }, []);

  // Expose control methods to parent
  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current) {
        try {
          playerRef.current.playVideo();
        } catch {
          // Player might be in an invalid state
        }
      }
    },
    pause: () => {
      console.log(`[Player ${playerNumber}] pause() called, playerRef:`, playerRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.pauseVideo();
        } catch {
          // Player might be in an invalid state
        }
      }
    },
    seekTo: (time, allowSeekAhead = true) => {
      if (playerRef.current && typeof playerRef.current.seekTo === 'function') {
        try {
          playerRef.current.seekTo(time, allowSeekAhead);
        } catch {
          // Player might be in an invalid state
        }
      }
    },
    destroy: () => {
      console.log(`[Player ${playerNumber}] destroy() called`);
      stopTimeTracking();
      if (playerRef.current) {
        try {
          playerRef.current.pauseVideo();
          playerRef.current.destroy();
        } catch (e) {
          console.log(`[Player ${playerNumber}] destroy error:`, e);
        }
        playerRef.current = null;
      }
      setIsPlayerReady(false);
      setIsPlaying(false);
      loadedVideoIdRef.current = null;
    },
    loadVideo: (videoId, shouldAutoPlay = true) => {
      loadVideoInternal(videoId, shouldAutoPlay);
    },
    isPlaying: () => isPlaying,
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    getRemainingTime: () => Math.max(0, duration - currentTime),
    isReady: () => isPlayerReady,
  }), [isPlaying, currentTime, duration, isPlayerReady, loadVideoInternal, playerNumber, stopTimeTracking]);

  // Track if volume needs to be applied when player becomes ready
  const pendingVolumeRef = useRef(volume);

  useEffect(() => {
    pendingVolumeRef.current = volume;
    if (playerRef.current) {
      try {
        playerRef.current.setVolume(volume);
      } catch {
        // Player might be in an invalid state during video change
      }
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      stopTimeTracking();
    };
  }, [stopTimeTracking]);

  // Handle video prop changes - load via API if player is ready
  useEffect(() => {
    const newVideoId = video?.youtube_id;

    // Set initial video ID on first video (for YouTube component mount)
    if (newVideoId && !initialVideoId) {
      setInitialVideoId(newVideoId);
      loadedVideoIdRef.current = newVideoId;
    }

    // If player is ready and video changed, load via API
    if (isPlayerReady && newVideoId && newVideoId !== loadedVideoIdRef.current) {
      loadVideoInternal(newVideoId, autoStart);
    }

    // If player is ready, same video is already loaded, autoStart is true, but not playing - play it
    // This handles the case where a restored video is clicked to play explicitly
    if (isPlayerReady && newVideoId && newVideoId === loadedVideoIdRef.current && autoStart && !isPlaying && playerRef.current) {
      try {
        playerRef.current.playVideo();
      } catch {
        // Player might be in an invalid state
      }
    }

    // If video was removed, reset state
    if (!newVideoId) {
      loadedVideoIdRef.current = null;
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);
      stopTimeTracking();
    }
  }, [video?.youtube_id, isPlayerReady, autoStart, loadVideoInternal, stopTimeTracking, initialVideoId, isPlaying]);

  // Stable opts - never changes after mount (autoplay disabled, we control via API)
  const opts = useMemo(() => ({
    width: '100%',
    height: '100%',
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 0, // Never autoplay on mount - we control playback via API
      controls: 1,
      modestbranding: 1,
      rel: 0,
      fs: 0, // Disable YouTube fullscreen button - we have our own
      enablejsapi: 1,
      playsinline: 1,
      origin: window.location.origin,
    },
  }), []);

  const onReady = useCallback((event) => {
    playerRef.current = event.target;
    setIsPlayerReady(true);
    startTimeTracking();

    try {
      // Use the ref to ensure we get the latest volume value
      event.target.setVolume(pendingVolumeRef.current);

      // Only auto-start on initial load if autoStart is true
      if (autoStartRef.current) {
        event.target.playVideo();
      }
    } catch {
      // Player might be in an invalid state
    }
  }, [startTimeTracking]);

  const onStateChange = useCallback((event) => {
    // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
    if (event.data === 1) {
      setIsPlaying(true);
      startTimeTracking();
      // Ensure volume is correct when playback starts
      if (playerRef.current) {
        try {
          playerRef.current.setVolume(pendingVolumeRef.current);
        } catch {
          // Player may be in an invalid state
        }
      }
      onStateUpdate?.(playerNumber, 'playing', { currentTime, duration });
    } else if (event.data === 0) {
      setIsPlaying(false);
      stopTimeTracking();
      onStateUpdate?.(playerNumber, 'ended', { currentTime, duration });
      if (onEnded) {
        onEnded(playerNumber);
      }
    } else if (event.data === 2) {
      setIsPlaying(false);
      stopTimeTracking();
      onStateUpdate?.(playerNumber, 'paused', { currentTime, duration });
    }
  }, [playerNumber, currentTime, duration, onStateUpdate, onEnded, startTimeTracking, stopTimeTracking]);

  const handleError = useCallback((event) => {
    setIsPlaying(false);
    stopTimeTracking();
    onError?.(playerNumber, event?.data, video);
  }, [onError, playerNumber, stopTimeTracking, video]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const borderColor = playerNumber === 1 ? 'border-purple-500' : 'border-pink-500';
  const glowColor = playerNumber === 1 ? 'shadow-purple-500/30' : 'shadow-pink-500/30';

  // Use initial video ID for YouTube component (stable, never changes)
  const stableVideoId = initialVideoId || video?.youtube_id;

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 max-w-full ${
        hideOverlays
          ? ''
          : `rounded-xl border-2 ${borderColor} ${isActive ? `shadow-lg ${glowColor}` : ''}`
      } ${isDragOver ? 'ring-4 ring-green-500 scale-[1.02]' : ''}`}
      style={{ contain: 'layout' }}
    >
      {/* Drop overlay - only rendered when dragging */}
      {showDropOverlay && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ pointerEvents: 'auto' }}
          className={`absolute inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-200 ${
            isDragOver
              ? 'bg-gradient-to-br from-green-500/70 to-emerald-600/70'
              : playerNumber === 1
                ? 'bg-gradient-to-br from-purple-500/50 to-purple-700/50'
                : 'bg-gradient-to-br from-pink-500/50 to-pink-700/50'
          }`}
        >
          <div className={`pointer-events-none transition-transform duration-200 ${isDragOver ? 'scale-110' : ''}`}>
            <svg className="w-12 h-12 mx-auto mb-2 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isDragOver ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              )}
            </svg>
            <p className="text-white font-semibold text-lg">
              {isDragOver ? 'Release to queue' : 'Queue to playlist'}
            </p>
          </div>
        </div>
      )}

      {!hideOverlays && video && duration > 0 && (
        <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-black/70 rounded text-xs text-white font-mono pointer-events-none">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}

      <div className="aspect-video bg-black/50 relative overflow-hidden">
        {video ? (
          <div className={`absolute inset-0 overflow-hidden ${showDropOverlay ? 'pointer-events-none' : ''}`}>
            <YouTube
              videoId={stableVideoId}
              opts={opts}
              onReady={onReady}
              onStateChange={onStateChange}
              onError={handleError}
              className="w-full h-full"
              iframeClassName="w-full h-full absolute inset-0"
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-purple-300">
            <div className="text-center">
              <div className="text-4xl mb-2">🎵</div>
              <p>Drag a video here or select from library</p>
            </div>
          </div>
        )}
      </div>

      {/* Video title */}
      {!hideOverlays && video && (
        <div className="px-3 py-2 bg-black/80 rounded-b-xl">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium text-sm truncate flex-1">{video.title}</p>
            {onAddToPlaylist && (
              <button
                onClick={() => !isInPlaylist && onAddToPlaylist(video.id)}
                disabled={isInPlaylist}
                className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${
                  isInPlaylist
                    ? 'bg-white/10 text-white/30 cursor-not-allowed'
                    : 'bg-white/10 hover:bg-green-600 text-white'
                }`}
                title={isInPlaylist ? 'Already in playlist' : 'Add to playlist'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isInPlaylist ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  )}
                </svg>
              </button>
            )}
          </div>
          {duration > 0 && (
            <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

// Memoize to prevent re-renders - video changes are handled via API, not re-renders
const MemoizedVideoPlayer = memo(VideoPlayer, (prevProps, nextProps) => {
  // Don't re-render for video changes - handled internally via YouTube API
  // Only re-render for UI-affecting props
  return (
    prevProps.video?.id === nextProps.video?.id && // For UI (title, etc)
    prevProps.video?.title === nextProps.video?.title &&
    prevProps.volume === nextProps.volume &&
    prevProps.playerNumber === nextProps.playerNumber &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isInPlaylist === nextProps.isInPlaylist &&
    prevProps.showDropOverlay === nextProps.showDropOverlay &&
    prevProps.hideOverlays === nextProps.hideOverlays
  );
});

export default MemoizedVideoPlayer;
