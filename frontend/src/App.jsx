import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { getCategories, getVideos, getPlaylists, getPlaylist, addVideoToPlaylist, goLivePlaylist, searchYouTube, getYouTubeVideo, importYouTubeVideo, extractYouTubeVideoId } from './services/api';
import { initEcho, broadcastState } from './services/playerSync';
import { useUser } from './contexts/UserContext';
import CategoryFilter from './components/CategoryFilter';
import VideoList from './components/VideoList';
import VideoPlayer from './components/VideoPlayer';
import Crossfader from './components/Crossfader';
import UserSelector from './components/UserSelector';

function App() {
  const navigate = useNavigate();
  const { currentUser, logout } = useUser();
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [player1Video, setPlayer1Video] = useState(null);
  const [player2Video, setPlayer2Video] = useState(null);
  const [crossfadeValue, setCrossfadeValue] = useState(50);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  // Playlist mode state
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [playlistIndex, setPlaylistIndex] = useState(0);
  const [playlistMode, setPlaylistMode] = useState(false);

  // Selected playlist content state
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistContentCollapsed, setPlaylistContentCollapsed] = useState(false);

  // View mode: 'categories' or 'playlist'
  const [viewMode, setViewMode] = useState('categories');
  const [viewingPlaylist, setViewingPlaylist] = useState(null);

  // Remote sync state
  const [syncEnabled, setSyncEnabled] = useState(true);
  const playerStatesRef = useRef({ player1State: 'paused', player2State: 'paused' });
  const broadcastTimeoutRef = useRef(null);

  // Party mode modal state
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [partyPlaylistSearch, setPartyPlaylistSearch] = useState('');
  const [partySelectedPlaylist, setPartySelectedPlaylist] = useState(null);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partyLiveResult, setPartyLiveResult] = useState(null);
  const [partyLoading, setPartyLoading] = useState(false);

  // Header playlist selector state
  const [headerPlaylistSearch, setHeaderPlaylistSearch] = useState('');
  const [headerPlaylistDropdownOpen, setHeaderPlaylistDropdownOpen] = useState(false);
  const [playlistDropZoneActive, setPlaylistDropZoneActive] = useState(false);

  // YouTube search state
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [youtubeSearchLoading, setYoutubeSearchLoading] = useState(false);
  const [showYoutubeDropdown, setShowYoutubeDropdown] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState(null);
  const youtubeSearchTimeoutRef = useRef(null);

  // Get the remote URL for QR code
  const getRemoteUrl = () => {
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    return `${protocol}//${host}${port ? ':' + port : ''}/remote`;
  };

  // Get the live session URL
  const getLiveUrl = (shareCode) => {
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    return `${protocol}//${host}${port ? ':' + port : ''}/live/${shareCode}`;
  };

  // Handle Go Live from party modal
  const handlePartyGoLive = async () => {
    if (!partySelectedPlaylist) return;
    setPartyLoading(true);
    try {
      const result = await goLivePlaylist(partySelectedPlaylist.id);
      setPartyLiveResult(result);
    } catch (error) {
      console.error('Failed to go live:', error);
      showNotification('Failed to start live session', 'error');
    }
    setPartyLoading(false);
  };

  // Handle opening the live session as host
  const handleOpenAsHost = () => {
    if (partyLiveResult) {
      navigate(`/live/${partyLiveResult.share_code}?host=${partyLiveResult.host_code}`);
    }
  };

  // Reset party modal state
  const resetPartyModal = () => {
    setPartyPlaylistSearch('');
    setPartySelectedPlaylist(null);
    setPartyDropdownOpen(false);
    setPartyLiveResult(null);
    setPartyLoading(false);
  };

  // Close party modal
  const closePartyModal = () => {
    setShowPartyModal(false);
    resetPartyModal();
  };

  // Filter playlists for dropdown
  const filteredPartyPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(partyPlaylistSearch.toLowerCase())
  );

  // Filter playlists for header dropdown
  const filteredHeaderPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(headerPlaylistSearch.toLowerCase())
  );

  // Handle drop on playlist selector
  const handlePlaylistDrop = async (e) => {
    e.preventDefault();
    setPlaylistDropZoneActive(false);

    if (!selectedPlaylist) {
      showNotification('Select a playlist first', 'error');
      return;
    }

    try {
      const videoData = JSON.parse(e.dataTransfer.getData('application/json'));
      if (videoData && videoData.id) {
        await addVideoToPlaylist(selectedPlaylist.id, videoData.id);
        showNotification(`Added "${videoData.title}" to ${selectedPlaylist.name}`);
        // Refresh playlist
        const updated = await getPlaylist(selectedPlaylist.id);
        setSelectedPlaylist(updated);
        if (viewingPlaylist?.id === selectedPlaylist.id) {
          setViewingPlaylist(updated);
        }
        loadPlaylists();
      }
    } catch (error) {
      console.error('Failed to add video:', error);
      showNotification('Failed to add video', 'error');
    }
  };

  const handlePlaylistDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setPlaylistDropZoneActive(true);
  };

  const handlePlaylistDragLeave = () => {
    setPlaylistDropZoneActive(false);
  };

  // YouTube search handler with debounce and URL detection
  const handleYoutubeSearchInput = (value) => {
    setYoutubeSearchQuery(value);

    // Clear previous timeout
    if (youtubeSearchTimeoutRef.current) {
      clearTimeout(youtubeSearchTimeoutRef.current);
    }

    if (!value.trim()) {
      setYoutubeSearchResults([]);
      setShowYoutubeDropdown(false);
      setYoutubeSearchLoading(false);
      return;
    }

    // Debounce search - wait 300ms after typing stops
    setYoutubeSearchLoading(true);
    setShowYoutubeDropdown(true);
    youtubeSearchTimeoutRef.current = setTimeout(async () => {
      try {
        // Check if input is a YouTube URL
        const videoId = extractYouTubeVideoId(value);

        if (videoId) {
          // Fetch single video by ID
          const video = await getYouTubeVideo(videoId);
          setYoutubeSearchResults(video ? [video] : []);
        } else {
          // Regular search
          const results = await searchYouTube(value);
          setYoutubeSearchResults(results);
        }
      } catch (error) {
        console.error('YouTube search failed:', error);
        setYoutubeSearchResults([]);
      }
      setYoutubeSearchLoading(false);
    }, 300);
  };

  // Clear YouTube search
  const clearYoutubeSearch = () => {
    setYoutubeSearchQuery('');
    setYoutubeSearchResults([]);
    setShowYoutubeDropdown(false);
    if (youtubeSearchTimeoutRef.current) {
      clearTimeout(youtubeSearchTimeoutRef.current);
    }
  };

  // Play a YouTube search result (imports first if needed)
  const handlePlayYoutubeResult = async (video, playerNumber) => {
    setImportingVideoId(video.youtube_id);
    try {
      // Import the video first
      const imported = await importYouTubeVideo(video);
      // Then play it
      if (playerNumber === 1) {
        setPlayer1Video(imported);
      } else {
        setPlayer2Video(imported);
      }
      // Stop playlist mode when manually selecting
      setPlaylistMode(false);
      setActivePlaylist(null);
      // Close the dropdown and clear search
      clearYoutubeSearch();
      showNotification(`Playing "${video.title}" on Player ${playerNumber}`);
    } catch (error) {
      console.error('Failed to import video:', error);
      showNotification('Failed to play video', 'error');
    }
    setImportingVideoId(null);
  };

  useEffect(() => {
    loadCategories();
    loadVideos();
    // Initialize Echo for WebSocket connection
    initEcho();
  }, []);

  // Reload playlists when user changes
  useEffect(() => {
    if (currentUser) {
      loadPlaylists();
    } else {
      setPlaylists([]);
    }
  }, [currentUser]);

  // Broadcast player state changes to remote players (debounced for crossfader)
  useEffect(() => {
    if (!syncEnabled) return;

    // Clear any pending broadcast
    if (broadcastTimeoutRef.current) {
      clearTimeout(broadcastTimeoutRef.current);
    }

    // Debounce broadcasts (especially for crossfader dragging)
    broadcastTimeoutRef.current = setTimeout(() => {
      broadcastState({
        player1Video,
        player2Video,
        crossfadeValue,
        player1State: playerStatesRef.current.player1State,
        player2State: playerStatesRef.current.player2State,
      });
    }, 50);

    return () => {
      if (broadcastTimeoutRef.current) {
        clearTimeout(broadcastTimeoutRef.current);
      }
    };
  }, [player1Video, player2Video, crossfadeValue, syncEnabled]);

  useEffect(() => {
    if (viewMode === 'categories') {
      loadVideos(selectedCategory);
    }
  }, [selectedCategory, viewMode]);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const loadVideos = async (categoryId = null) => {
    setLoading(true);
    try {
      const data = await getVideos(categoryId);
      setVideos(data);
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylists = async () => {
    if (!currentUser) return;
    try {
      const data = await getPlaylists(currentUser.id);
      setPlaylists(data);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  };

  const handlePlayVideo = (video, playerNumber) => {
    // Stop playlist mode when manually selecting a video
    setPlaylistMode(false);
    setActivePlaylist(null);

    if (playerNumber === 1) {
      setPlayer1Video(video);
    } else {
      setPlayer2Video(video);
    }
  };

  const handlePlayVideoFromPlaylist = (video, index) => {
    // Odd indices (0, 2, 4...) go to Player 1, even indices (1, 3, 5...) go to Player 2
    const playerNumber = index % 2 === 0 ? 1 : 2;

    // Set the video on the appropriate player
    if (playerNumber === 1) {
      setPlayer1Video(video);
    } else {
      setPlayer2Video(video);
    }

    // If we have a selected playlist, activate playlist mode
    if (selectedPlaylist) {
      setActivePlaylist(selectedPlaylist);
      setPlaylistMode(true);
      setPlaylistIndex(index);

      // Also pre-load the next track on the other player if available
      const nextIndex = index + 1;
      if (nextIndex < selectedPlaylist.videos.length) {
        const nextVideo = selectedPlaylist.videos[nextIndex];
        if (playerNumber === 1) {
          setPlayer2Video(nextVideo);
        } else {
          setPlayer1Video(nextVideo);
        }
      }
    }
  };

  const handleAddToPlaylist = async (videoId, playlistId) => {
    try {
      await addVideoToPlaylist(playlistId, videoId);
      const playlist = playlists.find(p => p.id === playlistId);
      showNotification(`Added to "${playlist?.name}"`);
      // Refresh playlists and selected playlist content
      loadPlaylists();
      if (selectedPlaylist?.id === playlistId) {
        const updated = await getPlaylist(playlistId);
        setSelectedPlaylist(updated);
      }
    } catch (error) {
      console.error('Failed to add video to playlist:', error);
      showNotification('Failed to add video', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePlayPlaylist = useCallback(async (playlist) => {
    // Set as selected playlist to show content
    setSelectedPlaylist(playlist);
    setPlaylistContentCollapsed(false);

    // Switch to playlist view mode - show playlist videos in the main list
    setViewMode('playlist');
    setViewingPlaylist(playlist);

    if (!playlist.videos || playlist.videos.length === 0) return;

    setActivePlaylist(playlist);
    setPlaylistIndex(0);
    setPlaylistMode(true);

    // Start first video on player 1
    setPlayer1Video(playlist.videos[0]);
    // Queue second video on player 2 if available
    if (playlist.videos.length > 1) {
      setPlayer2Video(playlist.videos[1]);
    }
    // Start with crossfade at 0 (player 1 active)
    setCrossfadeValue(0);
  }, []);

  const handleSelectPlaylist = useCallback(async (playlistId) => {
    try {
      const playlist = await getPlaylist(playlistId);
      setSelectedPlaylist(playlist);
      setPlaylistContentCollapsed(false);

      // Switch to playlist view mode - show playlist videos in the main list
      setViewMode('playlist');
      setViewingPlaylist(playlist);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  }, []);

  const handlePlaylistContentUpdate = useCallback((updatedPlaylist) => {
    // Update selectedPlaylist if it matches
    if (selectedPlaylist?.id === updatedPlaylist.id) {
      setSelectedPlaylist(updatedPlaylist);
    }
    // Also update activePlaylist if it's the same one
    if (activePlaylist?.id === updatedPlaylist.id) {
      setActivePlaylist(updatedPlaylist);
    }
    // Update viewingPlaylist if it's the same one
    if (viewingPlaylist?.id === updatedPlaylist.id) {
      setViewingPlaylist(updatedPlaylist);
    }
    loadPlaylists();
  }, [selectedPlaylist?.id, activePlaylist?.id, viewingPlaylist?.id]);

  const handlePlaylistVideoEnded = useCallback((playerNumber) => {
    if (!playlistMode || !activePlaylist) return;

    const videos = activePlaylist.videos;

    // Find which track index just ended based on player number
    // Player 1 plays indices 0, 2, 4... Player 2 plays indices 1, 3, 5...
    // We need to find the next track for this player

    // Get current indices for each player
    const player1CurrentIndex = player1Video
      ? videos.findIndex(v => v.id === player1Video.id)
      : -2;
    const player2CurrentIndex = player2Video
      ? videos.findIndex(v => v.id === player2Video.id)
      : -1;

    // Calculate next index for the player that just ended
    const currentIndex = playerNumber === 1 ? player1CurrentIndex : player2CurrentIndex;
    const nextIndex = currentIndex + 2;

    if (nextIndex < videos.length) {
      // Load next track for this player
      if (playerNumber === 1) {
        setPlayer1Video(videos[nextIndex]);
      } else {
        setPlayer2Video(videos[nextIndex]);
      }
      setPlaylistIndex(nextIndex);
    } else {
      // No more tracks for this player
      // Check if the other player still has content playing
      const otherPlayerIndex = playerNumber === 1 ? player2CurrentIndex : player1CurrentIndex;
      if (otherPlayerIndex < 0 || otherPlayerIndex >= videos.length - 1) {
        // Playlist ended
        setPlaylistMode(false);
      }
    }
  }, [playlistMode, activePlaylist, player1Video, player2Video]);

  const stopPlaylist = () => {
    setPlaylistMode(false);
    setActivePlaylist(null);
  };

  // Load next song on specified player
  const loadNextOnPlayer = (playerNumber) => {
    if (!activePlaylist) return;

    const videos = activePlaylist.videos;
    const currentVideo = playerNumber === 1 ? player1Video : player2Video;
    const currentIndex = currentVideo
      ? videos.findIndex(v => v.id === currentVideo.id)
      : -2 + playerNumber; // Start from -2 for P1, -1 for P2

    // Find next track for this player (skip one)
    const nextIndex = currentIndex + 2;

    if (nextIndex < videos.length) {
      if (playerNumber === 1) {
        setPlayer1Video(videos[nextIndex]);
      } else {
        setPlayer2Video(videos[nextIndex]);
      }
      setPlaylistIndex(nextIndex);
      showNotification(`Loaded track ${nextIndex + 1} on Player ${playerNumber}`);
    } else {
      showNotification(`No more tracks for Player ${playerNumber}`, 'error');
    }
  };

  // Skip to next track (whichever player is not active)
  const skipToNext = () => {
    if (!activePlaylist) return;

    // Determine which player to load next based on crossfade position
    const inactivePlayer = crossfadeValue < 50 ? 2 : 1;
    loadNextOnPlayer(inactivePlayer);
  };

  const currentPlaylistVideo = playlistMode && activePlaylist
    ? playlistIndex + (crossfadeValue < 50 ? 1 : 2)
    : null;

  // Handle category selection - switch back to categories view
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setViewMode('categories');
    setViewingPlaylist(null);
  };

  // Get videos to display based on view mode
  const displayVideos = viewMode === 'playlist' && viewingPlaylist
    ? viewingPlaylist.videos || []
    : videos;

  // Handler for player state updates from DualPlayer
  const handlePlayerStateUpdate = useCallback((playerNumber, state) => {
    playerStatesRef.current[`player${playerNumber}State`] = state;
    if (syncEnabled) {
      broadcastState({
        player1Video,
        player2Video,
        crossfadeValue,
        player1State: playerStatesRef.current.player1State,
        player2State: playerStatesRef.current.player2State,
      });
    }
  }, [player1Video, player2Video, crossfadeValue, syncEnabled]);

  return (
    <div className="min-h-screen">
      {/* User Selection Modal */}
      <UserSelector />

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg transition-all ${
          notification.type === 'error'
            ? 'bg-red-500 text-white'
            : 'bg-green-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Party Mode Modal */}
      {showPartyModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closePartyModal}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8 max-w-md w-full mx-4 shadow-2xl">
            {/* Close button */}
            <button
              onClick={closePartyModal}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content - Step 1: Select Playlist */}
            {!partyLiveResult ? (
              <div>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Start Live Session
                  </h2>
                  <p className="text-purple-200/70 text-sm mt-1">
                    Select a playlist to share with others
                  </p>
                </div>

                {/* Playlist Selector */}
                <div className="relative mb-6">
                  <label className="block text-purple-300 text-sm mb-2">Select Playlist</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={partySelectedPlaylist ? partySelectedPlaylist.name : partyPlaylistSearch}
                      onChange={(e) => {
                        setPartyPlaylistSearch(e.target.value);
                        setPartySelectedPlaylist(null);
                        setPartyDropdownOpen(true);
                      }}
                      onFocus={() => setPartyDropdownOpen(true)}
                      placeholder="Search playlists..."
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Dropdown */}
                  {partyDropdownOpen && filteredPartyPlaylists.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-purple-900/95 border border-purple-500/30 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredPartyPlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => {
                            setPartySelectedPlaylist(playlist);
                            setPartyPlaylistSearch('');
                            setPartyDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">{playlist.name}</p>
                            <p className="text-purple-300/60 text-xs">{playlist.videos_count || 0} videos</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {partyDropdownOpen && filteredPartyPlaylists.length === 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-purple-900/95 border border-purple-500/30 rounded-xl shadow-xl p-4 text-center text-purple-300/60">
                      No playlists found
                    </div>
                  )}
                </div>

                {/* Selected Playlist Preview */}
                {partySelectedPlaylist && (
                  <div className="mb-6 p-4 bg-white/5 border border-purple-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-semibold">{partySelectedPlaylist.name}</p>
                        <p className="text-purple-300/60 text-sm">{partySelectedPlaylist.videos_count || 0} videos ready to play</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Go Live Button */}
                <button
                  onClick={handlePartyGoLive}
                  disabled={!partySelectedPlaylist || partyLoading}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                    partySelectedPlaylist && !partyLoading
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/30'
                      : 'bg-white/10 text-white/40 cursor-not-allowed'
                  }`}
                >
                  {partyLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                      </svg>
                      Go Live
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* Content - Step 2: Live Session Created */
              <div className="text-center">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                    You're Live!
                  </h2>
                  <p className="text-purple-200/70 text-sm mt-1">
                    Share this code with your friends
                  </p>
                </div>

                {/* Share Code Display */}
                <div className="bg-black/30 rounded-xl p-4 mb-4">
                  <p className="text-purple-300/60 text-xs mb-2 uppercase tracking-wide">Share Code</p>
                  <p className="text-4xl font-mono font-bold text-white tracking-[0.3em]">
                    {partyLiveResult.share_code}
                  </p>
                </div>

                {/* QR Code */}
                <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                  <QRCodeSVG
                    value={getLiveUrl(partyLiveResult.share_code)}
                    size={180}
                    level="H"
                    includeMargin={false}
                  />
                </div>

                {/* URL Display */}
                <div className="bg-black/30 rounded-xl p-3 mb-4">
                  <p className="text-purple-300/60 text-xs mb-1 uppercase tracking-wide">Or share this URL</p>
                  <p className="text-white font-mono text-sm break-all select-all">
                    {getLiveUrl(partyLiveResult.share_code)}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(getLiveUrl(partyLiveResult.share_code));
                      showNotification('URL copied to clipboard!');
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                  <button
                    onClick={handleOpenAsHost}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white rounded-xl transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Start Playing
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent flex-shrink-0">
              BARMANIA
            </h1>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Go Live Button */}
              <button
                onClick={() => setShowPartyModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-green-500/20 transition-all flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                <span className="hidden sm:inline">Go Live</span>
              </button>

              {/* Current User Display */}
              {currentUser && (
                <div className="flex items-center gap-2 pl-3 border-l border-white/10 flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {currentUser.name.charAt(0)}
                  </div>
                  <span className="text-white text-sm hidden md:inline">{currentUser.name}</span>
                  <button
                    onClick={logout}
                    className="p-1.5 text-purple-300/60 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Switch user"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column - Players (sticky on desktop) */}
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-20 flex flex-col gap-3">
              {/* Playlist Selector */}
              <div
                className={`relative z-50 p-3 bg-white/5 backdrop-blur-xl rounded-xl border transition-all ${
                  playlistDropZoneActive
                    ? 'border-green-500 bg-green-500/20 ring-2 ring-green-500 ring-dashed'
                    : 'border-white/10'
                }`}
                onDrop={handlePlaylistDrop}
                onDragOver={handlePlaylistDragOver}
                onDragLeave={handlePlaylistDragLeave}
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                  </svg>
                  <span className="text-white text-sm font-medium">Playlist</span>
                  {playlistMode && activePlaylist && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-300 rounded-full text-xs">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                      Playing
                    </span>
                  )}
                  <span className="text-purple-300/40 text-xs ml-auto">Drop to add</span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={selectedPlaylist ? selectedPlaylist.name : headerPlaylistSearch}
                      onChange={(e) => {
                        setHeaderPlaylistSearch(e.target.value);
                        setSelectedPlaylist(null);
                        setHeaderPlaylistDropdownOpen(true);
                      }}
                      onFocus={() => setHeaderPlaylistDropdownOpen(true)}
                      placeholder={playlistDropZoneActive ? "Drop to add!" : "Select..."}
                      className={`w-full px-3 py-2 border rounded-lg text-white placeholder-purple-300/50 focus:outline-none text-sm transition-all ${
                        playlistDropZoneActive
                          ? 'bg-green-500/20 border-green-500 placeholder-green-300'
                          : 'bg-white/10 border-white/20 focus:border-purple-500'
                      }`}
                    />
                    <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>

                    {/* Dropdown */}
                    {headerPlaylistDropdownOpen && (
                      <div className="absolute left-0 z-[60] w-full mt-1 bg-gray-900/98 backdrop-blur-xl border border-purple-500/30 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                        {filteredHeaderPlaylists.length > 0 ? (
                          filteredHeaderPlaylists.map((playlist) => (
                            <button
                              key={playlist.id}
                              onClick={() => {
                                handleSelectPlaylist(playlist.id);
                                setHeaderPlaylistSearch('');
                                setHeaderPlaylistDropdownOpen(false);
                              }}
                              className="w-full px-3 py-2 text-left hover:bg-purple-500/20 transition-colors flex items-center gap-2"
                            >
                              <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center flex-shrink-0">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm truncate">{playlist.name}</p>
                                <p className="text-purple-300/60 text-xs">{playlist.videos_count || 0} videos</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-purple-300/60 text-sm text-center">
                            No playlists
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Playlist Controls */}
                  {selectedPlaylist && (
                    <div className="flex gap-1">
                      {/* Play/Stop Button */}
                      {playlistMode && activePlaylist?.id === selectedPlaylist.id ? (
                        <button
                          onClick={stopPlaylist}
                          className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                          title="Stop playlist"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          onClick={() => selectedPlaylist && handlePlayPlaylist(selectedPlaylist)}
                          disabled={!selectedPlaylist.videos || selectedPlaylist.videos.length === 0}
                          className="px-3 py-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          title="Play playlist"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                      )}

                      {/* View Button */}
                      {viewMode !== 'playlist' && (
                        <button
                          onClick={() => {
                            setViewMode('playlist');
                            setViewingPlaylist(selectedPlaylist);
                          }}
                          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                          title="View playlist"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Click outside to close dropdown */}
                {headerPlaylistDropdownOpen && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setHeaderPlaylistDropdownOpen(false)}
                  />
                )}
              </div>

              {/* Player 1 */}
              <VideoPlayer
                video={player1Video}
                volume={100 - crossfadeValue}
                playerNumber={1}
                isActive={crossfadeValue < 50}
                onTimeUpdate={() => {}}
                onEnded={handlePlaylistVideoEnded}
                onStateUpdate={handlePlayerStateUpdate}
              />

              {/* Player 2 */}
              <VideoPlayer
                video={player2Video}
                volume={crossfadeValue}
                playerNumber={2}
                isActive={crossfadeValue >= 50}
                onTimeUpdate={() => {}}
                onEnded={handlePlaylistVideoEnded}
                onStateUpdate={handlePlayerStateUpdate}
              />

              {/* Crossfader */}
              <div className="bg-white/5 backdrop-blur rounded-xl p-3 border border-white/10">
                <Crossfader value={crossfadeValue} onChange={setCrossfadeValue} />
              </div>
            </div>
          </div>

          {/* Right Column - Video List */}
          <div className="lg:col-span-8">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* YouTube Search with Autocomplete Dropdown */}
              <div className="relative p-3 border-b border-white/10 bg-gradient-to-r from-red-600/10 to-pink-600/10">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 z-10" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <input
                    type="text"
                    value={youtubeSearchQuery}
                    onChange={(e) => handleYoutubeSearchInput(e.target.value)}
                    onFocus={() => youtubeSearchResults.length > 0 && setShowYoutubeDropdown(true)}
                    placeholder="Search YouTube..."
                    className="w-full pl-10 pr-10 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-red-300/50 focus:outline-none focus:border-red-500 text-sm"
                  />
                  {youtubeSearchLoading && (
                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-red-300/30 border-t-red-400 rounded-full animate-spin" />
                    </div>
                  )}
                  {youtubeSearchQuery && (
                    <button
                      type="button"
                      onClick={clearYoutubeSearch}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white z-10"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showYoutubeDropdown && youtubeSearchQuery && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-gray-900/98 backdrop-blur-xl border border-red-500/30 rounded-xl shadow-2xl shadow-black/50 max-h-[400px] overflow-y-auto z-50">
                      {youtubeSearchLoading && youtubeSearchResults.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-red-300/30 border-t-red-400 rounded-full animate-spin" />
                          <span className="ml-3 text-red-300/60 text-sm">Searching YouTube...</span>
                        </div>
                      ) : youtubeSearchResults.length === 0 ? (
                        <div className="text-center text-red-300/60 py-8 text-sm">
                          No results found
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {youtubeSearchResults.map((video) => (
                            <div
                              key={video.youtube_id}
                              className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors group"
                            >
                              {/* Thumbnail */}
                              <div className="relative flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden bg-black/50">
                                <img
                                  src={video.thumbnail_url}
                                  alt={video.title}
                                  className="w-full h-full object-cover"
                                />
                                {importingVideoId === video.youtube_id && (
                                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  </div>
                                )}
                                {/* YouTube badge */}
                                <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-red-600 rounded text-[10px] text-white font-medium">
                                  YT
                                </div>
                              </div>

                              {/* Title */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white text-sm font-medium line-clamp-2">{video.title}</h4>
                              </div>

                              {/* Play buttons */}
                              <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handlePlayYoutubeResult(video, 1)}
                                  disabled={importingVideoId === video.youtube_id}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white rounded-lg transition-colors text-xs font-medium"
                                  title="Play on Player 1"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  </svg>
                                  P1
                                </button>
                                <button
                                  onClick={() => handlePlayYoutubeResult(video, 2)}
                                  disabled={importingVideoId === video.youtube_id}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-pink-600 hover:bg-pink-500 disabled:bg-pink-600/50 text-white rounded-lg transition-colors text-xs font-medium"
                                  title="Play on Player 2"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  </svg>
                                  P2
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Click outside to close dropdown */}
                {showYoutubeDropdown && (
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowYoutubeDropdown(false)}
                  />
                )}
              </div>

              {/* Playlist View Header or Category Filter */}
              {viewMode === 'playlist' && viewingPlaylist ? (
                <div className="border-b border-white/10 p-3 flex items-center justify-between bg-gradient-to-r from-purple-600/10 to-pink-600/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-white font-semibold text-sm">{viewingPlaylist.name}</h2>
                      <p className="text-purple-300/60 text-xs">{viewingPlaylist.videos?.length || 0} videos</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCategorySelect(null)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="hidden sm:inline">Back to Library</span>
                  </button>
                </div>
              ) : (
                <div className="border-b border-white/10">
                  <CategoryFilter
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelect={handleCategorySelect}
                  />
                </div>
              )}

              {/* Video List */}
              {loading && viewMode === 'categories' ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : (
                <VideoList
                  videos={displayVideos}
                  onPlay={handlePlayVideo}
                  playlists={playlists}
                  onAddToPlaylist={handleAddToPlaylist}
                  selectedPlaylistId={selectedPlaylist?.id}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
