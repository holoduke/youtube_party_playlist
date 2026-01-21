import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCategories, getVideos, getPlaylists, getPlaylist, addVideoToPlaylist, removeVideoFromPlaylist, reorderPlaylistVideos, updatePlaylist, searchYouTube, getYouTubeVideo, importYouTubeVideo, extractYouTubeVideoId, getChannel, startChannelBroadcast, stopChannelBroadcast, syncChannelState, getViewerCount } from './services/api';
import { initEcho, broadcastState } from './services/playerSync';
import { useUser } from './contexts/UserContext';
import CategoryFilter from './components/CategoryFilter';
import VideoList from './components/VideoList';
import PlaylistVideoList from './components/PlaylistVideoList';
import VideoPlayer from './components/VideoPlayer';
import Crossfader from './components/Crossfader';
import UserSelector from './components/UserSelector';
import BroadcastModal from './components/BroadcastModal';
import AccountSettings from './components/AccountSettings';
import PlaylistSettingsModal from './components/PlaylistSettingsModal';
import PartyModal from './components/PartyModal';
import PublishModal from './components/PublishModal';
import PlaylistModal from './components/PlaylistModal';
import AddVideoModal from './components/AddVideoModal';
import ChannelSection from './components/ChannelSection';
import PlaybackControls from './components/PlaybackControls';
import YouTubeSearchBar from './components/YouTubeSearchBar';

const YOUTUBE_ERROR_MESSAGES = {
  2: 'Invalid video ID or request.',
  5: 'HTML5 playback error.',
  100: 'Video not found or removed.',
  101: 'Playback disabled by the owner.',
  150: 'Playback disabled by the owner.',
};

const getYouTubeErrorMessage = (code) => (
  YOUTUBE_ERROR_MESSAGES[code] || 'Video failed to load or play.'
);

