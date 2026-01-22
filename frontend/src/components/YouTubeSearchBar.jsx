export default function YouTubeSearchBar({
  searchQuery,
  onSearchInput,
  searchResults,
  searchLoading,
  showDropdown,
  onShowDropdown,
  onHideDropdown,
  importingVideoId,
  onAddVideo,
  selectedPlaylistName,
  clipboardYoutubeUrl,
  onUseClipboardUrl,
  onClearSearch,
}) {
  return (
    <div className="relative p-3 border-b border-white/10 bg-gradient-to-r from-red-600/10 to-pink-600/10">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 z-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchInput(e.target.value)}
            onFocus={() => (searchQuery || searchResults.length > 0) && onShowDropdown()}
            onBlur={() => {
              // Delay to allow click on dropdown items
              setTimeout(() => onHideDropdown(), 200);
            }}
            placeholder="Search YouTube or paste URL..."
            className="w-full pl-10 pr-10 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-red-300/50 focus:outline-none focus:border-red-500 text-sm"
          />
          {searchLoading && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-red-300/30 border-t-red-400 rounded-full animate-spin" />
            </div>
          )}
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white z-10"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Autocomplete Dropdown */}
          {showDropdown && searchQuery && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-gray-900/98 backdrop-blur-xl border border-red-500/30 rounded-xl shadow-2xl shadow-black/50 max-h-[70vh] overflow-y-auto z-[100]">
              {searchLoading && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-red-300/30 border-t-red-400 rounded-full animate-spin" />
                  <span className="ml-3 text-red-300/60 text-sm">Searching YouTube...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-red-300/60 py-8 text-sm">
                  No results found
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {searchResults.map((video) => (
                    <div
                      key={video.youtube_id}
                      draggable="true"
                      onDragStart={(e) => {
                        // Mark as YouTube video for special handling
                        e.dataTransfer.setData('application/json', JSON.stringify({ ...video, isYouTubeSearch: true }));
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors group cursor-grab active:cursor-grabbing"
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
                        onClick={() => onAddVideo(video)}
                        disabled={importingVideoId === video.youtube_id}
                        className="flex-shrink-0 p-2 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 text-white rounded-lg transition-all hover:scale-110"
                        title={selectedPlaylistName ? `Add to ${selectedPlaylistName}` : 'Add to library'}
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
            onClick={onUseClipboardUrl}
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
      {showDropdown && (
        <div
          className="fixed inset-0 z-[50]"
          onMouseDown={onHideDropdown}
        />
      )}
    </div>
  );
}
