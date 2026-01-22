import { useState, useEffect, useRef, useCallback } from 'react';
import { getPublicPlaylists, createPlaylist, deletePlaylist, setDefaultPlaylist, getPlaylist } from '../services/api';
import YouTubePlaylistImport from './YouTubePlaylistImport';

export default function PlaylistModal({
  isOpen,
  onClose,
  playlists,
  selectedPlaylist,
  currentUser,
  onSelectPlaylist,
  onPlaylistCreated,
  onPlaylistDeleted,
  onPlaylistUpdated,
  showNotification,
  loadPlaylists,
  updateUser,
}) {
  const [tab, setTab] = useState('my');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistPublic, setNewPlaylistPublic] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(null);

  // Public playlists
  const [publicPlaylists, setPublicPlaylists] = useState([]);
  const [publicPlaylistSearch, setPublicPlaylistSearch] = useState('');
  const [publicPlaylistsLoading, setPublicPlaylistsLoading] = useState(false);
  const searchTimeoutRef = useRef(null);

  const loadPublicPlaylists = useCallback(async (search = '') => {
    setPublicPlaylistsLoading(true);
    try {
      const data = await getPublicPlaylists(search);
      setPublicPlaylists(data);
    } catch {
      // Failed to load public playlists
    }
    setPublicPlaylistsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen && tab === 'public') {
      loadPublicPlaylists();
    }
  }, [isOpen, tab, loadPublicPlaylists]);

  const handlePublicPlaylistSearch = (value) => {
    setPublicPlaylistSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      loadPublicPlaylists(value);
    }, 300);
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    if (newTab === 'public') {
      loadPublicPlaylists();
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim() || creatingPlaylist) return;
    setCreatingPlaylist(true);
    try {
      const playlist = await createPlaylist({
        name: newPlaylistName.trim(),
        is_public: newPlaylistPublic,
        user_id: currentUser.id,
      });
      setNewPlaylistName('');
      setNewPlaylistPublic(false);
      await loadPlaylists();
      onPlaylistCreated(playlist);
      showNotification(`Created "${playlist.name}"`);
      setTab('my');
    } catch (error) {
      console.error('Failed to create playlist:', error);
      showNotification('Failed to create playlist', 'error');
    }
    setCreatingPlaylist(false);
  };

  const handleDeletePlaylist = async (playlist) => {
    if (confirm(`Delete "${playlist.name}"? This cannot be undone.`)) {
      try {
        await deletePlaylist(playlist.id);
        loadPlaylists();
        onPlaylistDeleted(playlist);
        showNotification(`Deleted "${playlist.name}"`);
      } catch {
        showNotification('Failed to delete playlist', 'error');
      }
    }
  };

  const handleSetDefault = async (playlist) => {
    try {
      await setDefaultPlaylist(currentUser.id, playlist.id);
      updateUser({ default_playlist_id: playlist.id });
      showNotification(`"${playlist.name}" set as default`);
    } catch {
      showNotification('Failed to set default', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-6 max-w-md w-full mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
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
            onClick={() => handleTabChange('my')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === 'my'
                ? 'bg-purple-500 text-white'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            My Playlists
          </button>
          <button
            onClick={() => handleTabChange('public')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === 'public'
                ? 'bg-purple-500 text-white'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            Public
          </button>
          <button
            onClick={() => handleTabChange('create')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === 'create'
                ? 'bg-purple-500 text-white'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            Create
          </button>
          <button
            onClick={() => handleTabChange('import')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === 'import'
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
          {tab === 'my' && (
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
                    onClick={() => onSelectPlaylist(playlist.id)}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-white font-medium text-sm truncate flex items-center gap-1">
                        {playlist.name}
                        {currentUser?.default_playlist_id === playlist.id && (
                          <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        )}
                      </p>
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
                          <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-white/20 rounded-lg shadow-xl py-1 min-w-[140px]">
                            {/* Make Default */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlaylistMenuOpen(null);
                                handleSetDefault(playlist);
                              }}
                              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                                currentUser?.default_playlist_id === playlist.id
                                  ? 'text-green-400 bg-green-500/10'
                                  : 'text-white/70 hover:bg-white/10'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                              {currentUser?.default_playlist_id === playlist.id ? 'Default' : 'Make Default'}
                            </button>
                            {/* Delete */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPlaylistMenuOpen(null);
                                handleDeletePlaylist(playlist);
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
                    onClick={() => setTab('create')}
                    className="mt-2 text-purple-400 hover:text-purple-300 text-sm"
                  >
                    Create your first playlist
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Public Playlists Tab */}
          {tab === 'public' && (
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
                      onClick={() => onSelectPlaylist(playlist.id)}
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
          {tab === 'create' && (
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
          {tab === 'import' && (
            <YouTubePlaylistImport
              currentPlaylist={selectedPlaylist}
              onImportComplete={async (playlist, importedCount) => {
                await loadPlaylists();
                const updated = await getPlaylist(playlist.id);
                onPlaylistUpdated(updated);
                onClose();
                showNotification(`Added ${importedCount || 0} videos to "${playlist.name}"`);
              }}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
