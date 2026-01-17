import { useState } from 'react';

// Generate fallback thumbnail URL from youtube_id
const getFallbackThumbnail = (youtubeId) => {
  if (!youtubeId) return null;
  return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
};

export default function VideoCard({ video, onPlay, playlists, onAddToPlaylist }) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Get the best thumbnail URL
  const thumbnailUrl = imgError
    ? getFallbackThumbnail(video.youtube_id)
    : (video.thumbnail_url || getFallbackThumbnail(video.youtube_id));

  const handleAddToPlaylist = (playlistId) => {
    onAddToPlaylist(video.id, playlistId);
    setShowPlaylistMenu(false);
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(video));
    e.dataTransfer.effectAllowed = 'copy';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50 scale-95' : ''}`}
    >
      <div className="relative aspect-video overflow-hidden bg-gray-800">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={() => !imgError && setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/50 to-pink-900/50">
            <svg className="w-12 h-12 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Play buttons */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <button
            onClick={() => onPlay(video, 1)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Player 1
          </button>
          <button
            onClick={() => onPlay(video, 2)}
            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Player 2
          </button>
        </div>

        {/* Add to Playlist button */}
        {playlists && playlists.length > 0 && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlaylistMenu(!showPlaylistMenu);
                }}
                className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors"
                title="Add to playlist"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Playlist dropdown */}
              {showPlaylistMenu && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-white/20 rounded-lg shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-2 border-b border-white/10">
                    <span className="text-xs text-purple-300 font-medium">Add to playlist</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {playlists.map((playlist) => (
                      <button
                        key={playlist.id}
                        onClick={() => handleAddToPlaylist(playlist.id)}
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-purple-600/30 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span className="truncate">{playlist.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate" title={video.title}>
          {video.title}
        </h3>
        <div className="flex flex-wrap gap-1 mt-1">
          {video.categories?.map((cat) => (
            <span
              key={cat.id}
              className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded"
            >
              {cat.name}
            </span>
          ))}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showPlaylistMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPlaylistMenu(false)}
        />
      )}
    </div>
  );
}
