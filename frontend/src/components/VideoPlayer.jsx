import YouTube from 'react-youtube';
import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import WaveVisualizer from './WaveVisualizer';

const VideoPlayer = forwardRef(({ video, volume, playerNumber, isActive, onTimeUpdate, onEnded, frequencyData, onStateUpdate, autoStart = true }, ref) => {
  const playerRef = useRef(null);
  const intervalRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Expose control methods to parent
  useImperativeHandle(ref, () => ({
    play: () => {
      if (playerRef.current) {
        playerRef.current.playVideo();
      }
    },
    pause: () => {
      if (playerRef.current) {
        playerRef.current.pauseVideo();
      }
    },
    isPlaying: () => isPlaying,
    getCurrentTime: () => currentTime,
    getDuration: () => duration,
    getRemainingTime: () => Math.max(0, duration - currentTime),
  }));

  // Track if volume needs to be applied when player becomes ready
  const pendingVolumeRef = useRef(volume);
  pendingVolumeRef.current = volume;

  useEffect(() => {
    if (playerRef.current) {
      try {
        playerRef.current.setVolume(volume);
      } catch (e) {
        // Player might be in an invalid state during video change
      }
    }
  }, [volume]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Reset state and clear player ref when video changes
  useEffect(() => {
    // Clear the player ref since the YouTube component will create a new player
    playerRef.current = null;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [video?.youtube_id]);

  const startTimeTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      if (playerRef.current) {
        const time = playerRef.current.getCurrentTime() || 0;
        const dur = playerRef.current.getDuration() || 0;
        setCurrentTime(time);
        setDuration(dur);

        if (onTimeUpdate && dur > 0) {
          onTimeUpdate(playerNumber, time, dur);
        }
      }
    }, 500);
  };

  const opts = {
    width: '100%',
    height: '100%',
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: autoStart ? 1 : 0,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      playsinline: 1,
      origin: window.location.origin,
    },
  };

  const onReady = (event) => {
    playerRef.current = event.target;
    // Use the ref to ensure we get the latest volume value
    event.target.setVolume(pendingVolumeRef.current);
    startTimeTracking();
  };

  const onStateChange = (event) => {
    // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
    if (event.data === 1) {
      setIsPlaying(true);
      startTimeTracking();
      // Ensure volume is correct when playback starts
      if (playerRef.current) {
        try {
          playerRef.current.setVolume(pendingVolumeRef.current);
        } catch (e) {}
      }
      onStateUpdate?.(playerNumber, 'playing', { currentTime, duration });
    } else if (event.data === 0) {
      setIsPlaying(false);
      onStateUpdate?.(playerNumber, 'ended', { currentTime, duration });
      if (onEnded) {
        onEnded(playerNumber);
      }
    } else if (event.data === 2) {
      setIsPlaying(false);
      onStateUpdate?.(playerNumber, 'paused', { currentTime, duration });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const borderColor = playerNumber === 1 ? 'border-purple-500' : 'border-pink-500';
  const glowColor = playerNumber === 1 ? 'shadow-purple-500/30' : 'shadow-pink-500/30';
  const labelBg = playerNumber === 1 ? 'bg-purple-600' : 'bg-pink-600';

  return (
    <div className={`relative rounded-xl overflow-hidden border-2 ${borderColor} ${isActive ? `shadow-lg ${glowColor}` : ''} transition-all duration-300`}>
      <div className={`absolute top-2 left-2 z-10 px-3 py-1 ${labelBg} rounded-full text-xs font-bold text-white flex items-center gap-1.5`}>
        <span>Player {playerNumber}</span>
        {isPlaying && (
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
        )}
      </div>

      {video && duration > 0 && (
        <div className="absolute top-2 right-2 z-10 px-2 py-1 bg-black/70 rounded text-xs text-white font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      )}

      <div className="aspect-video bg-black/50">
        {video ? (
          <YouTube
            videoId={video.youtube_id}
            opts={opts}
            onReady={onReady}
            onStateChange={onStateChange}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-purple-300">
            <div className="text-center">
              <div className="text-4xl mb-2">🎵</div>
              <p>Select a video to play</p>
            </div>
          </div>
        )}
      </div>

      {video && (
        <div className="absolute bottom-16 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
          <p className="text-white font-medium text-sm truncate">{video.title}</p>
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

      {/* Wave Visualizer */}
      <WaveVisualizer isActive={isPlaying && isActive} playerNumber={playerNumber} frequencyData={frequencyData} />
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
