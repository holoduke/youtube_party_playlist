import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import YouTube from 'react-youtube';
import { getPlaylist, getPlaylistByHash } from '../services/api';

export default function PublicPlaylistPage() {
  const { playlistId: routePlaylistId } = useParams();
  const [searchParams] = useSearchParams();
  // Support both ?pl= query param (new hash format) and /playlist/:id route param (legacy numeric)
  const plHash = searchParams.get('pl');
  // Use hash param if present, otherwise fall back to legacy route param
  const playlistId = plHash || routePlaylistId;
  const isHashLookup = !!plHash;

  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!playlistId) {
      setError('No playlist specified');
      setLoading(false);
      return;
    }

    const loadPlaylist = async () => {
      try {
        // Use hash lookup for ?pl= param, numeric lookup for legacy /playlist/:id route
        const data = isHashLookup
          ? await getPlaylistByHash(playlistId)
          : await getPlaylist(playlistId);
        if (!data.is_public) {
          setError('This playlist is private');
          setLoading(false);
          return;
        }
        setPlaylist(data);
        if (data.videos && data.videos.length > 0) {
          setCurrentVideo(data.videos[0]);
          setCurrentIndex(0);
        }
        setLoading(false);
      } catch {
        setError('Playlist not found');
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [playlistId, isHashLookup]);

  const handleVideoSelect = (video, index) => {
    setCurrentVideo(video);
    setCurrentIndex(index);
  };

  const handleVideoEnd = () => {
    // Auto-play next video
    if (playlist?.videos && currentIndex < playlist.videos.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentVideo(playlist.videos[nextIndex]);
      setCurrentIndex(nextIndex);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentVideo(playlist.videos[prevIndex]);
      setCurrentIndex(prevIndex);
    }
  };

  const handleNext = () => {
    if (playlist?.videos && currentIndex < playlist.videos.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentVideo(playlist.videos[nextIndex]);
      setCurrentIndex(nextIndex);
    }
  };

  const opts = {
    width: '100%',
    height: '100%',
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      controls: 1,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      playsinline: 1,
    },
  };

  const onReady = (event) => {
    playerRef.current = event.target;
  };

  const onStateChange = (event) => {
    // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2
    if (event.data === 0) {
      handleVideoEnd();
    } else if (event.data === 1) {
      setIsPlaying(true);
    } else if (event.data === 2) {
      setIsPlaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
        <div className="text-center">
          <div className="text-6xl mb-4">:(</div>
          <h1 className="text-2xl text-white mb-2">{error}</h1>
          <a href="/" className="text-purple-400 hover:text-purple-300">Go back home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                {playlist?.name || 'Playlist'}
              </h1>
              <p className="text-purple-300/60 text-sm">
                {playlist?.videos?.length || 0} videos
                {playlist?.user?.name && ` • by ${playlist.user.name}`}
              </p>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              Back to Barmania
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Player Section */}
          <div className="lg:col-span-2">
            {/* Video Player */}
            <div className="aspect-video rounded-2xl overflow-hidden bg-black mb-4">
              {currentVideo ? (
                <YouTube
                  videoId={currentVideo.youtube_id}
                  opts={opts}
                  onReady={onReady}
                  onStateChange={onStateChange}
                  className="w-full h-full"
                  iframeClassName="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-purple-400/50">Select a video to play</span>
                </div>
              )}
            </div>

            {/* Now Playing Info & Controls */}
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-4">
                {/* Previous */}
                <button
                  onClick={handlePrevious}
                  disabled={currentIndex === 0}
                  className={`p-2 rounded-lg transition-colors ${
                    currentIndex === 0
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Current Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">
                    {currentVideo?.title || 'No track selected'}
                  </p>
                  <p className="text-purple-300/60 text-sm">
                    {currentIndex + 1} / {playlist?.videos?.length || 0}
                  </p>
                </div>

                {/* Next */}
                <button
                  onClick={handleNext}
                  disabled={!playlist?.videos || currentIndex >= playlist.videos.length - 1}
                  className={`p-2 rounded-lg transition-colors ${
                    !playlist?.videos || currentIndex >= playlist.videos.length - 1
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Playlist Section */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4 sticky top-24">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Playlist
              </h2>

              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {playlist?.videos?.map((video, index) => (
                  <div
                    key={video.id}
                    onClick={() => handleVideoSelect(video, index)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                      currentIndex === index
                        ? 'bg-purple-500/30 border border-purple-500/50'
                        : 'bg-white/5 hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <span className={`text-xs w-6 text-center ${
                      currentIndex === index ? 'text-purple-300' : 'text-purple-300/50'
                    }`}>
                      {currentIndex === index && isPlaying ? (
                        <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <img
                      src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/default.jpg`}
                      alt=""
                      className="w-16 h-10 object-cover rounded flex-shrink-0"
                    />
                    <span className={`flex-1 text-sm truncate ${
                      currentIndex === index ? 'text-white font-medium' : 'text-white/80'
                    }`}>
                      {video.title}
                    </span>
                  </div>
                ))}

                {(!playlist?.videos || playlist.videos.length === 0) && (
                  <p className="text-purple-300/60 text-sm text-center py-4">
                    No videos in this playlist
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
