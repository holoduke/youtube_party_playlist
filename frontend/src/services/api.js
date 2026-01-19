import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== Auth API ====================

export const register = async (username, email, password, passwordConfirmation) => {
  const response = await api.post('/register', {
    username,
    email,
    password,
    password_confirmation: passwordConfirmation,
  });
  return response.data;
};

export const login = async (username, password) => {
  const response = await api.post('/login', { username, password });
  return response.data;
};

// ==================== User API ====================

export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

export const getUser = async (id) => {
  const response = await api.get(`/users/${id}`);
  return response.data;
};

// ==================== Category API ====================

export const getCategories = async () => {
  const response = await api.get('/categories');
  return response.data;
};

// ==================== Video API ====================

export const getVideos = async (categoryId = null, search = null) => {
  const params = {};
  if (categoryId) params.category_id = categoryId;
  if (search) params.search = search;
  const response = await api.get('/videos', { params });
  return response.data;
};

export const getVideo = async (id) => {
  const response = await api.get(`/videos/${id}`);
  return response.data;
};

// ==================== Playlist API ====================

export const getPlaylists = async (userId = null) => {
  const params = userId ? { user_id: userId } : {};
  const response = await api.get('/playlists', { params });
  return response.data;
};

export const getPublicPlaylists = async (search = null, excludeUserId = null) => {
  const params = {};
  if (search) params.search = search;
  if (excludeUserId) params.exclude_user_id = excludeUserId;
  const response = await api.get('/playlists/public', { params });
  return response.data;
};

export const getPlaylist = async (id) => {
  const response = await api.get(`/playlists/${id}`);
  return response.data;
};

export const getPlaylistByHash = async (hash) => {
  const response = await api.get(`/playlists/hash/${hash}`);
  return response.data;
};

export const createPlaylist = async (data) => {
  // data should include: { name, user_id, description?, is_public? }
  const response = await api.post('/playlists', data);
  return response.data;
};

export const updatePlaylist = async (id, data) => {
  const response = await api.put(`/playlists/${id}`, data);
  return response.data;
};

export const deletePlaylist = async (id) => {
  const response = await api.delete(`/playlists/${id}`);
  return response.data;
};

export const addVideoToPlaylist = async (playlistId, videoId) => {
  const response = await api.post(`/playlists/${playlistId}/videos`, { video_id: videoId });
  return response.data;
};

export const removeVideoFromPlaylist = async (playlistId, videoId) => {
  const response = await api.delete(`/playlists/${playlistId}/videos/${videoId}`);
  return response.data;
};

export const reorderPlaylistVideos = async (playlistId, videoIds) => {
  const response = await api.put(`/playlists/${playlistId}/reorder`, { video_ids: videoIds });
  return response.data;
};

// ==================== Live Session API ====================

// Get all currently live playlists
export const getLivePlaylists = async () => {
  const response = await api.get('/playlists/live');
  return response.data;
};

// Start a live session for a playlist
export const goLivePlaylist = async (playlistId) => {
  const response = await api.post(`/playlists/${playlistId}/go-live`);
  return response.data;
};

// Stop a live session
export const stopLivePlaylist = async (hostCode) => {
  const response = await api.post(`/playlists/${hostCode}/stop-live`);
  return response.data;
};

// Join a live playlist as guest
export const joinLivePlaylist = async (shareCode) => {
  const response = await api.get(`/playlists/join/${shareCode}`);
  return response.data;
};

// Join a live playlist as host
export const joinLivePlaylistAsHost = async (hostCode) => {
  const response = await api.get(`/playlists/host/${hostCode}`);
  return response.data;
};

// Host: Sync state to all participants
export const syncPlaylistState = async (hostCode, state) => {
  const response = await api.post(`/playlists/${hostCode}/sync`, state);
  return response.data;
};

// Host: Approve a song from the queue
export const approveQueueItem = async (hostCode, queueIndex) => {
  const response = await api.post(`/playlists/${hostCode}/approve`, { queue_index: queueIndex });
  return response.data;
};

// Guest: Request a song
export const queueSongToPlaylist = async (shareCode, videoId) => {
  const response = await api.post(`/playlists/${shareCode}/queue`, { video_id: videoId });
  return response.data;
};

// Guest: Like a video
export const likeVideoInPlaylist = async (shareCode, videoId) => {
  const response = await api.post(`/playlists/${shareCode}/like`, { video_id: videoId });
  return response.data;
};

// ==================== Broadcast API ====================

// Start broadcasting a playlist
export const startBroadcast = async (playlistId) => {
  const response = await api.post(`/playlists/${playlistId}/start-broadcast`);
  return response.data;
};

// Stop broadcasting a playlist
export const stopBroadcast = async (playlistId) => {
  const response = await api.post(`/playlists/${playlistId}/stop-broadcast`);
  return response.data;
};

// Sync broadcast state (DJ app calls this)
export const syncBroadcastState = async (playlistId, state) => {
  const response = await api.post(`/playlists/${playlistId}/broadcast-sync`, state);
  return response.data;
};

// Get broadcast state (viewer polls this)
export const getBroadcastState = async (hash) => {
  const response = await api.get(`/broadcast/${hash}`);
  return response.data;
};

// Lookup broadcast by 4-digit code
export const getBroadcastByCode = async (code) => {
  const response = await api.get(`/broadcast/code/${code}`);
  return response.data;
};

// ==================== YouTube API ====================

export const searchYouTube = async (query) => {
  const response = await api.get('/youtube/search', { params: { q: query } });
  return response.data;
};

export const getYouTubeVideo = async (videoId) => {
  const response = await api.get('/youtube/video', { params: { id: videoId } });
  return response.data;
};

export const importYouTubeVideo = async (video) => {
  const response = await api.post('/youtube/import', {
    youtube_id: video.youtube_id,
    title: video.title,
    thumbnail_url: video.thumbnail_url,
  });
  return response.data;
};

// Helper to extract YouTube video ID from various URL formats
export const extractYouTubeVideoId = (input) => {
  // Patterns for YouTube URLs
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: https://youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URL: https://www.youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // YouTube Music: https://music.youtube.com/watch?v=VIDEO_ID
    /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

// ==================== YouTube Playlist Import API (OAuth) ====================

// Get user's YouTube playlists
export const getMyYouTubePlaylists = async (userId) => {
  const response = await api.get('/youtube/my-playlists', {
    params: { user_id: userId }
  });
  return response.data;
};

// Get items from a specific YouTube playlist
export const getYouTubePlaylistItems = async (userId, playlistId) => {
  const response = await api.get('/youtube/playlist-items', {
    params: { user_id: userId, playlist_id: playlistId }
  });
  return response.data;
};

// Import a YouTube playlist into the app
export const importYouTubePlaylist = async (userId, youtubePlaylistId, playlistName, isPublic = false) => {
  const response = await api.post('/youtube/import-playlist', {
    user_id: userId,
    youtube_playlist_id: youtubePlaylistId,
    playlist_name: playlistName,
    is_public: isPublic,
  });
  return response.data;
};

// Disconnect Google account
export const disconnectGoogle = async (userId) => {
  const response = await api.post('/auth/google/disconnect', { user_id: userId });
  return response.data;
};

// Check Google/YouTube auth status
export const getGoogleAuthStatus = async (userId) => {
  const response = await api.get('/auth/google/status', { params: { user_id: userId } });
  return response.data;
};

export default api;