function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, logout, updateUser } = useUser();
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
  const [playlistMode, setPlaylistMode] = useState(false);

  // Selected playlist content state
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // View mode: 'categories' or 'playlist' (synced with URL param 'view')
  const urlViewMode = searchParams.get('view');
  const viewMode = urlViewMode === 'categories' ? 'categories' : 'playlist';
  const setViewMode = (mode, playlistHash = null) => {
    setSearchParams(() => {
      const newParams = new URLSearchParams();
      if (mode === 'playlist') {
        if (playlistHash) {
          newParams.set('pl', playlistHash);
        }
        // Clean URL for playlist (default view)
      } else if (mode === 'categories') {
        newParams.set('view', 'categories');
      }
      return newParams;
    }, { replace: true });
  };
  const [viewingPlaylist, setViewingPlaylist] = useState(null);

  // Remote sync state
  const [syncEnabled] = useState(true);
  const playerStatesRef = useRef({ player1State: 'paused', player2State: 'paused' });
  const broadcastTimeoutRef = useRef(null);

  // Party mode modal state
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [partyPlaylistSearch, setPartyPlaylistSearch] = useState('');
  const [partySelectedPlaylist, setPartySelectedPlaylist] = useState(null);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partyLiveResult, setPartyLiveResult] = useState(null);
  const [partyLoading, setPartyLoading] = useState(false);

  // Channel state (user's broadcast channel)
  const [channel, setChannel] = useState(null);

  // Broadcast state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastHash, setBroadcastHash] = useState(null);
  const [broadcastCode, setBroadcastCode] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const broadcastSyncTimeoutRef = useRef(null);
  const videoStartedAtRef = useRef(null); // Timestamp when current video started playing

  // Stopped state (shows idle screen in viewer)
  const [isStopped, setIsStopped] = useState(false);

  // DJ mute state (local only, doesn't affect viewers)
  const [djMuted, setDjMuted] = useState(false);

  // Fullscreen state for DJ player
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);
  const playerContainerRef = useRef(null);
  const fullscreenHideTimeoutRef = useRef(null);
  const previousOrientationRef = useRef(null); // Store orientation before fullscreen

  // Account settings modal state
  const [showAccountSettings, setShowAccountSettings] = useState(false);

  // Playlist settings modal state
  const [showPlaylistSettings, setShowPlaylistSettings] = useState(false);

  // Playlist modal state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistModalTab, setPlaylistModalTab] = useState('my'); // 'my' | 'public' | 'create' | 'import'
  const [publicPlaylistSearch, setPublicPlaylistSearch] = useState('');
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [publicPlaylistsLoading, setPublicPlaylistsLoading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const publicSearchTimeoutRef = useRef(null);

  // YouTube search state
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('');
  const [youtubeSearchResults, setYoutubeSearchResults] = useState([]);
  const [youtubeSearchLoading, setYoutubeSearchLoading] = useState(false);
  const [showYoutubeDropdown, setShowYoutubeDropdown] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState(null);
  const youtubeSearchTimeoutRef = useRef(null);

  // Add video modal state
  const [addVideoModal, setAddVideoModal] = useState(null); // null or video object

  // Playlist item menu state
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(null); // playlist id or null

  // Inline playlist name editing
  const [editingPlaylistName, setEditingPlaylistName] = useState(false);
  const [editedPlaylistName, setEditedPlaylistName] = useState('');
  const playlistNameInputRef = useRef(null);

  // Player refs and state
  const player1Ref = useRef(null);
  const player2Ref = useRef(null);
  const [player1State, setPlayer1State] = useState({ playing: false, currentTime: 0, duration: 0 });
  const [player2State, setPlayer2State] = useState({ playing: false, currentTime: 0, duration: 0 });
  const [playerErrors, setPlayerErrors] = useState({ player1: null, player2: null });
  const errorSkipTimeoutRef = useRef(null); // Timeout for auto-skip after error
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const seekHoldRef = useRef(null);
  const wasPlayingOnHideRef = useRef({ player1: false, player2: false });
  const hiddenKeepAliveRef = useRef(null);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const [autoQueueEnabled, setAutoQueueEnabled] = useState(true); // Auto-load next video after fade
  // Track which videos were restored (should not auto-start)
  const [restoredVideoIds, setRestoredVideoIds] = useState({ player1: null, player2: null });
  // Track drag over playlist tab for adding videos
  const [isPlaylistTabDragOver, setIsPlaylistTabDragOver] = useState(false);
  // Track global drag state for video player overlays
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);

  // Listen for drag start/end to show drop overlays on video players
  useEffect(() => {
    const handleDragStart = () => setIsGlobalDragging(true);
    const handleDragEnd = () => setIsGlobalDragging(false);
    const handleDrop = () => setTimeout(() => setIsGlobalDragging(false), 50);

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        wasPlayingOnHideRef.current = {
          player1: player1State.playing,
          player2: player2State.playing,
        };
        if (!hiddenKeepAliveRef.current && !isStopped) {
          hiddenKeepAliveRef.current = setInterval(() => {
            if (wasPlayingOnHideRef.current.player1 && player1Ref.current) {
              player1Ref.current.play();
            }
            if (wasPlayingOnHideRef.current.player2 && player2Ref.current) {
              player2Ref.current.play();
            }
          }, 3000);
        }
        return;
      }
      if (hiddenKeepAliveRef.current) {
        clearInterval(hiddenKeepAliveRef.current);
        hiddenKeepAliveRef.current = null;
      }
      if (isStopped) return;
      if (wasPlayingOnHideRef.current.player1 && player1Ref.current) {
        player1Ref.current.play();
      }
      if (wasPlayingOnHideRef.current.player2 && player2Ref.current) {
        player2Ref.current.play();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (hiddenKeepAliveRef.current) {
        clearInterval(hiddenKeepAliveRef.current);
        hiddenKeepAliveRef.current = null;
      }
    };
  }, [player1State.playing, player2State.playing, isStopped]);

  useEffect(() => {
    setPlayerErrors(prev => ({ ...prev, player1: null }));
  }, [player1Video?.youtube_id]);

  useEffect(() => {
    setPlayerErrors(prev => ({ ...prev, player2: null }));
  }, [player2Video?.youtube_id]);

  // Clipboard state - only show button when valid YouTube URL is in clipboard
  const [clipboardYoutubeUrl, setClipboardYoutubeUrl] = useState(null);

  // Check clipboard for YouTube URLs on focus
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard?.readText();
        if (text && extractYouTubeVideoId(text.trim())) {
          setClipboardYoutubeUrl(text.trim());
        } else {
          setClipboardYoutubeUrl(null);
        }
      } catch {
        // Clipboard access denied or not available
        setClipboardYoutubeUrl(null);
      }
    };

    // Check on mount and when window gains focus
    checkClipboard();
    window.addEventListener('focus', checkClipboard);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkClipboard();
    });

    return () => {
      window.removeEventListener('focus', checkClipboard);
    };
  }, []);

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

  // Add a YouTube search result to the library (and optionally to playlist)
  const handleAddYoutubeToLibrary = async (video, addToPlaylist = false) => {
    setImportingVideoId(video.youtube_id);
    try {
      // Import the video to library
      const imported = await importYouTubeVideo(video);

      if (addToPlaylist && selectedPlaylist) {
        // Also add to playlist
        await addVideoToPlaylist(selectedPlaylist.id, imported.id);
        showNotification(`Added "${video.title}" to ${selectedPlaylist.name}`);
        // Refresh playlist
        const updated = await getPlaylist(selectedPlaylist.id);
        setSelectedPlaylist(updated);
        if (viewingPlaylist?.id === selectedPlaylist.id) {
          setViewingPlaylist(updated);
        }
        loadPlaylists();
      } else {
        showNotification(`Added "${video.title}" to library`);
      }
      // Refresh library videos
      loadVideos();
    } catch (error) {
      console.error('Failed to add video:', error);
      showNotification('Failed to add video', 'error');
    }
    setImportingVideoId(null);
  };

  useEffect(() => {
    loadCategories();
    loadVideos();
    // Initialize Echo for WebSocket connection
    initEcho();
  }, []);

  const loadPlaylists = useCallback(async () => {
    if (!currentUser) return;
    try {
      const data = await getPlaylists(currentUser.id);
      setPlaylists(data);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  }, [currentUser]);

  // Reload playlists and channel when user changes
  useEffect(() => {
    if (currentUser) {
      loadPlaylists().then(() => {
        // Auto-select default playlist if set and no playlist currently selected
        if (currentUser.default_playlist_id && !selectedPlaylist) {
          getPlaylist(currentUser.default_playlist_id)
            .then(playlist => setSelectedPlaylist(playlist))
            .catch(() => {}); // Ignore if default playlist was deleted
        }
      });
      // Load user's channel
      getChannel(currentUser.id).then(data => {
        setChannel(data.channel);
        // Restore broadcast state if channel is broadcasting
        if (data.channel?.is_broadcasting) {
          setIsBroadcasting(true);
          setBroadcastHash(data.channel.hash);
          setBroadcastCode(data.channel.broadcast_code);
        }
      }).catch(err => console.error('Failed to load channel:', err));
    } else {
      setPlaylists([]);
      setChannel(null);
    }
  }, [currentUser, loadPlaylists]);

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

  // Sync broadcast state when broadcasting (debounced)
  useEffect(() => {
    if (!isBroadcasting || !currentUser) return;

    // Clear any pending sync
    if (broadcastSyncTimeoutRef.current) {
      clearTimeout(broadcastSyncTimeoutRef.current);
    }

    // Debounce sync
    broadcastSyncTimeoutRef.current = setTimeout(async () => {
      // Send position-based video assignments and individual player states
      try {
        await syncChannelState(currentUser.id, {
          playlist_id: selectedPlaylist?.id,
          player1_video: player1Video,
          player2_video: player2Video,
          player1_playing: player1State.playing,
          player2_playing: player2State.playing,
          player1_time: player1State.currentTime,
          player2_time: player2State.currentTime,
          crossfade_value: crossfadeValue,
          started_at: videoStartedAtRef.current,
          // Fade trigger data - viewer will animate locally based on this
          fade_trigger: fadeTriggeredRef.current,
          is_stopped: isStopped,
        });
      } catch (error) {
        console.error('Failed to sync broadcast state:', error);
      }
    }, 100);

    return () => {
      if (broadcastSyncTimeoutRef.current) {
        clearTimeout(broadcastSyncTimeoutRef.current);
      }
    };
  }, [isBroadcasting, currentUser, selectedPlaylist, player1Video, player2Video, crossfadeValue, player1State.playing, player2State.playing, player1State.currentTime, player2State.currentTime, isStopped]);

  // Poll for viewer count while broadcasting
  useEffect(() => {
    if (!isBroadcasting || !currentUser) {
      setViewerCount(0);
      return;
    }

    const fetchViewerCount = async () => {
      try {
        const data = await getViewerCount(currentUser.id);
        setViewerCount(data.count);
      } catch (error) {
        console.error('Failed to fetch viewer count:', error);
      }
    };

    // Initial fetch
    fetchViewerCount();

    // Poll every 5 seconds
    const interval = setInterval(fetchViewerCount, 5000);

    return () => clearInterval(interval);
  }, [isBroadcasting, currentUser]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (isFs) {
        setShowFullscreenControls(true);
        startFullscreenHideTimer();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Start timer to hide fullscreen controls
  const startFullscreenHideTimer = () => {
    if (fullscreenHideTimeoutRef.current) {
      clearTimeout(fullscreenHideTimeoutRef.current);
    }
    fullscreenHideTimeoutRef.current = setTimeout(() => {
      setShowFullscreenControls(false);
    }, 3000);
  };

  // Show controls on mouse/touch activity in fullscreen
  const handleFullscreenActivity = () => {
    if (!isFullscreen) return;
    setShowFullscreenControls(true);
    startFullscreenHideTimer();
  };

  // Toggle fullscreen for DJ player
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement && playerContainerRef.current) {
      try {
        // Remember current orientation before entering fullscreen
        previousOrientationRef.current = screen.orientation?.type?.startsWith('portrait') ? 'portrait' : 'landscape';

        await playerContainerRef.current.requestFullscreen();
        // Try to lock to landscape on mobile
        if (screen.orientation?.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch {
            // Orientation lock not supported or not allowed
          }
        }
      } catch (err) {
        console.log('Fullscreen error:', err);
      }
    } else if (document.fullscreenElement) {
      // Restore previous orientation when exiting fullscreen
      if (screen.orientation?.lock && previousOrientationRef.current) {
        try {
          await screen.orientation.lock(previousOrientationRef.current);
        } catch {
          // Lock not supported, try unlocking instead
          try {
            screen.orientation.unlock?.();
          } catch {
            // Orientation control not supported
          }
        }
      }
      document.exitFullscreen();
    }
  };

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

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || !currentUser) return;
    setCreatingPlaylist(true);
    try {
      const playlist = await createPlaylist({
        name: newPlaylistName.trim(),
        user_id: currentUser.id,
        is_public: newPlaylistPublic,
      });
      showNotification(`Created playlist "${playlist.name}"`);
      setNewPlaylistName('');
      setNewPlaylistPublic(false);
      setShowPlaylistModal(false);
      loadPlaylists();
      // Select the newly created playlist and switch to playlist view
      handleSelectPlaylist(playlist.id, true);
    } catch (error) {
      console.error('Failed to create playlist:', error);
      showNotification('Failed to create playlist', 'error');
    }
    setCreatingPlaylist(false);
  };

  // Search public playlists with debounce
  const handlePublicPlaylistSearch = (value) => {
    setPublicPlaylistSearch(value);
    if (publicSearchTimeoutRef.current) {
      clearTimeout(publicSearchTimeoutRef.current);
    }
    setPublicPlaylistsLoading(true);
    publicSearchTimeoutRef.current = setTimeout(async () => {
      try {
        // Exclude current user's playlists from public results
        const results = await getPublicPlaylists(value || null, currentUser?.id);
        setPublicPlaylists(results);
      } catch (error) {
        console.error('Failed to search public playlists:', error);
      }
      setPublicPlaylistsLoading(false);
    }, 300);
  };

  // Load public playlists when tab is selected
  const handlePlaylistModalTabChange = (tab) => {
    setPlaylistModalTab(tab);
    if (tab === 'public' && publicPlaylists.length === 0) {
      handlePublicPlaylistSearch('');
    }
  };

  // Start editing playlist name
  const startEditingPlaylistName = () => {
    if (viewingPlaylist) {
      setEditedPlaylistName(viewingPlaylist.name);
      setEditingPlaylistName(true);
      // Focus the input after it renders
      setTimeout(() => playlistNameInputRef.current?.focus(), 0);
    }
  };

  // Save edited playlist name
  const savePlaylistName = async () => {
    if (!viewingPlaylist || !editedPlaylistName.trim()) {
      setEditingPlaylistName(false);
      return;
    }

    const newName = editedPlaylistName.trim();
    if (newName === viewingPlaylist.name) {
      setEditingPlaylistName(false);
      return;
    }

    try {
      await updatePlaylist(viewingPlaylist.id, { name: newName });
      // Update local state
      setViewingPlaylist(prev => ({ ...prev, name: newName }));
      if (selectedPlaylist?.id === viewingPlaylist.id) {
        setSelectedPlaylist(prev => ({ ...prev, name: newName }));
      }
      loadPlaylists();
      showNotification('Playlist renamed');
    } catch (error) {
      console.error('Failed to update playlist name:', error);
      showNotification('Failed to rename playlist', 'error');
    }
    setEditingPlaylistName(false);
  };

  // Cancel editing playlist name
  const cancelEditingPlaylistName = () => {
    setEditingPlaylistName(false);
    setEditedPlaylistName('');
  };

  // Select a playlist from the modal
  const handleSelectPlaylistFromModal = async (playlistId) => {
    await handleSelectPlaylist(playlistId, true);
    setShowPlaylistModal(false);
  };

  const handlePlayVideo = (video, playerNumber) => {
    // Cancel any pending auto-load to prevent rapid video changes
    if (loadNextVideoTimeoutRef.current) {
      clearTimeout(loadNextVideoTimeoutRef.current);
      loadNextVideoTimeoutRef.current = null;
    }

    // Stop playlist mode when manually selecting a video
    setPlaylistMode(false);
    setActivePlaylist(null);

    // Just update the video state - VideoPlayer handles loading via YouTube API internally
    if (playerNumber === 1) {
      setPlayer1Video(video);
    } else {
      setPlayer2Video(video);
    }
  };

  // Queue a video to the playlist and fade to it
  const handleQueueToPlaylist = async (video, playerNumber) => {
    // Must have a selected playlist to queue to
    if (!selectedPlaylist) {
      showNotification('Select a playlist first', 'error');
      return;
    }

    const playlistVideos = selectedPlaylist.videos || [];
    const isAlreadyInPlaylist = playlistVideos.some(v => v.id === video.id);

    // Determine active player and currently playing video
    const activePlayerNumber = crossfadeValue < 50 ? 1 : 2;
    const inactivePlayer = activePlayerNumber === 1 ? 2 : 1;
    const activeVideo = activePlayerNumber === 1 ? player1Video : player2Video;

    // Find the index of the currently playing video in the playlist
    const currentIndex = activeVideo ? playlistVideos.findIndex(v => v.id === activeVideo.id) : -1;

    try {
      if (!isAlreadyInPlaylist) {
        // Add video to playlist first
        await addVideoToPlaylist(selectedPlaylist.id, video.id);

        // Refresh playlist to get updated video list
        const updated = await getPlaylist(selectedPlaylist.id);
        const updatedVideos = updated.videos || [];

        // Reorder: move the newly added video to be right after the current video
        if (currentIndex >= 0 && updatedVideos.length > 1) {
          const newVideoIndex = updatedVideos.findIndex(v => v.id === video.id);
          if (newVideoIndex >= 0 && newVideoIndex !== currentIndex + 1) {
            const videoIds = updatedVideos.map(v => v.id);
            const [movedId] = videoIds.splice(newVideoIndex, 1);
            const insertAt = Math.min(currentIndex + 1, videoIds.length);
            videoIds.splice(insertAt, 0, movedId);
            await reorderPlaylistVideos(selectedPlaylist.id, videoIds);
          }
        }

        // Refresh to get final order
        const finalPlaylist = await getPlaylist(selectedPlaylist.id);
        setSelectedPlaylist(finalPlaylist);
        if (viewingPlaylist?.id === selectedPlaylist.id) {
          setViewingPlaylist(finalPlaylist);
        }
        loadPlaylists();
      }

      // Load video into the inactive player and fade to it
      console.log(`[Queue] Loading "${video.title}" into Player ${inactivePlayer} and fading`);
      if (inactivePlayer === 1) {
        setPlayer1Video(video);
        setRestoredVideoIds(prev => ({ ...prev, player1: null })); // null = autoplay
      } else {
        setPlayer2Video(video);
        setRestoredVideoIds(prev => ({ ...prev, player2: null })); // null = autoplay
      }

      // Enable playlist mode if not already active
      if (!playlistMode) {
        setActivePlaylist(selectedPlaylist);
        setPlaylistMode(true);
        setAutoPlayEnabled(true);
      }

      // Fade to the new video after a short delay to let it load
      setTimeout(() => {
        skipToNextWithFade();
      }, 500);

    } catch (error) {
      console.error('Failed to queue video:', error);
      showNotification('Failed to queue video', 'error');
    }
  };

  const handleAddToPlaylist = async (videoId, playlistId) => {
    try {
      await addVideoToPlaylist(playlistId, videoId);
      const playlist = playlists.find(p => p.id === playlistId);
      showNotification(`Added to "${playlist?.name}"`);
      // Refresh playlists and selected playlist content
      loadPlaylists();
      const updated = await getPlaylist(playlistId);
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(updated);
      }
      if (viewingPlaylist?.id === playlistId) {
        setViewingPlaylist(updated);
      }
    } catch (error) {
      console.error('Failed to add video to playlist:', error);
      showNotification('Failed to add video', 'error');
    }
  };

  const handleRemoveFromPlaylist = async (videoId, playlistId) => {
    try {
      await removeVideoFromPlaylist(playlistId, videoId);
      const playlist = playlists.find(p => p.id === playlistId);
      showNotification(`Removed from "${playlist?.name}"`);
      // Refresh playlists and playlist content
      loadPlaylists();
      const updated = await getPlaylist(playlistId);
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(updated);
      }
      if (viewingPlaylist?.id === playlistId) {
        setViewingPlaylist(updated);
      }
    } catch (error) {
      console.error('Failed to remove video from playlist:', error);
      showNotification('Failed to remove video', 'error');
    }
  };

  // Playlist tab drag handlers for adding videos from library
  const handlePlaylistTabDragOver = (e) => {
    if (!selectedPlaylist) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsPlaylistTabDragOver(true);
  };

  const handlePlaylistTabDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsPlaylistTabDragOver(false);
    }
  };

  const handlePlaylistTabDrop = (e) => {
    e.preventDefault();
    setIsPlaylistTabDragOver(false);

    if (!selectedPlaylist) return;

    const jsonData = e.dataTransfer.getData('application/json');
    if (jsonData) {
      try {
        const videoData = JSON.parse(jsonData);
        if (videoData && videoData.id) {
          handleAddToPlaylist(videoData.id, selectedPlaylist.id);
        }
      } catch (err) {
        console.error('Failed to parse drop data:', err);
      }
    }
  };

  const handleReorderPlaylist = async (videoIds) => {
    if (!viewingPlaylist) return;
    try {
      await reorderPlaylistVideos(viewingPlaylist.id, videoIds);
      // Refresh the playlist
      const updated = await getPlaylist(viewingPlaylist.id);
      setViewingPlaylist(updated);
      if (selectedPlaylist?.id === viewingPlaylist.id) {
        setSelectedPlaylist(updated);
      }

      // If auto-queue is enabled, reload the next video in the inactive player
      if (autoQueueEnabled && updated.videos?.length > 0) {
        const activePlayerNum = crossfadeValue < 50 ? 1 : 2;
        const currentActiveVideo = activePlayerNum === 1 ? player1Video : player2Video;

        // Find the active video's new position in the reordered list
        const activeIndex = updated.videos.findIndex(v => v.id === currentActiveVideo?.id);

        if (activeIndex >= 0 && activeIndex + 1 < updated.videos.length) {
          const newNextVideo = updated.videos[activeIndex + 1];
          console.log(`[Reorder] Loading new next video "${newNextVideo.title}" into Player ${activePlayerNum === 1 ? 2 : 1}`);

          // Load into the inactive player (without autoplay)
          if (activePlayerNum === 1) {
            setPlayer2Video(newNextVideo);
            setRestoredVideoIds(prev => ({ ...prev, player2: newNextVideo.youtube_id }));
          } else {
            setPlayer1Video(newNextVideo);
            setRestoredVideoIds(prev => ({ ...prev, player1: newNextVideo.youtube_id }));
          }
        }
      }
    } catch (error) {
      console.error('Failed to reorder playlist:', error);
      showNotification('Failed to reorder', 'error');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = () => {
    // Stop and destroy player instances
    if (player1Ref.current) {
      player1Ref.current.destroy();
    }
    if (player2Ref.current) {
      player2Ref.current.destroy();
    }

    // Clear all player state
    setPlayer1Video(null);
    setPlayer2Video(null);
    setPlayer1State({ playing: false, currentTime: 0, duration: 0 });
    setPlayer2State({ playing: false, currentTime: 0, duration: 0 });
    setAutoPlayEnabled(false);
    setIsAutoFading(false);
    setActivePlaylist(null);
    setPlaylistMode(false);
    setSelectedPlaylist(null);
    setViewingPlaylist(null);
    setCrossfadeValue(50);

    // Stop broadcasting if active
    if (isBroadcasting && currentUser) {
      stopChannelBroadcast(currentUser.id).catch(() => {});
    }
    setIsBroadcasting(false);
    setBroadcastHash(null);
    setBroadcastCode(null);

    // Clear any running intervals
    if (autoFadeIntervalRef.current) {
      clearInterval(autoFadeIntervalRef.current);
      autoFadeIntervalRef.current = null;
    }

    // Clear saved playback state and selected playlist
    localStorage.removeItem('barmania_playback_state');
    localStorage.removeItem('barmania_selected_playlist');

    // Call the actual logout
    logout();
  };

  const handleSelectPlaylist = useCallback(async (playlistId, switchToPlaylistView = false) => {
    try {
      const playlist = await getPlaylist(playlistId);
      setSelectedPlaylist(playlist);
      setViewingPlaylist(playlist);

      // Restore legacy playlist broadcast state only if channel is not live
      if (!channel?.is_broadcasting && playlist.is_broadcasting) {
        setIsBroadcasting(true);
        setBroadcastHash(playlist.hash);
        setBroadcastCode(playlist.broadcast_code);

        // Restore playback state from broadcast
        const state = playlist.state;
        if (state) {
          // Restore videos to players
          if (state.player1_video) {
            setPlayer1Video(state.player1_video);
          }
          if (state.player2_video) {
            setPlayer2Video(state.player2_video);
          }
          // Restore crossfade
          if (state.crossfade_value !== undefined) {
            setCrossfadeValue(state.crossfade_value);
          }
          // Restore playback position and state for both players
          const shouldRestorePlayer1 = state.player1_video && (state.player1_playing || state.player1_time > 0);
          const shouldRestorePlayer2 = state.player2_video && (state.player2_playing || state.player2_time > 0);

          if (shouldRestorePlayer1 || shouldRestorePlayer2) {
            videoStartedAtRef.current = state.started_at;
            // Schedule seek after players are ready
            setTimeout(() => {
              try {
                if (shouldRestorePlayer1 && player1Ref.current) {
                  const seekTime = state.player1_time || 0;
                  player1Ref.current.seekTo(seekTime, true);
                  if (state.player1_playing) {
                    player1Ref.current.playVideo();
                  }
                }
                if (shouldRestorePlayer2 && player2Ref.current) {
                  const seekTime = state.player2_time || 0;
                  player2Ref.current.seekTo(seekTime, true);
                  if (state.player2_playing) {
                    player2Ref.current.playVideo();
                  }
                }
              } catch (e) {
                console.error('Failed to restore playback position:', e);
              }
            }, 1500);
          }
        }
      } else if (!channel?.is_broadcasting) {
        setIsBroadcasting(false);
        setBroadcastHash(null);
        setBroadcastCode(null);
      }

      // Only switch to playlist view mode if explicitly requested
      if (switchToPlaylistView) {
        setViewMode('playlist', playlist.hash);
      }

      // Save to localStorage for persistence
      localStorage.setItem('barmania_selected_playlist', playlistId.toString());
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  }, [setViewMode, channel?.is_broadcasting]);

  // Restore saved playlist and playback state after playlists are loaded
  useEffect(() => {
    if (playlists.length > 0 && !selectedPlaylist) {
      const savedPlaylistId = localStorage.getItem('barmania_selected_playlist');
      // Only use saved playlist if it belongs to the current user's playlists
      const savedId = savedPlaylistId ? parseInt(savedPlaylistId, 10) : null;
      const savedPlaylistBelongsToUser = savedId && playlists.some(p => p.id === savedId);
      const playlistId = savedPlaylistBelongsToUser ? savedId : playlists[0].id;

      handleSelectPlaylist(playlistId)
        .then(() => {
          // After playlist is loaded, restore playback state (only if playlist belonged to user)
          if (savedPlaylistBelongsToUser) {
            const savedState = localStorage.getItem('barmania_playback_state');
            if (savedState) {
              try {
                const state = JSON.parse(savedState);
                // Track which videos are being restored (they shouldn't auto-start)
                const restored = { player1: null, player2: null };
                if (state.player1Video) {
                  setPlayer1Video(state.player1Video);
                  restored.player1 = state.player1Video.youtube_id;
                }
                if (state.player2Video) {
                  setPlayer2Video(state.player2Video);
                  restored.player2 = state.player2Video.youtube_id;
                }
                setRestoredVideoIds(restored);
                if (typeof state.crossfadeValue === 'number') setCrossfadeValue(state.crossfadeValue);
                if (state.autoPlayEnabled) {
                  setAutoPlayEnabled(true);
                  if (typeof state.autoPlayIndex === 'number') setAutoPlayIndex(state.autoPlayIndex);
                }
              } catch (e) {
                console.error('Failed to restore playback state:', e);
              }
            }
          }
        })
        .catch(() => {
          // If playlist doesn't exist anymore, clear localStorage and try first playlist
          localStorage.removeItem('barmania_selected_playlist');
          localStorage.removeItem('barmania_playback_state');
          if (playlists.length > 0) {
            handleSelectPlaylist(playlists[0].id);
          }
        });
    }
  }, [playlists, selectedPlaylist, handleSelectPlaylist]);

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

    // Calculate next index for the player that just ended (cycle back to beginning)
    const currentIndex = playerNumber === 1 ? player1CurrentIndex : player2CurrentIndex;
    const nextIndex = (currentIndex + 2) % videos.length;

    // Load next track for this player (cycles through playlist)
    if (playerNumber === 1) {
      setPlayer1Video(videos[nextIndex]);
    } else {
      setPlayer2Video(videos[nextIndex]);
    }
  }, [playlistMode, activePlaylist, player1Video, player2Video]);

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

  const handlePlayerError = useCallback((playerNumber, errorCode, video) => {
    const errorMessage = getYouTubeErrorMessage(errorCode);
    const videoTitle = video?.title || 'Unknown video';

    setPlayerErrors(prev => ({
      ...prev,
      [`player${playerNumber}`]: {
        code: errorCode,
        message: errorMessage,
        videoTitle: videoTitle,
        videoId: video?.youtube_id || null,
        timestamp: Date.now(), // Track when error occurred for auto-skip
      },
    }));

    // Show notification (auto-dismiss after 5 seconds for errors)
    setNotification({
      message: `${videoTitle}: ${errorMessage}`,
      type: 'error',
    });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  // Handler for player state updates
  const handlePlayerStateUpdate = useCallback((playerNumber, state) => {
    playerStatesRef.current[`player${playerNumber}State`] = state;

    // Update player state for UI
    const isPlaying = state === 'playing';
    if (playerNumber === 1) {
      setPlayer1State(prev => ({ ...prev, playing: isPlaying }));
    } else {
      setPlayer2State(prev => ({ ...prev, playing: isPlaying }));
    }

    // Track when the active player starts playing (for broadcast sync)
    const isPlayer1Active = crossfadeValue < 50;
    const isActivePlayer = (playerNumber === 1 && isPlayer1Active) || (playerNumber === 2 && !isPlayer1Active);
    if (isActivePlayer && isPlaying) {
      videoStartedAtRef.current = Date.now();
    }

    // When playback starts via native YouTube button, activate playlist mode if we have a playlist
    if (isPlaying && !playlistMode && selectedPlaylist?.videos?.length > 0) {
      const playlistVideos = selectedPlaylist.videos;
      const currentVideo = playerNumber === 1 ? player1Video : player2Video;
      const currentIndex = playlistVideos.findIndex(v => v.id === currentVideo?.id);

      // Only activate playlist mode if the current video is in the playlist
      if (currentIndex >= 0) {
        console.log('[Native Play] Activating playlist mode from native YouTube button');
        setActivePlaylist(selectedPlaylist);
        setPlaylistMode(true);
        setAutoPlayEnabled(true);
        setIsStopped(false);

        // Load next video into the inactive player if not already loaded
        const nextIndex = (currentIndex + 1) % playlistVideos.length;
        const nextVideo = playlistVideos[nextIndex];
        const inactivePlayerVideo = playerNumber === 1 ? player2Video : player1Video;

        if (playlistVideos.length > 1 && inactivePlayerVideo?.id !== nextVideo.id) {
          console.log(`[Native Play] Pre-loading next song "${nextVideo.title}" into Player ${playerNumber === 1 ? 2 : 1}`);
          if (playerNumber === 1) {
            setPlayer2Video(nextVideo);
            setRestoredVideoIds(prev => ({ ...prev, player2: nextVideo.youtube_id }));
          } else {
            setPlayer1Video(nextVideo);
            setRestoredVideoIds(prev => ({ ...prev, player1: nextVideo.youtube_id }));
          }
        }
      }
    }

    // Clear stopped state when playback starts
    if (isPlaying && isStopped) {
      setIsStopped(false);
    }

    if (syncEnabled) {
      broadcastState({
        player1Video,
        player2Video,
        crossfadeValue,
        player1State: playerStatesRef.current.player1State,
        player2State: playerStatesRef.current.player2State,
      });
    }
  }, [player1Video, player2Video, crossfadeValue, syncEnabled, playlistMode, selectedPlaylist, isStopped]);

  // Handler for time updates from players
  const handleTimeUpdate = useCallback((playerNumber, currentTime, duration) => {
    if (playerNumber === 1) {
      setPlayer1State(prev => ({ ...prev, currentTime, duration }));
    } else {
      setPlayer2State(prev => ({ ...prev, currentTime, duration }));
    }
  }, []);

  // Player control functions
  const togglePlayer1 = () => {
    if (player1Ref.current) {
      if (player1State.playing) {
        player1Ref.current.pause();
      } else {
        player1Ref.current.play();
      }
    }
  };

  const togglePlayer2 = () => {
    if (player2Ref.current) {
      if (player2State.playing) {
        player2Ref.current.pause();
      } else {
        player2Ref.current.play();
      }
    }
  };

  // Toggle the active player (based on crossfade position)
  // If no videos loaded, load from playlist first
  // Also ensures the "next" video is loaded in the inactive player
  const toggleActivePlayer = () => {
    const isPlayer1Active = crossfadeValue < 50;
    const activeVideo = isPlayer1Active ? player1Video : player2Video;
    const inactiveVideo = isPlayer1Active ? player2Video : player1Video;
    const playlistVideos = selectedPlaylist?.videos || [];

    // If no video loaded, try to load from playlist
    if (!activeVideo) {
      if (playlistVideos.length === 0) {
        return; // No videos available
      }
      // Load first video into player 1 (autoplay)
      setPlayer1Video(playlistVideos[0]);
      setRestoredVideoIds(prev => ({ ...prev, player1: null })); // null = autoplay
      // Load second video into player 2 if available (just load, don't play)
      if (playlistVideos.length > 1) {
        setPlayer2Video(playlistVideos[1]);
        setRestoredVideoIds(prev => ({ ...prev, player2: playlistVideos[1].youtube_id })); // youtube_id = load only, no autoplay
      }
      setCrossfadeValue(0); // Ensure player 1 is active
      setAutoPlayEnabled(true);
      return;
    }

    // Check if the inactive player has the correct "next" video (cycles through playlist)
    if (playlistVideos.length > 0) {
      const activeIndex = playlistVideos.findIndex(v => v.id === activeVideo?.id);
      const nextIndex = (activeIndex + 1) % playlistVideos.length;

      if (activeIndex >= 0) {
        const expectedNextVideo = playlistVideos[nextIndex];

        // If inactive player doesn't have the correct next video, load it
        if (inactiveVideo?.id !== expectedNextVideo.id) {
          console.log(`[Play] Loading next video "${expectedNextVideo.title}" into inactive player`);
          if (isPlayer1Active) {
            // Player 1 is active, so load next into Player 2
            setPlayer2Video(expectedNextVideo);
            setRestoredVideoIds(prev => ({ ...prev, player2: expectedNextVideo.youtube_id }));
          } else {
            // Player 2 is active, so load next into Player 1
            setPlayer1Video(expectedNextVideo);
            setRestoredVideoIds(prev => ({ ...prev, player1: expectedNextVideo.youtube_id }));
          }
        }
      }
    }

    // Toggle play/pause on the active player
    if (isPlayer1Active) {
      togglePlayer1();
    } else {
      togglePlayer2();
    }
  };

  // Format time helper
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format playlist duration (handles hours)
  const formatPlaylistDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Auto-play track index (tracks which song in the playlist we're on)
  const [autoPlayIndex, setAutoPlayIndex] = useState(0);
  const [isAutoFading, setIsAutoFading] = useState(false);
  const autoFadeIntervalRef = useRef(null);
  const loadNextVideoTimeoutRef = useRef(null);
  const fadeQueueRef = useRef(0); // Queue of pending fade requests
  // Fade trigger data for broadcast viewers - they animate locally based on this
  const fadeTriggeredRef = useRef(null);

  // Get the auto-play video list (from selected playlist or viewing playlist)
  const autoPlayVideos = selectedPlaylist?.videos || viewingPlaylist?.videos || [];

  // Manual crossfade between the two players
  const skipToNextWithFade = useCallback(() => {
    // If already fading, queue this request
    if (isAutoFading) {
      fadeQueueRef.current++;
      console.log(`[Crossfade] Queued fade request (queue size: ${fadeQueueRef.current})`);
      return;
    }

    // Clear any existing interval
    if (autoFadeIntervalRef.current) {
      clearInterval(autoFadeIntervalRef.current);
    }

    setIsAutoFading(true);

    // Determine which player is currently active based on crossfade position
    const fadingToPlayer2 = crossfadeValue < 50;
    const nextPlayer = fadingToPlayer2 ? 2 : 1;

    // Start the next player
    if (nextPlayer === 1 && player1Ref.current) {
      player1Ref.current.play();
    } else if (nextPlayer === 2 && player2Ref.current) {
      player2Ref.current.play();
    }

    // Fade settings: 8 seconds total, update every 200ms = 40 steps
    const startValue = fadingToPlayer2 ? 0 : 100;
    const endValue = fadingToPlayer2 ? 100 : 0;
    const fadeDuration = 8000; // 8 seconds
    const totalSteps = 40;
    const stepSize = (endValue - startValue) / totalSteps;
    let step = 0;

    // Set fade trigger for broadcast viewers - they will animate locally
    fadeTriggeredRef.current = {
      started_at: Date.now(),
      start_value: startValue,
      end_value: endValue,
      duration: fadeDuration,
    };

    // Immediately sync fade trigger to server so viewers can start animating right away
    if (isBroadcasting && currentUser) {
      syncChannelState(currentUser.id, {
        playlist_id: selectedPlaylist?.id,
        player1_video: player1Video,
        player2_video: player2Video,
        player1_playing: player1State.playing,
        player2_playing: player2State.playing,
        player1_time: player1State.currentTime,
        player2_time: player2State.currentTime,
        crossfade_value: startValue,
        started_at: videoStartedAtRef.current,
        fade_trigger: fadeTriggeredRef.current,
        is_stopped: false, // Never stopped during fade
      }).catch(err => console.error('Failed to sync fade trigger:', err));
    }

    // Set initial position
    setCrossfadeValue(startValue);

    autoFadeIntervalRef.current = setInterval(() => {
      step++;
      const newValue = startValue + (stepSize * step);

      if (step >= totalSteps) {
        // Fade complete
        setCrossfadeValue(endValue);
        clearInterval(autoFadeIntervalRef.current);
        autoFadeIntervalRef.current = null;
        setIsAutoFading(false);
        fadeTriggeredRef.current = null; // Clear fade trigger

        // Pause the player that was faded out
        const finishedPlayerRef = fadingToPlayer2 ? player1Ref : player2Ref;
        const finishedPlayer = fadingToPlayer2 ? 1 : 2;
        console.log(`[Crossfade Complete] Faded to Player ${fadingToPlayer2 ? 2 : 1}, pausing Player ${finishedPlayer}`);
        if (finishedPlayerRef.current) {
          finishedPlayerRef.current.pause();
        }

        // Load next video if auto-queue is enabled (cycles through playlist)
        // Find the video that just started playing (the active player after fade)
        const activePlayer = fadingToPlayer2 ? 2 : 1;
        const nowPlayingVideo = fadingToPlayer2 ? player2Video : player1Video;
        const nowPlayingIndex = autoPlayVideos.findIndex(v => v.id === nowPlayingVideo?.id);
        const nextIndex = autoPlayVideos.length > 0 ? (nowPlayingIndex + 1) % autoPlayVideos.length : -1;

        console.log('[Auto-Queue Check]', {
          autoQueueEnabled,
          playlistLength: autoPlayVideos.length,
          activePlayer,
          nowPlayingVideo: nowPlayingVideo?.title,
          nowPlayingIndex,
          nextIndex,
          cycling: nextIndex < nowPlayingIndex
        });

        if (autoQueueEnabled && autoPlayVideos.length > 0 && nowPlayingIndex >= 0) {
          console.log(`[Auto-Queue] Will load video at index ${nextIndex} into Player ${finishedPlayer} after 1s delay`);
          if (loadNextVideoTimeoutRef.current) {
            clearTimeout(loadNextVideoTimeoutRef.current);
          }
          loadNextVideoTimeoutRef.current = setTimeout(() => {
            loadNextVideoTimeoutRef.current = null;
            const nextVideo = autoPlayVideos[nextIndex];
            console.log(`[Auto-Queue] Loading "${nextVideo?.title}" into Player ${finishedPlayer}`);
            if (finishedPlayer === 1) {
              setPlayer1Video(nextVideo);
              setRestoredVideoIds(prev => ({ ...prev, player1: nextVideo.youtube_id }));
            } else {
              setPlayer2Video(nextVideo);
              setRestoredVideoIds(prev => ({ ...prev, player2: nextVideo.youtube_id }));
            }
          }, 1000);
        } else {
          console.log('[Auto-Queue] Skipped -', !autoQueueEnabled ? 'auto-queue disabled' : nowPlayingIndex < 0 ? 'playing video not in playlist' : 'playlist empty');
        }
      } else {
        setCrossfadeValue(newValue);
      }
    }, 200);
  }, [isAutoFading, crossfadeValue, autoQueueEnabled, autoPlayVideos, player1Video, player2Video]);

  // Process fade queue when a fade completes
  useEffect(() => {
    if (!isAutoFading && fadeQueueRef.current > 0) {
      console.log(`[Crossfade] Processing queued fade (${fadeQueueRef.current} remaining)`);
      fadeQueueRef.current--;
      // Small delay to let state settle before starting next fade
      const timer = setTimeout(() => {
        skipToNextWithFade();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAutoFading, skipToNextWithFade]);

  // Auto-skip to next video after playback error (2 second delay)
  useEffect(() => {
    const activeError = crossfadeValue < 50 ? playerErrors.player1 : playerErrors.player2;

    if (activeError && !errorSkipTimeoutRef.current) {
      // Check if there's a video to fade to
      const hasNextVideo = crossfadeValue < 50 ? !!player2Video : !!player1Video;

      if (hasNextVideo && !isAutoFading) {
        console.log(`[Error Recovery] Will skip to next video in 2 seconds`);
        errorSkipTimeoutRef.current = setTimeout(() => {
          errorSkipTimeoutRef.current = null;
          // Clear the error for the affected player
          setPlayerErrors(prev => ({
            ...prev,
            [crossfadeValue < 50 ? 'player1' : 'player2']: null,
          }));
          skipToNextWithFade();
        }, 2000);
      }
    }

    return () => {
      if (errorSkipTimeoutRef.current) {
        clearTimeout(errorSkipTimeoutRef.current);
        errorSkipTimeoutRef.current = null;
      }
    };
  }, [playerErrors, crossfadeValue, player1Video, player2Video, isAutoFading, skipToNextWithFade]);

  // Save playback state to localStorage when it changes
  useEffect(() => {
    if (player1Video || player2Video || autoPlayEnabled) {
      const state = {
        player1Video,
        player2Video,
        crossfadeValue,
        autoPlayEnabled,
        autoPlayIndex,
      };
      localStorage.setItem('barmania_playback_state', JSON.stringify(state));
    }
  }, [player1Video, player2Video, crossfadeValue, autoPlayEnabled, autoPlayIndex]);

  // Cleanup interval and timeout on unmount only
  useEffect(() => {
    return () => {
      if (autoFadeIntervalRef.current) {
        clearInterval(autoFadeIntervalRef.current);
      }
      if (loadNextVideoTimeoutRef.current) {
        clearTimeout(loadNextVideoTimeoutRef.current);
      }
    };
  }, []);

  // Auto-crossfade effect - watch for songs nearing end
  useEffect(() => {
    if (!autoPlayEnabled || isAutoFading) return;

    const activeState = crossfadeValue < 50 ? player1State : player2State;
    const remainingTime = activeState.duration - activeState.currentTime;

    // Start crossfade when 10 seconds remaining (and song is at least 20 seconds long)
    if (activeState.duration > 20 && remainingTime <= 10 && remainingTime > 0) {
      // Determine direction based on which player is currently active
      const fadingToPlayer2 = crossfadeValue < 50;
      const nextPlayerRef = fadingToPlayer2 ? player2Ref : player1Ref;
      const nextVideo = fadingToPlayer2 ? player2Video : player1Video;

      // Don't start fade if next player has no video
      if (!nextVideo) return;

      // Ensure next player is playing before we start fading
      if (nextPlayerRef.current) {
        nextPlayerRef.current.play();
      }

      setIsAutoFading(true);

      const startValue = fadingToPlayer2 ? 0 : 100;
      const endValue = fadingToPlayer2 ? 100 : 0;
      const fadeStep = fadingToPlayer2 ? 6.25 : -6.25; // 100/16 steps over ~8 seconds
      const fadeDuration = 8000; // 8 seconds

      // Set fade trigger for broadcast viewers - they will animate locally
      fadeTriggeredRef.current = {
        started_at: Date.now(),
        start_value: startValue,
        end_value: endValue,
        duration: fadeDuration,
      };

      // Immediately sync fade trigger to server so viewers can start animating right away
      if (isBroadcasting && currentUser) {
        syncChannelState(currentUser.id, {
          playlist_id: selectedPlaylist?.id,
          player1_video: player1Video,
          player2_video: player2Video,
          player1_playing: player1State.playing,
          player2_playing: player2State.playing,
          player1_time: player1State.currentTime,
          player2_time: player2State.currentTime,
          crossfade_value: startValue,
          started_at: videoStartedAtRef.current,
          fade_trigger: fadeTriggeredRef.current,
          is_stopped: false, // Never stopped during fade
        }).catch(err => console.error('Failed to sync auto-fade trigger:', err));
      }

      // Start from clean extreme
      let currentFade = startValue;
      setCrossfadeValue(startValue);

      autoFadeIntervalRef.current = setInterval(() => {
        currentFade += fadeStep;

        if ((fadingToPlayer2 && currentFade >= 100) || (!fadingToPlayer2 && currentFade <= 0)) {
          // Fade complete - set to exact end value
          setCrossfadeValue(endValue);
          clearInterval(autoFadeIntervalRef.current);
          autoFadeIntervalRef.current = null;
          setIsAutoFading(false);
          fadeTriggeredRef.current = null; // Clear fade trigger

          // Stop the player that just finished (faded out)
          const finishedPlayerRef = fadingToPlayer2 ? player1Ref : player2Ref;
          const finishedPlayer = fadingToPlayer2 ? 1 : 2;
          const finishedVideo = fadingToPlayer2 ? player1Video : player2Video;

          if (finishedPlayerRef.current) {
            finishedPlayerRef.current.pause();
          }

          // Mark the finished player's current video as "restored" so autoStart is false
          // This prevents unnecessary re-renders when other state changes
          if (finishedVideo) {
            setRestoredVideoIds(prev => ({
              ...prev,
              [finishedPlayer === 1 ? 'player1' : 'player2']: finishedVideo.youtube_id
            }));
          }

          // Load next song on the finished player after 1 second (if auto-queue enabled)
          if (autoQueueEnabled) {
            const nextIndex = autoPlayIndex + 2;

            if (nextIndex < autoPlayVideos.length) {
              // Clear any pending load timeout
              if (loadNextVideoTimeoutRef.current) {
                clearTimeout(loadNextVideoTimeoutRef.current);
              }
              loadNextVideoTimeoutRef.current = setTimeout(() => {
                loadNextVideoTimeoutRef.current = null;
                const nextVideo = autoPlayVideos[nextIndex];
                if (finishedPlayer === 1) {
                  setPlayer1Video(nextVideo);
                  setRestoredVideoIds(prev => ({ ...prev, player1: nextVideo.youtube_id }));
                } else {
                  setPlayer2Video(nextVideo);
                  setRestoredVideoIds(prev => ({ ...prev, player2: nextVideo.youtube_id }));
                }
              }, 1000);
              setAutoPlayIndex(prev => prev + 1);
            }
          }
        } else {
          setCrossfadeValue(currentFade);
        }
      }, 500); // Update every 500ms
    }
  }, [autoPlayEnabled, isAutoFading, crossfadeValue, player1State, player2State, autoPlayIndex, autoPlayVideos, autoQueueEnabled, player1Video, player2Video]);

  // Get the "active" player based on crossfade
  const activePlayer = crossfadeValue < 50 ? 1 : 2;
  const activeVideo = activePlayer === 1 ? player1Video : player2Video;
  const activePlayerState = activePlayer === 1 ? player1State : player2State;
  const seekMax = activePlayerState.duration || 0;
  const seekDisplayTime = (() => {
    if (isSeeking) return seekValue;
    const hold = seekHoldRef.current;
    if (hold && Date.now() < hold.until) return hold.time;
    return activePlayerState.currentTime;
  })();

  useEffect(() => {
    if (isSeeking) return;
    const hold = seekHoldRef.current;
    if (hold && Date.now() < hold.until) return;
    setSeekValue(activePlayerState.currentTime || 0);
  }, [activePlayerState.currentTime, activePlayerState.duration, activePlayer, isSeeking]);

  const handleSeekCommit = useCallback((time) => {
    const playerRef = activePlayer === 1 ? player1Ref : player2Ref;
    const max = activePlayerState.duration || 0;
    if (!playerRef.current || !max) return;
    const clamped = Math.max(0, Math.min(time, max));
    playerRef.current.seekTo?.(clamped, true);
    setSeekValue(clamped);
    return clamped;
  }, [activePlayer, activePlayerState.duration]);

  const commitSeek = useCallback(() => {
    if (!isSeeking) return;
    const committed = handleSeekCommit(seekValue);
    setIsSeeking(false);
    if (typeof committed === 'number') {
      seekHoldRef.current = { time: committed, until: Date.now() + 800 };
    }
  }, [handleSeekCommit, isSeeking, seekValue]);

  // Next video is the one after the currently active video in the playlist
  const activeVideoIndex = autoPlayVideos.findIndex(v => v.id === activeVideo?.id);
  const nextVideo = activeVideoIndex >= 0 && activeVideoIndex + 1 < autoPlayVideos.length
    ? autoPlayVideos[activeVideoIndex + 1]
    : null;

  // Calculate remaining playlist time, count, and total time
  const playlistRemainingInfo = (() => {
    // Total playlist duration (all videos)
    const totalTime = autoPlayVideos.reduce((sum, v) => sum + (v.duration || 0), 0);

    if (activeVideoIndex < 0 || autoPlayVideos.length === 0) {
      return { time: 0, count: 0, totalTime };
    }
    // Remaining videos after the current one
    const remainingVideos = autoPlayVideos.slice(activeVideoIndex + 1);
    const remainingCount = remainingVideos.length;
    // Sum durations of remaining videos
    const remainingDuration = remainingVideos.reduce((sum, v) => sum + (v.duration || 0), 0);
    // Add remaining time in current song
    const currentRemaining = Math.max(0, (activePlayerState.duration || 0) - (activePlayerState.currentTime || 0));
    return {
      time: Math.round(remainingDuration + currentRemaining),
      count: remainingCount,
      totalTime
    };
  })();

  return (
    <div className="min-h-screen">
      {/* User Selection Modal */}
      <UserSelector />

      {/* Account Settings Modal */}
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

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
      <PartyModal
        isOpen={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        playlists={playlists}
        showNotification={showNotification}
        onOpenAsHost={(liveResult) => {
          navigate(`/live/${liveResult.share_code}?host=${liveResult.host_code}`);
        }}
      />

      {/* Publish Modal with QR Code */}
      <PublishModal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        playlist={selectedPlaylist}
        onPlaylistUpdated={(updated) => {
          setSelectedPlaylist(updated);
          if (viewingPlaylist?.id === selectedPlaylist.id) {
            setViewingPlaylist(updated);
          }
        }}
        showNotification={showNotification}
        loadPlaylists={loadPlaylists}
      />

      {/* Broadcast Modal */}
      <BroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        playlistName={selectedPlaylist?.name || ''}
        broadcastHash={broadcastHash}
        broadcastCode={broadcastCode}
        onStopBroadcast={async () => {
          try {
            await stopChannelBroadcast(currentUser.id);
            setIsBroadcasting(false);
            setBroadcastHash(null);
            setBroadcastCode(null);
            setShowBroadcastModal(false);
            showNotification('Broadcast stopped');
          } catch (error) {
            console.error('Failed to stop broadcast:', error);
            showNotification('Failed to stop broadcast', 'error');
          }
        }}
        showNotification={showNotification}
      />

      {/* Playlist Settings Modal */}
      <PlaylistSettingsModal
        isOpen={showPlaylistSettings}
        onClose={() => setShowPlaylistSettings(false)}
        playlist={selectedPlaylist}
        onPlaylistUpdated={async () => {
          if (selectedPlaylist) {
            const updated = await getPlaylist(selectedPlaylist.id);
            setSelectedPlaylist(updated);
          }
        }}
        showNotification={showNotification}
      />

      {/* Playlist Selection Modal */}
      <PlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        playlists={playlists}
        selectedPlaylist={selectedPlaylist}
        viewingPlaylist={viewingPlaylist}
        currentUser={currentUser}
        onSelectPlaylist={handleSelectPlaylistFromModal}
        onPlaylistCreated={(playlist) => {
          handleSelectPlaylistFromModal(playlist.id);
        }}
        onPlaylistDeleted={(playlist) => {
          if (selectedPlaylist?.id === playlist.id) {
            setSelectedPlaylist(null);
          }
          if (viewingPlaylist?.id === playlist.id) {
            setViewingPlaylist(null);
          }
        }}
        onPlaylistUpdated={(updated) => {
          setSelectedPlaylist(updated);
          if (viewingPlaylist?.id === updated.id) {
            setViewingPlaylist(updated);
          }
          setShowPlaylistModal(false);
        }}
        showNotification={showNotification}
        loadPlaylists={loadPlaylists}
        updateUser={updateUser}
      />

      <header className="sticky top-0 z-50 bg-black/30 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent flex-shrink-0">
              BARMANIA
            </h1>

            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Current User Display */}
              {currentUser && (
                <button
                  onClick={() => setShowAccountSettings(true)}
                  className="flex items-center gap-2 flex-shrink-0 p-1.5 -m-1.5 rounded-xl hover:bg-white/10 transition-colors"
                  title="Account Settings"
                >
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {currentUser.name.charAt(0)}
                    </div>
                  )}
                  <span className="text-white text-sm hidden md:inline">{currentUser.name}</span>
                  <svg className="w-4 h-4 text-purple-300/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
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
              {/* Channel Section */}
              <ChannelSection
                currentUser={currentUser}
                isBroadcasting={isBroadcasting}
                broadcastCode={broadcastCode}
                viewerCount={viewerCount}
                selectedPlaylist={selectedPlaylist}
                onBroadcastStart={(result) => {
                  setIsBroadcasting(true);
                  setBroadcastHash(result.channel.hash);
                  setBroadcastCode(result.channel.broadcast_code);
                  setChannel(result.channel);
                }}
                onBroadcastStop={() => {
                  setIsBroadcasting(false);
                  setBroadcastHash(null);
                  setBroadcastCode(null);
                }}
                onShowBroadcastModal={() => setShowBroadcastModal(true)}
                showNotification={showNotification}
              />

              {/* Stacked Video Players - opacity controlled by crossfade */}
              <div
                ref={playerContainerRef}
                className={`relative overflow-hidden ${
                  isFullscreen
                    ? 'w-screen h-screen bg-black cursor-none'
                    : 'aspect-video rounded-xl border-2 border-purple-500/50 shadow-lg shadow-purple-500/20'
                } ${isFullscreen && showFullscreenControls ? '!cursor-default' : ''}`}
                onMouseMove={handleFullscreenActivity}
                onTouchStart={handleFullscreenActivity}
                onClick={handleFullscreenActivity}
              >
                {/* Player 1 - bottom layer (pointer-events disabled when not active) */}
                <div
                  className={`absolute inset-0 transition-opacity duration-300 ${crossfadeValue >= 50 ? 'pointer-events-none' : ''}`}
                  style={{ opacity: (100 - crossfadeValue) / 100 }}
                >
                  <VideoPlayer
                    ref={player1Ref}
                    video={player1Video}
                    volume={djMuted ? 0 : 100 - crossfadeValue}
                    playerNumber={1}
                    isActive={crossfadeValue < 50}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handlePlaylistVideoEnded}
                    onStateUpdate={handlePlayerStateUpdate}
                    onError={handlePlayerError}
                    autoStart={player1Video?.youtube_id !== restoredVideoIds.player1}
                    onAddToPlaylist={selectedPlaylist ? (videoId) => handleAddToPlaylist(videoId, selectedPlaylist.id) : null}
                    isInPlaylist={selectedPlaylist?.videos?.some(v => v.id === player1Video?.id)}
                    onVideoDrop={handleQueueToPlaylist}
                    showDropOverlay={isGlobalDragging}
                    hideOverlays={isFullscreen}
                  />
                </div>

                {/* Player 2 - top layer (pointer-events disabled when not active) */}
                <div
                  className={`absolute inset-0 transition-opacity duration-300 ${crossfadeValue < 50 ? 'pointer-events-none' : ''}`}
                  style={{ opacity: crossfadeValue / 100 }}
                >
                  <VideoPlayer
                    ref={player2Ref}
                    video={player2Video}
                    volume={djMuted ? 0 : crossfadeValue}
                    playerNumber={2}
                    isActive={crossfadeValue >= 50}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handlePlaylistVideoEnded}
                    onStateUpdate={handlePlayerStateUpdate}
                    onError={handlePlayerError}
                    autoStart={player2Video?.youtube_id !== restoredVideoIds.player2}
                    onAddToPlaylist={selectedPlaylist ? (videoId) => handleAddToPlaylist(videoId, selectedPlaylist.id) : null}
                    onVideoDrop={handleQueueToPlaylist}
                    isInPlaylist={selectedPlaylist?.videos?.some(v => v.id === player2Video?.id)}
                    showDropOverlay={isGlobalDragging}
                    hideOverlays={isFullscreen}
                  />
                </div>

                {/* Idle image overlay - shown when stopped or no videos */}
                {selectedPlaylist?.idle_image_url && (
                  isStopped ||
                  (!player1Video && !player2Video) ||
                  (!player1State.playing && !player2State.playing && !isAutoFading)
                ) && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
                    <img
                      src={selectedPlaylist.idle_image_url}
                      alt="Idle screen"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}

                {/* Fullscreen tap overlay - captures taps when controls are hidden */}
                {isFullscreen && !showFullscreenControls && (
                  <div
                    className="absolute inset-0 z-50 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFullscreenActivity();
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleFullscreenActivity();
                    }}
                  />
                )}

                {/* DJ control buttons - hidden in fullscreen */}
                {!isFullscreen && (
                  <div className="absolute top-2 right-2 z-20 flex gap-2">
                    {/* Fullscreen button */}
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-lg backdrop-blur-sm transition-all bg-black/50 text-white/70 hover:bg-black/70 hover:text-white"
                      title="Fullscreen"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                      </svg>
                    </button>

                    {/* Mute button */}
                    <button
                      onClick={() => setDjMuted(!djMuted)}
                      className={`p-2 rounded-lg backdrop-blur-sm transition-all ${
                        djMuted
                          ? 'bg-red-500/80 text-white'
                          : 'bg-black/50 text-white/70 hover:bg-black/70 hover:text-white'
                      }`}
                      title={djMuted ? 'Unmute (DJ only)' : 'Mute (DJ only)'}
                    >
                      {djMuted ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      )}
                    </button>
                  </div>
                )}

                {/* Next up indicator - hidden in fullscreen */}
                {!isFullscreen && (player1Video || player2Video) && (
                  <div className="absolute bottom-2 right-2 z-20 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs text-white/80 flex items-center gap-2">
                    <span className="text-white/50">Next:</span>
                    <span className="font-medium truncate max-w-32">
                      {crossfadeValue < 50 ? (player2Video?.title || 'None') : (player1Video?.title || 'None')}
                    </span>
                  </div>
                )}

                {/* Fullscreen control bar - appears on mouse/touch activity */}
                {isFullscreen && (
                  <div
                    className={`absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ${
                      showFullscreenControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'
                    }`}
                  >
                    <div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-6 px-6">
                      {/* Song info */}
                      <div className="mb-4">
                        <p className="text-white text-lg font-medium truncate">
                          {activeVideo?.title || 'No video playing'}
                        </p>
                        <p className="text-white/50 text-sm">
                          {formatTime(activePlayerState.currentTime)} / {formatTime(activePlayerState.duration)}
                        </p>
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center gap-4">
                        {/* Play/Pause */}
                        <button
                          onClick={() => {
                            setIsStopped(false);
                            toggleActivePlayer();
                          }}
                          className="w-14 h-14 flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform"
                        >
                          {activePlayerState.playing ? (
                            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                              <rect x="6" y="5" width="4" height="14" rx="1" />
                              <rect x="14" y="5" width="4" height="14" rx="1" />
                            </svg>
                          ) : (
                            <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                        </button>

                        {/* Fade to Next */}
                        <button
                          onClick={skipToNextWithFade}
                          disabled={isAutoFading || !(activePlayer === 1 ? player2Video : player1Video)}
                          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                            !isAutoFading && (activePlayer === 1 ? player2Video : player1Video)
                              ? 'bg-white/20 text-white hover:bg-white/30'
                              : 'bg-white/10 text-white/30 cursor-not-allowed'
                          }`}
                          title="Fade to next"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5v14l7-7zM12 5v14l7-7z" />
                          </svg>
                        </button>

                        {/* Mute */}
                        <button
                          onClick={() => setDjMuted(!djMuted)}
                          className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                            djMuted ? 'bg-red-500/50 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                          }`}
                        >
                          {djMuted ? (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            </svg>
                          )}
                        </button>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Exit fullscreen */}
                        <button
                          onClick={toggleFullscreen}
                          className="w-12 h-12 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
                          title="Exit fullscreen"
                        >
                          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <div className="flex items-center gap-3 text-xs text-purple-200/70">
                  <span className="tabular-nums">{formatTime(seekDisplayTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={seekMax || 0}
                    step={0.1}
                    value={Math.min(seekDisplayTime, seekMax || 0)}
                    disabled={!seekMax}
                    onChange={(e) => {
                      if (!isSeeking) setIsSeeking(true);
                      setSeekValue(Number(e.target.value));
                    }}
                    onPointerDown={() => setIsSeeking(true)}
                    onPointerUp={commitSeek}
                    onPointerCancel={commitSeek}
                    onKeyUp={commitSeek}
                    onBlur={() => {
                      commitSeek();
                    }}
                    className="w-full h-1 rounded-lg appearance-none bg-white/20 accent-purple-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                    aria-label="Seek"
                  />
                  <span className="tabular-nums">{formatTime(seekMax)}</span>
                </div>
              </div>

              {/* Combined Playlist & Playback Controls */}
              <div className={`bg-white/5 backdrop-blur-xl rounded-xl border transition-all ${autoPlayEnabled ? 'border-green-500/30' : 'border-white/10'} overflow-hidden`}>
                {/* Playlist Header */}
                <div className="p-3 flex items-center gap-3 border-b border-white/10">
                  <div
                    onClick={() => setShowPlaylistModal(true)}
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      {selectedPlaylist ? (
                        <>
                          <p className="text-white font-medium text-sm truncate">{selectedPlaylist.name}</p>
                          <p className="text-purple-300/60 text-xs">
                            {selectedPlaylist.videos?.length || 0} songs
                            {playlistRemainingInfo.totalTime > 0 && (
                              <span className="ml-1">· {formatPlaylistDuration(playlistRemainingInfo.totalTime)}</span>
                            )}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-white font-medium text-sm">Select Playlist</p>
                          <p className="text-purple-300/60 text-xs">Choose or create a playlist</p>
                        </>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-purple-300/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                    </svg>
                  </div>

                  {/* Settings Button */}
                  {selectedPlaylist && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowPlaylistSettings(true);
                      }}
                      className="p-2 rounded-lg bg-white/10 text-purple-300/60 hover:bg-white/20 hover:text-white transition-all flex-shrink-0"
                      title="Playlist Settings"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}

                </div>

                {/* Playback Controls */}
                <PlaybackControls
                  activeVideo={activeVideo}
                  activePlayer={activePlayer}
                  activePlayerState={activePlayerState}
                  formatTime={formatTime}
                  onPlayPause={() => {
                    setIsStopped(false);
                    toggleActivePlayer();
                  }}
                  onStop={() => {
                    if (player1Ref.current) player1Ref.current.pause();
                    if (player2Ref.current) player2Ref.current.pause();
                    setIsStopped(true);
                  }}
                  onSkipToNext={skipToNextWithFade}
                  isStopped={isStopped}
                  isAutoFading={isAutoFading}
                  hasVideoToFadeTo={activePlayer === 1 ? !!player2Video : !!player1Video}
                  hasPlaylistVideos={!!selectedPlaylist?.videos?.length}
                  autoQueueEnabled={autoQueueEnabled}
                  onToggleAutoQueue={() => setAutoQueueEnabled(prev => !prev)}
                  nextVideo={nextVideo}
                />
              </div>

              {(playerErrors.player1 || playerErrors.player2) && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  <div className="text-[10px] uppercase tracking-wide text-red-300/70">
                    Player Errors
                  </div>
                  {playerErrors.player1 && (
                    <div className="mt-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-300">P1</span>
                        <span className="text-red-100/90">{playerErrors.player1.message}</span>
                        {playerErrors.player1.code && (
                          <span className="text-red-300/60">({playerErrors.player1.code})</span>
                        )}
                      </div>
                      <div className="text-red-200/60 truncate">{playerErrors.player1.videoTitle}</div>
                    </div>
                  )}
                  {playerErrors.player2 && (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-red-300">P2</span>
                        <span className="text-red-100/90">{playerErrors.player2.message}</span>
                        {playerErrors.player2.code && (
                          <span className="text-red-300/60">({playerErrors.player2.code})</span>
                        )}
                      </div>
                      <div className="text-red-200/60 truncate">{playerErrors.player2.videoTitle}</div>
                    </div>
                  )}
                  <div className="mt-2 text-[10px] text-red-200/60">
                    If you are on a VPN, YouTube may block playback.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Video List */}
          <div className="lg:col-span-8">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* YouTube Search with Autocomplete Dropdown */}
              <YouTubeSearchBar
                searchQuery={youtubeSearchQuery}
                onSearchInput={handleYoutubeSearchInput}
                searchResults={youtubeSearchResults}
                searchLoading={youtubeSearchLoading}
                showDropdown={showYoutubeDropdown}
                onShowDropdown={() => setShowYoutubeDropdown(true)}
                onHideDropdown={() => setShowYoutubeDropdown(false)}
                importingVideoId={importingVideoId}
                onAddVideo={(video) => {
                  handleAddYoutubeToLibrary(video, !!selectedPlaylist);
                  setShowYoutubeDropdown(false);
                }}
                selectedPlaylistName={selectedPlaylist?.name}
                clipboardYoutubeUrl={clipboardYoutubeUrl}
                onUseClipboardUrl={() => {
                  handleYoutubeSearchInput(clipboardYoutubeUrl);
                  setShowYoutubeDropdown(true);
                  setClipboardYoutubeUrl(null);
                }}
                onClearSearch={clearYoutubeSearch}
              />

              {/* Playlist / Library Tabs */}
              <div className="border-b border-white/10">
                <div className="flex">
                  <div
                    onDragOver={handlePlaylistTabDragOver}
                    onDragLeave={handlePlaylistTabDragLeave}
                    onDrop={handlePlaylistTabDrop}
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                      viewMode === 'playlist'
                        ? 'text-white border-b-2 border-pink-500 bg-pink-500/10'
                        : 'text-purple-300/60 hover:text-white hover:bg-white/5'
                    } ${!selectedPlaylist ? 'opacity-50' : 'cursor-pointer'} ${
                      isPlaylistTabDragOver ? 'ring-2 ring-green-500 bg-green-500/20' : ''
                    }`}
                  >
                    {selectedPlaylist ? (
                      editingPlaylistName && viewMode === 'playlist' ? (
                        <input
                          ref={playlistNameInputRef}
                          type="text"
                          value={editedPlaylistName}
                          onChange={(e) => setEditedPlaylistName(e.target.value)}
                          onBlur={savePlaylistName}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') savePlaylistName();
                            if (e.key === 'Escape') cancelEditingPlaylistName();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-white/10 border border-pink-500 rounded px-2 py-0.5 text-white text-sm text-center focus:outline-none"
                        />
                      ) : (
                        <span
                          className="flex items-center justify-center gap-2"
                          onClick={() => {
                            if (viewMode === 'playlist') {
                              startEditingPlaylistName();
                            } else if (selectedPlaylist) {
                              setViewMode('playlist', selectedPlaylist.hash);
                              setViewingPlaylist(selectedPlaylist);
                            }
                          }}
                          title={viewMode === 'playlist' ? 'Click to rename' : 'Click to view playlist'}
                        >
                          <span className="truncate max-w-[120px]">{selectedPlaylist.name}</span>
                          <span className="text-xs opacity-60">({selectedPlaylist.videos?.length || 0})</span>
                        </span>
                      )
                    ) : (
                      <span className="cursor-not-allowed">Playlist</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setViewMode('categories');
                      setViewingPlaylist(null);
                    }}
                    className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${
                      viewMode === 'categories'
                        ? 'text-white border-b-2 border-purple-500 bg-purple-500/10'
                        : 'text-purple-300/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Library
                  </button>
                </div>

                {/* Category filter for Library view */}
                {viewMode === 'categories' && (
                  <CategoryFilter
                    categories={categories}
                    selectedCategory={selectedCategory}
                    onSelect={handleCategorySelect}
                  />
                )}
              </div>

              {/* Video List */}
              {loading && viewMode === 'categories' ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : viewMode === 'playlist' && viewingPlaylist ? (
                <PlaylistVideoList
                  videos={displayVideos}
                  onReorder={handleReorderPlaylist}
                  onRemove={(videoId) => handleRemoveFromPlaylist(videoId, viewingPlaylist.id)}
                  activeVideoId={(player1State.playing || player2State.playing) ? activeVideo?.id : null}
                  onQueue={(video) => {
                    // Check if nothing is currently playing
                    const isAnythingPlaying = player1State.playing || player2State.playing;

                    if (!isAnythingPlaying) {
                      // Nothing playing: load into player 1 and play directly
                      console.log(`[Queue] Direct play "${video.title}" in Player 1 (nothing playing)`);
                      setPlayer1Video(video);
                      setRestoredVideoIds(prev => ({ ...prev, player1: null })); // null = autoplay
                      setCrossfadeValue(0); // Player 1 is now active
                    } else {
                      // Something is playing: queue in inactive player (no fade)
                      const activePlayerNumber = crossfadeValue < 50 ? 1 : 2;
                      const inactivePlayer = activePlayerNumber === 1 ? 2 : 1;
                      console.log(`[Queue] Loading "${video.title}" into Player ${inactivePlayer}`);
                      if (inactivePlayer === 1) {
                        setPlayer1Video(video);
                        setRestoredVideoIds(prev => ({ ...prev, player1: video.youtube_id }));
                      } else {
                        setPlayer2Video(video);
                        setRestoredVideoIds(prev => ({ ...prev, player2: video.youtube_id }));
                      }
                    }
                    // Set playlist mode
                    setActivePlaylist(viewingPlaylist);
                    setPlaylistMode(true);
                    setAutoPlayEnabled(true);
                  }}
                  onPlay={(video, index) => {
                    // Check if nothing is currently playing (no need to fade)
                    const isAnythingPlaying = player1State.playing || player2State.playing;
                    const playlistVideos = viewingPlaylist?.videos || [];

                    if (!isAnythingPlaying) {
                      // Nothing playing: load into player 1 and play directly (no fade needed)
                      console.log(`[Play] Direct play "${video.title}" in Player 1 (nothing playing)`);
                      setPlayer1Video(video);
                      setRestoredVideoIds(prev => ({ ...prev, player1: null })); // null = autoplay
                      setCrossfadeValue(0); // Player 1 is now active

                      // Load next song into player 2 (if available)
                      const nextIndex = (index + 1) % playlistVideos.length;
                      if (playlistVideos.length > 1 && nextIndex !== index) {
                        const nextVideo = playlistVideos[nextIndex];
                        console.log(`[Play] Pre-loading next song "${nextVideo.title}" in Player 2`);
                        setPlayer2Video(nextVideo);
                        setRestoredVideoIds(prev => ({ ...prev, player2: nextVideo.youtube_id })); // Don't autoplay
                      }
                    } else {
                      // Something is playing: queue in inactive player and fade to it
                      const activePlayerNumber = crossfadeValue < 50 ? 1 : 2;
                      const inactivePlayer = activePlayerNumber === 1 ? 2 : 1;
                      console.log(`[Play] Loading "${video.title}" into Player ${inactivePlayer} and fading`);
                      if (inactivePlayer === 1) {
                        setPlayer1Video(video);
                        setRestoredVideoIds(prev => ({ ...prev, player1: null })); // null = autoplay
                      } else {
                        setPlayer2Video(video);
                        setRestoredVideoIds(prev => ({ ...prev, player2: null })); // null = autoplay
                      }
                      // Start fade after a short delay to let the video load
                      setTimeout(() => {
                        skipToNextWithFade();
                      }, 500);
                    }
                    // Set playlist mode
                    setActivePlaylist(viewingPlaylist);
                    setPlaylistMode(true);
                    setAutoPlayEnabled(true);
                  }}
                />
              ) : (
                <VideoList
                  videos={displayVideos}
                  onShowAddModal={(video) => {
                    setAddVideoModal(video);
                    setShowPlaylistSubmenu(false);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Add Video Modal */}
      <AddVideoModal
        video={addVideoModal}
        onClose={() => setAddVideoModal(null)}
        onPlayVideo={handlePlayVideo}
        onAddToPlaylist={handleAddToPlaylist}
        onRemoveFromPlaylist={handleRemoveFromPlaylist}
        selectedPlaylist={selectedPlaylist}
        viewingPlaylist={viewingPlaylist}
        viewMode={viewMode}
        playlists={playlists}
        player1Playing={player1State.playing}
        player2Playing={player2State.playing}
      />
    </div>
  );
}

export default App;
