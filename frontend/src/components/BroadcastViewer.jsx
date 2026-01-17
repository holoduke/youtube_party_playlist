import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { getBroadcastState } from '../services/api';

export default function BroadcastViewer() {
  const { hash } = useParams();
  const [playlistName, setPlaylistName] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [isEnded, setIsEnded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const [startedAt, setStartedAt] = useState(null);

  const playerRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const currentVideoIdRef = useRef(null);
  const isPlayingRef = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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

        const serverVideo = serverState.current_video;
        const serverIsPlaying = serverState.is_playing ?? false;

        // Update video if changed - with fade effect
        if (serverVideo && serverVideo.youtube_id !== currentVideoIdRef.current) {
          // Fade out, change video, fade in
          setIsFading(true);
          setTimeout(() => {
            setCurrentVideo(serverVideo);
            currentVideoIdRef.current = serverVideo.youtube_id;
            setTimeout(() => setIsFading(false), 100);
          }, 300);
        }

        // Update playing state if changed
        if (serverIsPlaying !== isPlayingRef.current) {
          setIsPlaying(serverIsPlaying);
        }

        // Update started_at
        const serverStartedAt = serverState.started_at;
        setStartedAt(serverStartedAt);

        // Calculate elapsed time since video started
        const elapsedSeconds = serverStartedAt ? Math.floor((Date.now() - serverStartedAt) / 1000) : 0;

        // Update debug info
        setDebugInfo({
          serverIsPlaying,
          localIsPlaying: isPlayingRef.current,
          currentVideo: serverVideo?.title || 'none',
          currentVideoId: serverVideo?.youtube_id || 'none',
          nextVideo: serverState.next_video?.title || 'none',
          crossfade: serverState.crossfade_value,
          playerReady: !!playerRef.current,
          startedAt: serverStartedAt ? new Date(serverStartedAt).toLocaleTimeString() : 'none',
          elapsedSeconds,
          lastUpdate: new Date().toLocaleTimeString(),
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

  // Unified playback control - handles play/pause and video changes
  useEffect(() => {
    if (!playerRef.current) return;

    if (isPlaying) {
      // Small delay to let YouTube load if video just changed
      const timer = setTimeout(() => {
        try {
          if (playerRef.current) {
            // Seek to correct position based on when video started
            if (startedAt) {
              const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
              if (elapsedSeconds > 2) {
                playerRef.current.seekTo(elapsedSeconds, true);
              }
            }
            playerRef.current.playVideo();
          }
        } catch (e) {
          // Player not ready
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      try {
        playerRef.current.pauseVideo();
      } catch (e) {
        // Player not ready
      }
    }
  }, [isPlaying, currentVideo, startedAt]);

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
      playsinline: 1,
      mute: 0,
    },
  };

  const onReady = (event) => {
    playerRef.current = event.target;
    playerRef.current.setVolume(100);

    // Seek to correct position based on when video started
    if (startedAt && isPlayingRef.current) {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      if (elapsedSeconds > 2) {
        playerRef.current.seekTo(elapsedSeconds, true);
      }
      playerRef.current.playVideo();
    }
  };

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
      {/* Simple header */}
      <div className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          <span className="text-white font-medium">{playlistName}</span>
        </div>
      </div>

      {/* Video player - fullscreen with fade transition */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{ opacity: isFading ? 0 : 1 }}
      >
        {currentVideo ? (
          <YouTube
            videoId={currentVideo.youtube_id}
            opts={opts}
            onReady={onReady}
            className="w-full h-full"
            iframeClassName="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-white/30">Waiting for video...</span>
          </div>
        )}
      </div>

      {/* Debug panel */}
      <div className="absolute bottom-0 left-0 right-0 z-50 bg-black/80 text-white text-xs font-mono p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-w-2xl">
          <div>Server isPlaying: <span className={debugInfo.serverIsPlaying ? 'text-green-400' : 'text-red-400'}>{String(debugInfo.serverIsPlaying)}</span></div>
          <div>Local isPlaying: <span className={debugInfo.localIsPlaying ? 'text-green-400' : 'text-red-400'}>{String(debugInfo.localIsPlaying)}</span></div>
          <div>Player Ready: <span className={debugInfo.playerReady ? 'text-green-400' : 'text-red-400'}>{String(debugInfo.playerReady)}</span></div>
          <div>Crossfade: {debugInfo.crossfade}</div>
          <div>Started At: {debugInfo.startedAt}</div>
          <div>Elapsed: {debugInfo.elapsedSeconds}s</div>
          <div className="col-span-2">Current: {debugInfo.currentVideo}</div>
          <div className="col-span-2">Next: {debugInfo.nextVideo}</div>
          <div className="col-span-2 text-white/50">Last update: {debugInfo.lastUpdate}</div>
          <div className="col-span-2 mt-2">
            <button
              onClick={() => {
                if (playerRef.current) {
                  console.log('Manual play clicked, calling playVideo()');
                  playerRef.current.playVideo();
                } else {
                  console.log('Player ref is null');
                }
              }}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded mr-2"
            >
              Force Play
            </button>
            <button
              onClick={() => {
                if (playerRef.current) {
                  const state = playerRef.current.getPlayerState();
                  console.log('Player state:', state, '(-1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued)');
                  alert(`Player state: ${state} (-1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued)`);
                }
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded"
            >
              Check State
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
