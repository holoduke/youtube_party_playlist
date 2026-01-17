import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlaylists, getPlaylist, createPlaylist, deletePlaylist, addVideoToPlaylist, goLivePlaylist } from '../services/api';
import { useUser } from '../contexts/UserContext';
import PlaylistEditor from './PlaylistEditor';

export default function PlaylistPanel({ onPlayPlaylist, activePlaylistId, onPlaylistsChange, onSelectPlaylist, selectedPlaylistId, onPlaylistUpdate }) {
  const navigate = useNavigate();
  const { currentUser } = useUser();
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await getPlaylists(currentUser?.id);
      setPlaylists(data);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadPlaylists();
    }
  }, [currentUser, loadPlaylists]);

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || !currentUser) return;

    try {
      const newPlaylist = await createPlaylist({
        name: newPlaylistName,
        user_id: currentUser.id,
      });
      setPlaylists([...playlists, { ...newPlaylist, videos_count: 0 }]);
      setNewPlaylistName('');
      setShowNewForm(false);
      onPlaylistsChange?.();
    } catch (error) {
      console.error('Failed to create playlist:', error);
    }
  };

  const handleDeletePlaylist = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this playlist?')) return;

    try {
      await deletePlaylist(id);
      setPlaylists(playlists.filter(p => p.id !== id));
      onPlaylistsChange?.();
    } catch (error) {
      console.error('Failed to delete playlist:', error);
    }
  };

  const handleEditPlaylist = async (id, e) => {
    e.stopPropagation();
    try {
      const playlist = await getPlaylist(id);
      setEditingPlaylist(playlist);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  };

  const handlePlaylistUpdated = (updatedPlaylist) => {
    setEditingPlaylist(updatedPlaylist);
    setPlaylists(playlists.map(p =>
      p.id === updatedPlaylist.id
        ? { ...p, videos_count: updatedPlaylist.videos?.length || 0 }
        : p
    ));
    onPlaylistsChange?.();
  };

  const handlePlayPlaylist = async (id) => {
    try {
      const playlist = await getPlaylist(id);
      if (playlist.videos?.length > 0) {
        onPlayPlaylist(playlist);
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  };

  const handleGoLive = async (playlistId, e) => {
    e.stopPropagation();
    try {
      const result = await goLivePlaylist(playlistId);
      // Redirect to live page as host
      navigate(`/live/${result.share_code}?host=${result.host_code}`);
    } catch (error) {
      console.error('Failed to go live:', error);
    }
  };

  const handleJoinLive = (e) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/live/${joinCode.toUpperCase().trim()}`);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e, playlistId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverPlaylistId(playlistId);
  };

  const handleDragLeave = () => {
    setDragOverPlaylistId(null);
  };

  const handleDrop = async (e, playlistId) => {
    e.preventDefault();
    setDragOverPlaylistId(null);

    try {
      const videoData = JSON.parse(e.dataTransfer.getData('application/json'));
      if (videoData && videoData.id) {
        const updatedPlaylist = await addVideoToPlaylist(playlistId, videoData.id);
        // Update the video count
        setPlaylists(playlists.map(p =>
          p.id === playlistId
            ? { ...p, videos_count: updatedPlaylist.videos?.length || (p.videos_count || 0) + 1 }
            : p
        ));
        onPlaylistsChange?.();
        // Notify about the playlist update for live refresh
        onPlaylistUpdate?.(updatedPlaylist);
      }
    } catch (error) {
      console.error('Failed to add video to playlist:', error);
    }
  };

  const getStatusBadge = (playlist) => {
    if (playlist.status === 'live') {
      return (
        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-300 rounded-full flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
          LIVE
        </span>
      );
    }
    return null;
  };

  return (
    <>
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            My Playlists
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowJoinForm(!showJoinForm); setShowNewForm(false); }}
              className="px-3 py-1 bg-pink-600 hover:bg-pink-700 text-white text-sm rounded-lg transition-colors"
            >
              Join
            </button>
            <button
              onClick={() => { setShowNewForm(!showNewForm); setShowJoinForm(false); }}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
            >
              + New
            </button>
          </div>
        </div>

        {/* Drag hint */}
        <div className="text-xs text-purple-300/40 mb-3 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Drag videos here to add
        </div>

        {/* Join Live Form */}
        {showJoinForm && (
          <form onSubmit={handleJoinLive} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter share code..."
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-pink-300/50 focus:outline-none focus:border-pink-500 text-sm uppercase tracking-widest font-mono"
                autoFocus
                maxLength={8}
              />
              <button
                type="submit"
                className="px-3 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg transition-colors text-sm"
              >
                Join
              </button>
            </div>
          </form>
        )}

        {/* New Playlist Form */}
        {showNewForm && (
          <form onSubmit={handleCreatePlaylist} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 text-sm"
                autoFocus
              />
              <button
                type="submit"
                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
              >
                Create
              </button>
            </div>
          </form>
        )}

        {/* Playlists List */}
        {loading ? (
          <div className="text-center text-purple-300/60 py-4">Loading...</div>
        ) : playlists.length === 0 ? (
          <div className="text-center text-purple-300/60 py-4">
            No playlists yet. Create one!
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => onSelectPlaylist?.(playlist.id)}
                onDragOver={(e) => handleDragOver(e, playlist.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, playlist.id)}
                className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  dragOverPlaylistId === playlist.id
                    ? 'bg-green-500/30 border-2 border-green-500 border-dashed scale-105'
                    : activePlaylistId === playlist.id
                    ? 'bg-purple-600/30 border border-purple-500/50'
                    : selectedPlaylistId === playlist.id
                    ? 'bg-white/10 border border-purple-400/30'
                    : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  dragOverPlaylistId === playlist.id
                    ? 'bg-green-500'
                    : playlist.status === 'live'
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500 animate-pulse'
                    : activePlaylistId === playlist.id
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 animate-pulse'
                    : 'bg-gradient-to-br from-purple-500/80 to-pink-500/80'
                }`}>
                  {dragOverPlaylistId === playlist.id ? (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  ) : playlist.status === 'live' ? (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center">
                    <h3 className="text-white font-medium truncate">{playlist.name}</h3>
                    {getStatusBadge(playlist)}
                  </div>
                  <p className="text-xs text-purple-300/60">
                    {playlist.videos_count || 0} videos
                  </p>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayPlaylist(playlist.id);
                    }}
                    className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                    title="Play playlist"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleGoLive(playlist.id, e)}
                    className="p-1.5 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 rounded transition-colors"
                    title="Go Live - share with others"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleEditPlaylist(playlist.id, e)}
                    className="p-1.5 text-purple-300 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title="Edit playlist"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => handleDeletePlaylist(playlist.id, e)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete playlist"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Playlist Editor Modal */}
      {editingPlaylist && (
        <PlaylistEditor
          playlist={editingPlaylist}
          onUpdate={handlePlaylistUpdated}
          onClose={() => setEditingPlaylist(null)}
        />
      )}
    </>
  );
}
