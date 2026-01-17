import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import YouTube from 'react-youtube';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import {
  joinLivePlaylist,
  joinLivePlaylistAsHost,
  syncPlaylistState,
  queueSongToPlaylist,
  likeVideoInPlaylist,
  approveQueueItem,
  getVideos,
  searchYouTube,
  importYouTubeVideo,
} from '../services/api';

export default function LivePlaylistPage() {
  const { shareCode } = useParams();
  const [searchParams] = useSearchParams();
  const hostCode = searchParams.get('host');

  const [playlist, setPlaylist] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Player state
  const [player1Video, setPlayer1Video] = useState(null);
  const [player2Video, setPlayer2Video] = useState(null);
  const [crossfadeValue, setCrossfadeValue] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Queue and likes
  const [queue, setQueue] = useState([]);
  const [likes, setLikes] = useState({});

  // Video browser for guests
  const [videos, setVideos] = useState([]);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserTab, setBrowserTab] = useState('library'); // 'library' or 'youtube'
  const [youtubeSearch, setYoutubeSearch] = useState('');
  const [youtubeResults, setYoutubeResults] = useState([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [queueingVideo, setQueueingVideo] = useState(null);

  const player1Ref = useRef(null);
  const player2Ref = useRef(null);
  const echoRef = useRef(null);

  // Initialize playlist and WebSocket connection
  useEffect(() => {
    const init = async () => {
      try {
        let data;
        if (hostCode) {
          data = await joinLivePlaylistAsHost(hostCode);
          setIsHost(true);
        } else {
          data = await joinLivePlaylist(shareCode);
        }

        setPlaylist(data.playlist);

        // Set initial state
        if (data.playlist.state) {
          setPlayer1Video(data.playlist.state.player1Video);
          setPlayer2Video(data.playlist.state.player2Video);
          setCrossfadeValue(data.playlist.state.crossfadeValue || 0);
          setIsPlaying(data.playlist.state.isPlaying || false);
        }

        setQueue(data.playlist.queue || []);
        setLikes(data.playlist.likes || {});

        // Load videos for guest browsing
        const videosData = await getVideos();
        setVideos(videosData);

        // Setup WebSocket
        setupWebSocket(data.playlist.share_code);

        setLoading(false);
      } catch (err) {
        setError('Playlist not found or session has ended');
        setLoading(false);
      }
    };

    init();

    return () => {
      if (echoRef.current) {
        echoRef.current.disconnect();
      }
    };
  }, [shareCode, hostCode]);

  const setupWebSocket = (playlistShareCode) => {
    const REVERB_KEY = import.meta.env.VITE_REVERB_APP_KEY || 'barmania-key';
    const REVERB_HOST = import.meta.env.VITE_REVERB_HOST || window.location.hostname;
    const REVERB_PORT = import.meta.env.VITE_REVERB_PORT || 8080;

    window.Pusher = Pusher;

    echoRef.current = new Echo({
      broadcaster: 'reverb',
      key: REVERB_KEY,
      wsHost: REVERB_HOST,
      wsPort: REVERB_PORT,
      forceTLS: false,
      enabledTransports: ['ws', 'wss'],
    });

    echoRef.current.channel(`playlist.${playlistShareCode}`).listen('PlaylistStateChanged', (data) => {
      if (data.type === 'state' && !isHost) {
        // Guests receive state updates
        if (data.state.player1Video !== undefined) setPlayer1Video(data.state.player1Video);
        if (data.state.player2Video !== undefined) setPlayer2Video(data.state.player2Video);
        if (data.state.crossfadeValue !== undefined) setCrossfadeValue(data.state.crossfadeValue);
        if (data.state.isPlaying !== undefined) setIsPlaying(data.state.isPlaying);
      } else if (data.type === 'queue') {
        setQueue(data.queue || []);
      } else if (data.type === 'likes') {
        setLikes(data.likes || {});
      } else if (data.type === 'ended') {
        setError('Live session has ended');
      }
    });
  };

  // Host: Sync state to all participants
  const broadcastState = useCallback(async (state) => {
    if (!isHost || !hostCode) return;

    try {
      await syncPlaylistState(hostCode, state);
    } catch (err) {
      console.error('Failed to sync state:', err);
    }
  }, [isHost, hostCode]);

  // Host: Update crossfade
  const handleCrossfadeChange = (value) => {
    setCrossfadeValue(value);
    if (isHost) {
      broadcastState({ crossfadeValue: value });
    }
  };

  // Guest: Request a song from library
  const handleQueueSong = async (videoId) => {
    setQueueingVideo(videoId);
    try {
      await queueSongToPlaylist(playlist.share_code, videoId);
      setShowBrowser(false);
      resetBrowserState();
    } catch (err) {
      console.error('Failed to queue song:', err);
    }
    setQueueingVideo(null);
  };

  // Guest: Search YouTube
  const handleYoutubeSearch = async (e) => {
    e.preventDefault();
    if (!youtubeSearch.trim()) return;

    setYoutubeLoading(true);
    try {
      const results = await searchYouTube(youtubeSearch);
      setYoutubeResults(results);
    } catch (err) {
      console.error('Failed to search YouTube:', err);
    }
    setYoutubeLoading(false);
  };

  // Guest: Request a YouTube video (import then queue)
  const handleQueueYoutubeVideo = async (video) => {
    setQueueingVideo(video.youtube_id);
    try {
      // Import the video first
      const imported = await importYouTubeVideo(video);
      // Then queue it
      await queueSongToPlaylist(playlist.share_code, imported.id);
      setShowBrowser(false);
      resetBrowserState();
    } catch (err) {
      console.error('Failed to queue YouTube video:', err);
    }
    setQueueingVideo(null);
  };

  // Reset browser state when closing
  const resetBrowserState = () => {
    setBrowserTab('library');
    setYoutubeSearch('');
    setYoutubeResults([]);
  };

  // Guest: Like current video
  const handleLike = async (videoId) => {
    try {
      await likeVideoInPlaylist(playlist.share_code, videoId);
    } catch (err) {
      console.error('Failed to like:', err);
    }
  };

  // Host: Approve from queue
  const handleApprove = async (index) => {
    try {
      const result = await approveQueueItem(hostCode, index);
      // Play the approved song
      if (result.approved) {
        // Add to next available player
        if (!player1Video) {
          setPlayer1Video(result.approved);
        } else {
          setPlayer2Video(result.approved);
        }
        broadcastState({
          player1Video: player1Video || result.approved,
          player2Video: player1Video ? result.approved : player2Video,
        });
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  // Host: Play video from playlist
  const handlePlayFromPlaylist = (video, playerNumber) => {
    if (!isHost) return;

    if (playerNumber === 1) {
      setPlayer1Video(video);
      broadcastState({ player1Video: video });
    } else {
      setPlayer2Video(video);
      broadcastState({ player2Video: video });
    }
  };

  const opts = {
    width: '100%',
    height: '100%',
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      controls: isHost ? 1 : 0,
      modestbranding: 1,
      rel: 0,
      enablejsapi: 1,
      playsinline: 1,
    },
  };

  const onPlayer1Ready = (event) => {
    player1Ref.current = event.target;
    player1Ref.current.setVolume(100 - crossfadeValue);
  };

  const onPlayer2Ready = (event) => {
    player2Ref.current = event.target;
    player2Ref.current.setVolume(crossfadeValue);
  };

  useEffect(() => {
    if (player1Ref.current) player1Ref.current.setVolume(100 - crossfadeValue);
    if (player2Ref.current) player2Ref.current.setVolume(crossfadeValue);
  }, [crossfadeValue]);

  // Calculate opacity for crossfade
  const player1Opacity = crossfadeValue <= 50 ? 1 : 1 - (crossfadeValue - 50) / 50;
  const player2Opacity = crossfadeValue >= 50 ? 1 : crossfadeValue / 50;

  const getShareUrl = () => {
    return `${window.location.origin}/live/${playlist?.share_code}`;
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
                {playlist?.name || 'Live Session'}
              </h1>
              <p className="text-purple-300/60 text-sm">
                {isHost ? 'You are the DJ' : 'Guest'} | Code: {playlist?.share_code}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {isHost && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-300 rounded-lg text-sm border border-green-500/30">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  DJ Mode
                </div>
              )}
              <a
                href="/"
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
              >
                Exit
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Video Players */}
        <div className="relative aspect-video max-w-4xl mx-auto mb-6 rounded-2xl overflow-hidden bg-black">
          {/* Player 1 */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
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
              <div className="w-full h-full flex items-center justify-center bg-purple-900/20">
                <span className="text-purple-400/50">Player 1</span>
              </div>
            )}
          </div>

          {/* Player 2 */}
          <div
            className="absolute inset-0 transition-opacity duration-300"
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
              <div className="w-full h-full flex items-center justify-center bg-pink-900/20">
                <span className="text-pink-400/50">Player 2</span>
              </div>
            )}
          </div>

          {/* Now playing overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white font-medium truncate">
              {crossfadeValue < 50 ? player1Video?.title : player2Video?.title || 'No track playing'}
            </p>
          </div>
        </div>

        {/* Crossfader (Host only) */}
        {isHost && (
          <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-4">
                <span className="text-purple-400 text-sm w-20">Player 1</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={crossfadeValue}
                  onChange={(e) => handleCrossfadeChange(Number(e.target.value))}
                  className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-purple-500"
                />
                <span className="text-pink-400 text-sm w-20 text-right">Player 2</span>
              </div>
            </div>
          </div>
        )}

        {/* Like buttons for guests */}
        {!isHost && (player1Video || player2Video) && (
          <div className="max-w-4xl mx-auto mb-6 flex justify-center gap-4">
            <button
              onClick={() => player1Video && handleLike(player1Video.id)}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 rounded-xl transition-colors border border-purple-500/30"
              disabled={!player1Video}
            >
              <span className="text-2xl">+1</span>
              <span>Like P1 ({likes[player1Video?.id] || 0})</span>
            </button>
            <button
              onClick={() => player2Video && handleLike(player2Video.id)}
              className="flex items-center gap-2 px-6 py-3 bg-pink-600/20 hover:bg-pink-600/40 text-pink-300 rounded-xl transition-colors border border-pink-500/30"
              disabled={!player2Video}
            >
              <span className="text-2xl">+1</span>
              <span>Like P2 ({likes[player2Video?.id] || 0})</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {/* Queue */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              Song Requests
              <span className="text-purple-400 text-sm">({queue.length})</span>
            </h2>

            {queue.length === 0 ? (
              <p className="text-purple-300/60 text-sm">No requests yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {queue.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-white/5 rounded-lg"
                  >
                    <img
                      src={item.thumbnail_url}
                      alt=""
                      className="w-12 h-8 object-cover rounded"
                    />
                    <span className="flex-1 text-white text-sm truncate">{item.title}</span>
                    {isHost && (
                      <button
                        onClick={() => handleApprove(index)}
                        className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded hover:bg-green-500/30"
                      >
                        Play
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Guest: Request song button */}
            {!isHost && (
              <button
                onClick={() => setShowBrowser(!showBrowser)}
                className="mt-4 w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg transition-colors border border-purple-500/30"
              >
                + Request a Song
              </button>
            )}
          </div>

          {/* Playlist (Host can control) */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">
              {playlist?.name || 'Playlist'}
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {playlist?.videos?.map((video, index) => (
                <div
                  key={video.id}
                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                    video.id === player1Video?.id || video.id === player2Video?.id
                      ? 'bg-purple-500/20 border border-purple-500/30'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => isHost && handlePlayFromPlaylist(video, index % 2 === 0 ? 1 : 2)}
                >
                  <span className="text-purple-300/60 text-xs w-6">{index + 1}</span>
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="w-12 h-8 object-cover rounded"
                  />
                  <span className="flex-1 text-white text-sm truncate">{video.title}</span>
                  {likes[video.id] > 0 && (
                    <span className="text-pink-400 text-xs">+{likes[video.id]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Share / QR Code */}
          <div className="bg-white/5 backdrop-blur rounded-2xl border border-white/10 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Invite Friends</h2>
            <div className="text-center">
              <div className="bg-white p-3 rounded-xl inline-block mb-4">
                <QRCodeSVG value={getShareUrl()} size={150} level="H" />
              </div>
              <p className="text-purple-300/60 text-sm mb-2">Scan to join</p>
              <div className="bg-black/30 rounded-lg p-3">
                <p className="text-white font-mono text-lg tracking-widest">{playlist?.share_code}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(getShareUrl())}
                className="mt-3 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 rounded-lg text-sm transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>

        {/* Video Browser Modal for Guests */}
        {showBrowser && !isHost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70" onClick={() => { setShowBrowser(false); resetBrowserState(); }} />
            <div className="relative bg-gray-900 rounded-2xl border border-white/10 p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Request a Song</h2>
                <button
                  onClick={() => { setShowBrowser(false); resetBrowserState(); }}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setBrowserTab('library')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    browserTab === 'library'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-purple-300 hover:bg-white/20'
                  }`}
                >
                  Library
                </button>
                <button
                  onClick={() => setBrowserTab('youtube')}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    browserTab === 'youtube'
                      ? 'bg-red-600 text-white'
                      : 'bg-white/10 text-red-300 hover:bg-white/20'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  YouTube
                </button>
              </div>

              {/* Library Tab */}
              {browserTab === 'library' && (
                <div className="overflow-y-auto flex-1 grid grid-cols-2 gap-3">
                  {videos.slice(0, 50).map((video) => (
                    <div
                      key={video.id}
                      onClick={() => queueingVideo !== video.id && handleQueueSong(video.id)}
                      className={`flex items-center gap-3 p-2 bg-white/5 hover:bg-purple-500/20 rounded-lg cursor-pointer transition-colors ${
                        queueingVideo === video.id ? 'opacity-50 pointer-events-none' : ''
                      }`}
                    >
                      <img
                        src={video.thumbnail_url}
                        alt=""
                        className="w-16 h-10 object-cover rounded flex-shrink-0"
                      />
                      <span className="flex-1 text-white text-sm truncate">{video.title}</span>
                      {queueingVideo === video.id && (
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* YouTube Tab */}
              {browserTab === 'youtube' && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Search Form */}
                  <form onSubmit={handleYoutubeSearch} className="mb-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={youtubeSearch}
                        onChange={(e) => setYoutubeSearch(e.target.value)}
                        placeholder="Search YouTube..."
                        className="flex-1 px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-red-500"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={youtubeLoading}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        {youtubeLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        )}
                        Search
                      </button>
                    </div>
                  </form>

                  {/* YouTube Results */}
                  <div className="overflow-y-auto flex-1">
                    {youtubeResults.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        <p>Search for songs on YouTube</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {youtubeResults.map((video) => (
                          <div
                            key={video.youtube_id}
                            onClick={() => queueingVideo !== video.youtube_id && handleQueueYoutubeVideo(video)}
                            className={`flex items-center gap-3 p-3 bg-white/5 hover:bg-red-500/20 rounded-lg cursor-pointer transition-colors ${
                              queueingVideo === video.youtube_id ? 'opacity-50 pointer-events-none' : ''
                            }`}
                          >
                            <img
                              src={video.thumbnail_url}
                              alt=""
                              className="w-24 h-14 object-cover rounded flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{video.title}</p>
                              <p className="text-gray-400 text-xs">Click to request</p>
                            </div>
                            {queueingVideo === video.youtube_id ? (
                              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
