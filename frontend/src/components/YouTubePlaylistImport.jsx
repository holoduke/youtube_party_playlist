import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import {
  getMyYouTubePlaylists,
  getYouTubePlaylistItems,
  importYouTubePlaylist
} from '../services/api';

export default function YouTubePlaylistImport({ onImportComplete, onClose, currentPlaylist }) {
  const { currentUser, loginWithGoogle } = useUser();
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistVideos, setPlaylistVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [importMode, setImportMode] = useState(currentPlaylist ? 'current' : 'new'); // 'current' or 'new'

  useEffect(() => {
    if (currentUser?.has_youtube_access) {
      loadPlaylists();
    }
  }, [currentUser]);

  const loadPlaylists = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyYouTubePlaylists(currentUser.id);
      setPlaylists(data);
    } catch (err) {
      if (err.response?.data?.needs_auth) {
        setError('Please reconnect your Google account to access YouTube playlists.');
      } else {
        setError(err.response?.data?.error || 'Failed to load playlists');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistVideos = async (playlist) => {
    setSelectedPlaylist(playlist);
    setNewPlaylistName(playlist.title);
    setLoading(true);
    setError(null);
    try {
      const videos = await getYouTubePlaylistItems(currentUser.id, playlist.youtube_id);
      setPlaylistVideos(videos);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load playlist videos');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedPlaylist) return;
    if (importMode === 'new' && !newPlaylistName.trim()) return;

    setImporting(true);
    setError(null);
    try {
      const result = await importYouTubePlaylist(
        currentUser.id,
        selectedPlaylist.youtube_id,
        importMode === 'new' ? newPlaylistName.trim() : null,
        isPublic,
        importMode === 'current' ? currentPlaylist?.id : null
      );
      onImportComplete?.(result.playlist, result.imported_count);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to import playlist');
    } finally {
      setImporting(false);
    }
  };

  // Show connect Google prompt if no YouTube access
  if (!currentUser?.has_youtube_access) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Connect YouTube</h3>
        <p className="text-white/60 mb-6">
          Connect your Google account to import your YouTube playlists.
        </p>
        <button
          onClick={loginWithGoogle}
          className="px-6 py-3 bg-white text-gray-800 hover:bg-gray-100 rounded-xl font-medium flex items-center gap-3 mx-auto transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Connect Google Account
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h3 className="text-xl font-bold text-white mb-4">Import from YouTube</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">
          {error}
          {error.includes('reconnect') && (
            <button onClick={loginWithGoogle} className="ml-2 underline hover:text-red-200">
              Reconnect
            </button>
          )}
        </div>
      )}

      {!selectedPlaylist ? (
        // Playlist selection view
        <div>
          <p className="text-white/60 mb-4">Select a playlist to import:</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center py-8 text-white/50">
              <p>No playlists found in your YouTube account.</p>
              <button
                onClick={loadPlaylists}
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {playlists.map((playlist) => (
                <button
                  key={playlist.youtube_id}
                  onClick={() => loadPlaylistVideos(playlist)}
                  className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-left"
                >
                  {playlist.thumbnail_url ? (
                    <img
                      src={playlist.thumbnail_url}
                      alt={playlist.title}
                      className="w-16 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-12 bg-white/10 rounded flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{playlist.title}</div>
                    <div className="text-white/50 text-sm">{playlist.item_count} videos</div>
                  </div>
                  <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Import configuration view
        <div>
          <button
            onClick={() => { setSelectedPlaylist(null); setPlaylistVideos([]); setError(null); }}
            className="text-purple-400 hover:text-purple-300 mb-4 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to playlists
          </button>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Import mode selection */}
              {currentPlaylist && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Import to
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('current')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        importMode === 'current'
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      Current playlist
                    </button>
                    <button
                      type="button"
                      onClick={() => setImportMode('new')}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        importMode === 'new'
                          ? 'bg-purple-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      New playlist
                    </button>
                  </div>
                  {importMode === 'current' && (
                    <p className="mt-2 text-sm text-white/50">
                      Adding to: <span className="text-purple-400">{currentPlaylist.name}</span>
                    </p>
                  )}
                </div>
              )}

              {/* New playlist options */}
              {importMode === 'new' && (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white/80 mb-1">
                      Playlist Name
                    </label>
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-purple-500"
                      placeholder="Enter playlist name"
                    />
                  </div>

                  <label className="flex items-center gap-2 mb-4 text-white/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="w-4 h-4 rounded border-white/20 bg-white/10 text-purple-600 focus:ring-purple-500"
                    />
                    Make playlist public
                  </label>
                </>
              )}

              <div className="mb-4">
                <div className="text-white/60 text-sm mb-2">
                  {playlistVideos.length} videos will be imported
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                  {playlistVideos.slice(0, 5).map((video, index) => (
                    <div key={video.youtube_id} className="flex items-center gap-2 text-sm text-white/70">
                      <span className="text-white/40 w-5 text-right">{index + 1}.</span>
                      {video.thumbnail_url && (
                        <img src={video.thumbnail_url} alt="" className="w-10 h-6 object-cover rounded" />
                      )}
                      <span className="truncate flex-1">{video.title}</span>
                    </div>
                  ))}
                  {playlistVideos.length > 5 && (
                    <div className="text-white/50 text-sm pl-7">
                      ...and {playlistVideos.length - 5} more videos
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-white/10">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || (importMode === 'new' && !newPlaylistName.trim()) || playlistVideos.length === 0}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {importing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Importing...
                    </span>
                  ) : importMode === 'current' ? (
                    `Add ${playlistVideos.length} Videos`
                  ) : (
                    `Import ${playlistVideos.length} Videos`
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
