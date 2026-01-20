import { useState } from 'react';

export default function AddVideoModal({
  video,
  onClose,
  onPlayVideo,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  selectedPlaylist,
  viewingPlaylist,
  viewMode,
  playlists,
  player1Playing,
  player2Playing,
}) {
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);

  if (!video) return null;

  const isInSelectedPlaylist = selectedPlaylist?.videos?.some(v => v.id === video.id);
  const isInViewingPlaylist = viewingPlaylist?.videos?.some(v => v.id === video.id);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[400] flex items-center justify-center p-4"
      onClick={() => {
        onClose();
        setShowPlaylistSubmenu(false);
      }}
    >
      <div
        className="bg-gray-900 border border-white/20 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Video Preview */}
        <div className="relative aspect-video bg-gray-800">
          {video.thumbnail_url || video.youtube_id ? (
            <img
              src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
              alt={video.title}
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
            <h3 className="text-white font-medium text-sm line-clamp-2">{video.title}</h3>
          </div>
          {/* Close button */}
          <button
            onClick={() => {
              onClose();
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
                onPlayVideo(video, 1);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors font-medium relative"
            >
              <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center text-xs font-bold">1</div>
              <span>Player 1</span>
              {player1Playing && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Playing"></span>
              )}
            </button>
            <button
              onClick={() => {
                onPlayVideo(video, 2);
                onClose();
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-colors font-medium relative"
            >
              <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center text-xs font-bold">2</div>
              <span>Player 2</span>
              {player2Playing && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" title="Playing"></span>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-2" />

          {/* Add to selected playlist (quick option) */}
          {selectedPlaylist && !isInSelectedPlaylist && (
            <button
              onClick={() => {
                onAddToPlaylist(video.id, selectedPlaylist.id);
                onClose();
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
          {viewMode === 'playlist' && viewingPlaylist && isInViewingPlaylist && (
            <button
              onClick={() => {
                onRemoveFromPlaylist(video.id, viewingPlaylist.id);
                onClose();
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
                          onAddToPlaylist(video.id, playlist.id);
                          onClose();
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
  );
}
