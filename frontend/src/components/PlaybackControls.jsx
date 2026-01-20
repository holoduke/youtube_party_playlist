export default function PlaybackControls({
  activeVideo,
  activePlayer,
  activePlayerState,
  formatTime,
  onPlayPause,
  onStop,
  onSkipToNext,
  isStopped,
  isAutoFading,
  hasAnyVideo,
  hasVideoToFadeTo,
  hasPlaylistVideos,
  autoQueueEnabled,
  onToggleAutoQueue,
  nextVideo,
  playlistRemainingTime,
  playlistRemainingCount,
}) {
  const canControl = activeVideo || hasPlaylistVideos;

  // Format duration for display (handles minutes and hours)
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '--:--';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
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
          onClick={onPlayPause}
          disabled={!canControl}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            canControl
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
          onClick={onStop}
          disabled={!canControl}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            canControl
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
          onClick={onSkipToNext}
          disabled={isAutoFading || !hasVideoToFadeTo}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            !isAutoFading && hasVideoToFadeTo
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
          onClick={onToggleAutoQueue}
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

      {/* Playlist Remaining */}
      {playlistRemainingCount > 0 && (
        <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/10">
          <span className="text-purple-300/50 text-xs">Playlist:</span>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-purple-300/70">{playlistRemainingCount} songs</span>
            <span className="text-purple-300/40">•</span>
            <span className="text-purple-300/70 font-mono">{formatDuration(playlistRemainingTime)}</span>
          </div>
        </div>
      )}

      {/* Next Up */}
      {nextVideo && (
        <div className="flex items-center gap-2 pt-2 mt-2 border-t border-white/10">
          <span className="text-purple-300/50 text-xs flex-shrink-0">Next:</span>
          <div className="w-12 h-7 rounded overflow-hidden bg-black/50 flex-shrink-0">
            <img
              src={nextVideo.thumbnail_url}
              alt={nextVideo.title}
              className="w-full h-full object-cover opacity-70"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-purple-300/80 text-xs truncate">{nextVideo.title}</p>
            <div className="flex items-center gap-2 text-[10px] text-purple-300/50">
              {nextVideo.duration && (
                <span className="font-mono">{formatDuration(nextVideo.duration)}</span>
              )}
              <span className={`px-1 py-0.5 rounded font-medium ${activePlayer === 1 ? 'bg-pink-500/20 text-pink-300/60' : 'bg-purple-500/20 text-purple-300/60'}`}>
                P{activePlayer === 1 ? 2 : 1}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
