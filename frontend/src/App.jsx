import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getCategories, getVideos, getPlaylists, getPublicPlaylists, getPlaylist, addVideoToPlaylist, removeVideoFromPlaylist, reorderPlaylistVideos, createPlaylist, updatePlaylist, deletePlaylist, goLivePlaylist, searchYouTube, getYouTubeVideo, importYouTubeVideo, extractYouTubeVideoId, startBroadcast, stopBroadcast, syncBroadcastState } from './services/api';
import { initEcho, broadcastState } from './services/playerSync';
import { useUser } from './contexts/UserContext';
import CategoryFilter from './components/CategoryFilter';
import VideoList from './components/VideoList';
import PlaylistVideoList from './components/PlaylistVideoList';
import VideoPlayer from './components/VideoPlayer';
import Crossfader from './components/Crossfader';
import UserSelector from './components/UserSelector';
import BroadcastModal from './components/BroadcastModal';
import YouTubePlaylistImport from './components/YouTubePlaylistImport';
import AccountSettings from './components/AccountSettings';
import PlaylistSettingsModal from './components/PlaylistSettingsModal';

function App() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Broadcast state
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastHash, setBroadcastHash] = useState(null);
  const [broadcastCode, setBroadcastCode] = useState(null);
  const broadcastSyncTimeoutRef = useRef(null);
  const videoStartedAtRef = useRef(null); // Timestamp when current video started playing

  // Stopped state (shows idle screen in viewer)
  const [isStopped, setIsStopped] = useState(false);

  // DJ mute state (local only, doesn't affect viewers)
  const [djMuted, setDjMuted] = useState(false);

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
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

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

  // Reload playlists when user changes
  useEffect(() => {
    if (currentUser) {
      loadPlaylists();
    } else {
      setPlaylists([]);
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
    if (!isBroadcasting || !selectedPlaylist) return;

    // Clear any pending sync
    if (broadcastSyncTimeoutRef.current) {
      clearTimeout(broadcastSyncTimeoutRef.current);
    }

    // Debounce sync
    broadcastSyncTimeoutRef.current = setTimeout(async () => {
      // Send position-based video assignments and individual player states
      try {
        await syncBroadcastState(selectedPlaylist.id, {
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
  }, [isBroadcasting, selectedPlaylist, player1Video, player2Video, crossfadeValue, player1State.playing, player2State.playing, player1State.currentTime, player2State.currentTime, isStopped]);

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
    if (isBroadcasting && selectedPlaylist) {
      stopBroadcast(selectedPlaylist.id).catch(() => {});
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

      // Restore broadcasting state if playlist is broadcasting
      if (playlist.is_broadcasting) {
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
      } else {
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
  }, [setViewMode]);

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

  // Auto-play track index (tracks which song in the playlist we're on)
  const [autoPlayIndex, setAutoPlayIndex] = useState(0);
  const [isAutoFading, setIsAutoFading] = useState(false);
  const autoFadeIntervalRef = useRef(null);
  const loadNextVideoTimeoutRef = useRef(null);
  // Fade trigger data for broadcast viewers - they animate locally based on this
  const fadeTriggeredRef = useRef(null);

  // Get the auto-play video list (from selected playlist or viewing playlist)
  const autoPlayVideos = selectedPlaylist?.videos || viewingPlaylist?.videos || [];

  // Manual crossfade between the two players
  const skipToNextWithFade = useCallback(() => {
    // Don't start if already fading
    if (isAutoFading) {
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
    if (isBroadcasting && selectedPlaylist) {
      syncBroadcastState(selectedPlaylist.id, {
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
      if (isBroadcasting && selectedPlaylist) {
        syncBroadcastState(selectedPlaylist.id, {
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

  // Next video is the one after the currently active video in the playlist
  const activeVideoIndex = autoPlayVideos.findIndex(v => v.id === activeVideo?.id);
  const nextVideo = activeVideoIndex >= 0 && activeVideoIndex + 1 < autoPlayVideos.length
    ? autoPlayVideos[activeVideoIndex + 1]
    : null;

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

      {/* Publish Modal with QR Code */}
      {showPublishModal && selectedPlaylist && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowPublishModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8 max-w-md w-full mx-4 shadow-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowPublishModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center">
              <div className="mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  Playlist Published!
                </h2>
                <p className="text-purple-200/70 text-sm mt-1">
                  "{selectedPlaylist.name}" is now public
                </p>
              </div>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                <QRCodeSVG
                  value={`${window.location.origin}/watch?pl=${selectedPlaylist.hash}`}
                  size={180}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* URL Display */}
              <div className="bg-black/30 rounded-xl p-3 mb-4">
                <p className="text-purple-300/60 text-xs mb-1 uppercase tracking-wide">Share this URL</p>
                <p className="text-white font-mono text-sm break-all select-all">
                  {`${window.location.origin}/watch?pl=${selectedPlaylist.hash}`}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/watch?pl=${selectedPlaylist.hash}`);
                    showNotification('URL copied to clipboard!');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy URL
                </button>
                <button
                  onClick={async () => {
                    try {
                      await updatePlaylist(selectedPlaylist.id, { is_public: false });
                      const updated = await getPlaylist(selectedPlaylist.id);
                      setSelectedPlaylist(updated);
                      if (viewingPlaylist?.id === selectedPlaylist.id) {
                        setViewingPlaylist(updated);
                      }
                      loadPlaylists();
                      setShowPublishModal(false);
                      showNotification('Playlist unpublished');
                    } catch (error) {
                      console.error('Failed to unpublish:', error);
                      showNotification('Failed to unpublish', 'error');
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Unpublish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      <BroadcastModal
        isOpen={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        playlistName={selectedPlaylist?.name || ''}
        broadcastHash={broadcastHash}
        broadcastCode={broadcastCode}
        onStopBroadcast={async () => {
          try {
            await stopBroadcast(selectedPlaylist.id);
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
      {showPlaylistModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowPlaylistModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-6 max-w-md w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col">
            {/* Close button */}
            <button
              onClick={() => setShowPlaylistModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Select Playlist
              </h2>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/10 rounded-xl mb-4">
              <button
                onClick={() => handlePlaylistModalTabChange('my')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  playlistModalTab === 'my'
                    ? 'bg-purple-500 text-white'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                My Playlists
              </button>
              <button
                onClick={() => handlePlaylistModalTabChange('public')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  playlistModalTab === 'public'
                    ? 'bg-purple-500 text-white'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                Public
              </button>
              <button
                onClick={() => handlePlaylistModalTabChange('create')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  playlistModalTab === 'create'
                    ? 'bg-purple-500 text-white'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                Create
              </button>
              <button
                onClick={() => handlePlaylistModalTabChange('import')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  playlistModalTab === 'import'
                    ? 'bg-purple-500 text-white'
                    : 'text-purple-300 hover:text-white'
                }`}
              >
                Import
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {/* My Playlists Tab */}
              {playlistModalTab === 'my' && (
                <div className="space-y-2">
                  {playlists.length > 0 ? (
                    playlists.map((playlist) => (
                      <div
                        key={playlist.id}
                        className={`group w-full p-3 rounded-xl transition-colors flex items-center gap-3 cursor-pointer ${
                          selectedPlaylist?.id === playlist.id
                            ? 'bg-purple-500/30 border border-purple-500'
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                        }`}
                        onClick={() => handleSelectPlaylistFromModal(playlist.id)}
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-white font-medium text-sm truncate">{playlist.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-purple-300/60 text-xs">{playlist.videos_count || 0} videos</span>
                            {playlist.is_public && (
                              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 rounded text-[10px]">Public</span>
                            )}
                          </div>
                        </div>
                        {selectedPlaylist?.id === playlist.id && (
                          <svg className="w-5 h-5 text-purple-400 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {/* Three-dot menu */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlaylistMenuOpen(playlistMenuOpen === playlist.id ? null : playlist.id);
                            }}
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {playlistMenuOpen === playlist.id && (
                            <>
                              {/* Backdrop to close menu */}
                              <div
                                className="fixed inset-0 z-40"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlaylistMenuOpen(null);
                                }}
                              />
                              {/* Dropdown menu */}
                              <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[120px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlaylistMenuOpen(null);
                                    if (confirm(`Delete "${playlist.name}"? This cannot be undone.`)) {
                                      deletePlaylist(playlist.id).then(() => {
                                        loadPlaylists();
                                        if (selectedPlaylist?.id === playlist.id) {
                                          setSelectedPlaylist(null);
                                        }
                                        if (viewingPlaylist?.id === playlist.id) {
                                          setViewingPlaylist(null);
                                        }
                                        showNotification(`Deleted "${playlist.name}"`);
                                      }).catch(() => {
                                        showNotification('Failed to delete playlist', 'error');
                                      });
                                    }
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/20 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-purple-300/60">
                      <p>No playlists yet</p>
                      <button
                        onClick={() => setPlaylistModalTab('create')}
                        className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Create your first playlist
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Public Playlists Tab */}
              {playlistModalTab === 'public' && (
                <div>
                  {/* Search */}
                  <div className="relative mb-3">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={publicPlaylistSearch}
                      onChange={(e) => handlePublicPlaylistSearch(e.target.value)}
                      placeholder="Search public playlists..."
                      className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>

                  {/* Results */}
                  <div className="space-y-2">
                    {publicPlaylistsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="w-6 h-6 border-2 border-purple-300/30 border-t-purple-400 rounded-full animate-spin" />
                      </div>
                    ) : publicPlaylists.length > 0 ? (
                      publicPlaylists.map((playlist) => (
                        <button
                          key={playlist.id}
                          onClick={() => handleSelectPlaylistFromModal(playlist.id)}
                          className="w-full p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-transparent transition-colors flex items-center gap-3"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <p className="text-white font-medium text-sm truncate">{playlist.name}</p>
                            <p className="text-purple-300/60 text-xs">
                              {playlist.videos_count || 0} videos · by {playlist.user?.name || 'Unknown'}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-8 text-purple-300/60">
                        <p>No public playlists found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Create Playlist Tab */}
              {playlistModalTab === 'create' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-purple-300 text-sm mb-2">Playlist Name</label>
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCreatePlaylist();
                      }}
                      placeholder="My awesome playlist..."
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 transition-colors"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => setNewPlaylistPublic(!newPlaylistPublic)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          newPlaylistPublic ? 'bg-green-500' : 'bg-white/20'
                        }`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            newPlaylistPublic ? 'translate-x-7' : 'translate-x-1'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">Public Playlist</p>
                        <p className="text-purple-300/60 text-xs">Anyone can find and use this playlist</p>
                      </div>
                    </label>
                  </div>

                  <button
                    onClick={handleCreatePlaylist}
                    disabled={!newPlaylistName.trim() || creatingPlaylist}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-purple-500/50 disabled:to-pink-500/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                  >
                    {creatingPlaylist ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create Playlist
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Import from YouTube Tab */}
              {playlistModalTab === 'import' && (
                <YouTubePlaylistImport
                  currentPlaylist={selectedPlaylist}
                  onImportComplete={async (playlist, importedCount) => {
                    // Refresh playlists list
                    loadPlaylists();
                    // Reload the full playlist with videos
                    const updated = await getPlaylist(playlist.id);
                    setSelectedPlaylist(updated);
                    setShowPlaylistModal(false);
                    showNotification(`Added ${importedCount || 0} videos to "${playlist.name}"`);
                  }}
                  onClose={() => setShowPlaylistModal(false)}
                />
              )}
            </div>
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
                          <p className="text-purple-300/60 text-xs">{selectedPlaylist.videos?.length || 0} videos</p>
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

                  {/* Publish Button */}
                  {selectedPlaylist && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (selectedPlaylist.is_public) {
                          setShowPublishModal(true);
                        } else {
                          try {
                            await updatePlaylist(selectedPlaylist.id, { is_public: true });
                            const updated = await getPlaylist(selectedPlaylist.id);
                            setSelectedPlaylist(updated);
                            if (viewingPlaylist?.id === selectedPlaylist.id) {
                              setViewingPlaylist(updated);
                            }
                            loadPlaylists();
                            setShowPublishModal(true);
                          } catch (error) {
                            console.error('Failed to publish playlist:', error);
                            showNotification('Failed to publish playlist', 'error');
                          }
                        }
                      }}
                      className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                        selectedPlaylist.is_public
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-white/10 text-purple-300/60 hover:bg-white/20 hover:text-white'
                      }`}
                      title={selectedPlaylist.is_public ? 'View share link' : 'Publish playlist'}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {selectedPlaylist.is_public ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        )}
                      </svg>
                    </button>
                  )}

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

                  {/* Broadcast Button */}
                  {selectedPlaylist && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (isBroadcasting) {
                          setShowBroadcastModal(true);
                        } else {
                          try {
                            const result = await startBroadcast(selectedPlaylist.id);
                            setIsBroadcasting(true);
                            setBroadcastHash(result.hash);
                            setBroadcastCode(result.broadcast_code);
                            setShowBroadcastModal(true);
                          } catch (error) {
                            console.error('Failed to start broadcast:', error);
                            showNotification('Failed to start broadcast', 'error');
                          }
                        }
                      }}
                      className={`p-2 rounded-lg transition-all flex-shrink-0 ${
                        isBroadcasting
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 animate-pulse'
                          : 'bg-white/10 text-purple-300/60 hover:bg-white/20 hover:text-white'
                      }`}
                      title={isBroadcasting ? 'Broadcasting (click to view)' : 'Start Broadcast'}
                    >
                      {/* Radio tower icon */}
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                        <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                        <circle cx="12" cy="12" r="2" />
                        <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                        <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Playback Controls */}
                <div className="p-3">
                  {/* Now Playing Info */}
                  <div className="flex items-center gap-3 mb-3">
                    {/* Thumbnail */}
                    {activeVideo ? (
                      <div className="relative w-14 h-9 rounded-lg overflow-hidden bg-black/50 flex-shrink-0">
                        <img
                          src={activeVideo.thumbnail_url}
                          alt={activeVideo.title}
                          className="w-full h-full object-cover"
                        />
                        <div className={`absolute inset-0 border-2 rounded-lg ${activePlayer === 1 ? 'border-purple-500' : 'border-pink-500'}`} />
                      </div>
                    ) : (
                      <div className="w-14 h-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-300/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                      </div>
                    )}

                    {/* Song Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {activeVideo ? activeVideo.title : 'No video loaded'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-purple-300/60">
                        {activePlayerState.duration > 0 ? (
                          <>
                            <span>{formatTime(activePlayerState.currentTime)}</span>
                            <span>/</span>
                            <span>{formatTime(activePlayerState.duration)}</span>
                          </>
                        ) : (
                          <span>--:-- / --:--</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Control Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Play/Pause */}
                    <button
                      onClick={() => {
                        setIsStopped(false);
                        toggleActivePlayer();
                      }}
                      disabled={!activeVideo && (!selectedPlaylist?.videos?.length)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                        activeVideo || selectedPlaylist?.videos?.length
                          ? activePlayerState.playing
                            ? 'bg-purple-500 text-white'
                            : 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
                          : 'bg-white/5 text-white/30 cursor-not-allowed'
                      }`}
                      title={activePlayerState.playing ? 'Pause' : 'Play'}
                    >
                      {activePlayerState.playing ? (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="5" width="4" height="14" rx="1" />
                          <rect x="14" y="5" width="4" height="14" rx="1" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Stop */}
                    <button
                      onClick={() => {
                        if (player1Ref.current) player1Ref.current.pause();
                        if (player2Ref.current) player2Ref.current.pause();
                        setIsStopped(true);
                      }}
                      disabled={!activeVideo && (!selectedPlaylist?.videos?.length)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                        activeVideo || selectedPlaylist?.videos?.length
                          ? isStopped
                            ? 'bg-red-500/50 text-red-200'
                            : 'bg-white/10 text-white/60 hover:bg-red-500/30 hover:text-red-300'
                          : 'bg-white/5 text-white/30 cursor-not-allowed'
                      }`}
                      title="Stop (show idle screen)"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                    </button>

                    {/* Crossfade to Next */}
                    <button
                      onClick={skipToNextWithFade}
                      disabled={isAutoFading || (!player1Video && !player2Video)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                        !isAutoFading && (player1Video || player2Video)
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400'
                          : 'bg-white/5 text-white/30 cursor-not-allowed'
                      }`}
                      title="Crossfade to next (8s)"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5v14l7-7zM12 5v14l7-7z" />
                      </svg>
                    </button>

                    {/* Auto Queue Toggle */}
                    <button
                      onClick={() => setAutoQueueEnabled(prev => !prev)}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                        autoQueueEnabled
                          ? 'bg-green-500/30 text-green-300 hover:bg-green-500/50'
                          : 'bg-white/10 text-white/50 hover:bg-white/20'
                      }`}
                      title={autoQueueEnabled ? 'Auto-queue ON' : 'Auto-queue OFF'}
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className={autoQueueEnabled ? 'stroke-green-900' : 'stroke-gray-900'} />
                        <path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 23l2-2.5-2.5-.5" fill="currentColor" />
                        <path d="M3.5 12A8.5 8.5 0 0 1 12 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M12 1l-2 2.5 2.5.5" fill="currentColor" />
                      </svg>
                    </button>
                  </div>

                  {/* Next Up */}
                  {nextVideo && (
                    <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/10">
                      <span className="text-purple-300/50 text-xs">Next:</span>
                      <div className="w-8 h-5 rounded overflow-hidden bg-black/50 flex-shrink-0">
                        <img
                          src={nextVideo.thumbnail_url}
                          alt={nextVideo.title}
                          className="w-full h-full object-cover opacity-60"
                        />
                      </div>
                      <p className="text-purple-300/70 text-xs truncate flex-1">{nextVideo.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${activePlayer === 1 ? 'bg-pink-500/20 text-pink-300/70' : 'bg-purple-500/20 text-purple-300/70'}`}>
                        P{activePlayer === 1 ? 2 : 1}
                      </span>
                    </div>
                  )}

                </div>
              </div>

              {/* Stacked Video Players - opacity controlled by crossfade */}
              <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-purple-500/50 shadow-lg shadow-purple-500/20">
                {/* Player 1 - bottom layer */}
                <div
                  className="absolute inset-0 transition-opacity duration-300"
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
                    autoStart={player1Video?.youtube_id !== restoredVideoIds.player1}
                    onAddToPlaylist={selectedPlaylist ? (videoId) => handleAddToPlaylist(videoId, selectedPlaylist.id) : null}
                    isInPlaylist={selectedPlaylist?.videos?.some(v => v.id === player1Video?.id)}
                    onVideoDrop={handlePlayVideo}
                    showDropOverlay={isGlobalDragging}
                  />
                </div>

                {/* Player 2 - top layer */}
                <div
                  className="absolute inset-0 transition-opacity duration-300"
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
                    autoStart={player2Video?.youtube_id !== restoredVideoIds.player2}
                    onAddToPlaylist={selectedPlaylist ? (videoId) => handleAddToPlaylist(videoId, selectedPlaylist.id) : null}
                    onVideoDrop={handlePlayVideo}
                    isInPlaylist={selectedPlaylist?.videos?.some(v => v.id === player2Video?.id)}
                    showDropOverlay={isGlobalDragging}
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

                {/* DJ Mute button */}
                <button
                  onClick={() => setDjMuted(!djMuted)}
                  className={`absolute top-2 right-2 z-20 p-2 rounded-lg backdrop-blur-sm transition-all ${
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

                {/* Next up indicator */}
                {(player1Video || player2Video) && (
                  <div className="absolute bottom-2 right-2 z-20 px-2 py-1 bg-black/70 backdrop-blur-sm rounded-lg text-xs text-white/80 flex items-center gap-2">
                    <span className="text-white/50">Next:</span>
                    <span className="font-medium truncate max-w-32">
                      {crossfadeValue < 50 ? (player2Video?.title || 'None') : (player1Video?.title || 'None')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Video List */}
          <div className="lg:col-span-8">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
              {/* YouTube Search with Autocomplete Dropdown */}
              <div className="relative p-3 border-b border-white/10 bg-gradient-to-r from-red-600/10 to-pink-600/10">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 z-10" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                    <input
                      type="text"
                      value={youtubeSearchQuery}
                      onChange={(e) => handleYoutubeSearchInput(e.target.value)}
                      onFocus={() => (youtubeSearchQuery || youtubeSearchResults.length > 0) && setShowYoutubeDropdown(true)}
                      onBlur={() => {
                        // Delay to allow click on dropdown items
                        setTimeout(() => setShowYoutubeDropdown(false), 200);
                      }}
                      placeholder="Search YouTube or paste URL..."
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
                    <div className="absolute left-0 right-0 top-full mt-2 bg-gray-900/98 backdrop-blur-xl border border-red-500/30 rounded-xl shadow-2xl shadow-black/50 max-h-[70vh] overflow-y-auto z-[100]">
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

                              {/* Title and duration */}
                              <div className="flex-1 min-w-0">
                                <h4 className="text-white text-sm font-medium line-clamp-2">{video.title}</h4>
                                {video.duration && (
                                  <p className="text-white/50 text-xs mt-0.5">
                                    {typeof video.duration === 'number'
                                      ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`
                                      : video.duration}
                                  </p>
                                )}
                              </div>

                              {/* Add to playlist button */}
                              <button
                                onClick={() => {
                                  handleAddYoutubeToLibrary(video, !!selectedPlaylist);
                                  setShowYoutubeDropdown(false);
                                }}
                                disabled={importingVideoId === video.youtube_id}
                                className="flex-shrink-0 p-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white rounded-lg transition-all hover:scale-110"
                                title={selectedPlaylist ? `Add to ${selectedPlaylist.name}` : 'Add to library'}
                              >
                                {importingVideoId === video.youtube_id ? (
                                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  </div>

                  {/* Paste from clipboard button - only shows when valid YouTube URL detected */}
                  {clipboardYoutubeUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        handleYoutubeSearchInput(clipboardYoutubeUrl);
                        setShowYoutubeDropdown(true);
                        setClipboardYoutubeUrl(null); // Clear after use
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 rounded-lg text-purple-300 hover:text-white transition-colors text-sm whitespace-nowrap"
                      title="Add video from clipboard URL"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Add from clipboard
                    </button>
                  )}
                </div>

                {/* Click outside to close dropdown */}
                {showYoutubeDropdown && (
                  <div
                    className="fixed inset-0 z-[50]"
                    onMouseDown={() => setShowYoutubeDropdown(false)}
                  />
                )}
              </div>

              {/* Library / Playlist Tabs */}
              <div className="border-b border-white/10">
                <div className="flex">
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
      {addVideoModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[400] flex items-center justify-center p-4"
          onClick={() => {
            setAddVideoModal(null);
            setShowPlaylistSubmenu(false);
          }}
        >
          <div
            className="bg-gray-900 border border-white/20 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Video Preview */}
            <div className="relative aspect-video bg-gray-800">
              {addVideoModal.thumbnail_url || addVideoModal.youtube_id ? (
                <img
                  src={addVideoModal.thumbnail_url || `https://img.youtube.com/vi/${addVideoModal.youtube_id}/mqdefault.jpg`}
                  alt={addVideoModal.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
                  <svg className="w-16 h-16 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <h3 className="text-white font-medium text-sm line-clamp-2">{addVideoModal.title}</h3>
              </div>
              {/* Close button */}
              <button
                onClick={() => {
                  setAddVideoModal(null);
                  setShowPlaylistSubmenu(false);
                }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Actions */}
            <div className="p-3 space-y-2">
              {/* Player buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handlePlayVideo(addVideoModal, 1);
                    setAddVideoModal(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors font-medium relative"
                >
                  <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center text-xs font-bold">1</div>
                  <span>Player 1</span>
                  {player1State.playing && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Playing"></span>
                  )}
                </button>
                <button
                  onClick={() => {
                    handlePlayVideo(addVideoModal, 2);
                    setAddVideoModal(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-colors font-medium relative"
                >
                  <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center text-xs font-bold">2</div>
                  <span>Player 2</span>
                  {player2State.playing && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Playing"></span>
                  )}
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-white/10 my-2" />

              {/* Add to selected playlist (quick option) */}
              {selectedPlaylist && !selectedPlaylist.videos?.some(v => v.id === addVideoModal.id) && (
                <button
                  onClick={() => {
                    handleAddToPlaylist(addVideoModal.id, selectedPlaylist.id);
                    setAddVideoModal(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded-xl transition-colors"
                >
                  <div className="w-6 h-6 bg-green-600 rounded flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <span className="truncate">Add to {selectedPlaylist.name}</span>
                </button>
              )}

              {/* Remove from playlist (when viewing playlist and video is in it) */}
              {viewMode === 'playlist' && viewingPlaylist && viewingPlaylist.videos?.some(v => v.id === addVideoModal.id) && (
                <button
                  onClick={() => {
                    handleRemoveFromPlaylist(addVideoModal.id, viewingPlaylist.id);
                    setAddVideoModal(null);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-xl transition-colors"
                >
                  <div className="w-6 h-6 bg-red-600 rounded flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <span className="truncate">Remove from {viewingPlaylist.name}</span>
                </button>
              )}

              {/* Add to other playlist */}
              {playlists && playlists.length > (selectedPlaylist ? 1 : 0) && (
                <div>
                  <button
                    onClick={() => setShowPlaylistSubmenu(!showPlaylistSubmenu)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                      </div>
                      <span>{selectedPlaylist ? 'Other playlist...' : 'Add to playlist...'}</span>
                    </div>
                    <svg className={`w-4 h-4 transition-transform ${showPlaylistSubmenu ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Playlist submenu */}
                  {showPlaylistSubmenu && (
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {playlists
                        .filter(p => p.id !== selectedPlaylist?.id)
                        .map((playlist) => (
                          <button
                            key={playlist.id}
                            onClick={() => {
                              handleAddToPlaylist(addVideoModal.id, playlist.id);
                              setAddVideoModal(null);
                              setShowPlaylistSubmenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-white hover:bg-purple-600/30 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                            </svg>
                            <span className="truncate">{playlist.name}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
