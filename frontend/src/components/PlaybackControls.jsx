import { useState, memo } from 'react';

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

// Play icon component - defined outside to prevent recreation
const PlayIcon = memo(({ active }) => (
  <div className={`w-5 flex-shrink-0 ${active ? 'text-green-400' : 'text-purple-300/30'}`}>
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  </div>
));
PlayIcon.displayName = 'PlayIcon';

// Next icon component - defined outside to prevent recreation
const NextIcon = memo(() => (
  <div className="w-5 flex-shrink-0 text-purple-300/30">
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M5 5v14l7-7zM12 5v14l7-7z" />
    </svg>
  </div>
));
NextIcon.displayName = 'NextIcon';

// Song row component - memoized to prevent thumbnail flickering
const SongRow = memo(({ icon, video, isActive, playerNum, showTime, currentTime, duration, startsIn, formatTime }) => (
  <div className="flex items-center gap-3">
    {/* Icon */}
    {icon}

    {/* Thumbnail */}
    {video ? (
      <div className="relative w-12 h-8 rounded overflow-hidden bg-black/50 flex-shrink-0">
        <img
          src={video.thumbnail_url}
          alt={video.title}
          className={`w-full h-full object-cover ${isActive ? '' : 'opacity-60'}`}
        />
        {playerNum && (
          <div className={`absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded text-[9px] font-medium ${
            playerNum === 1 ? 'bg-purple-500/80 text-white' : 'bg-pink-500/80 text-white'
          }`}>
            P{playerNum}
          </div>
        )}
      </div>
    ) : (
      <div className="w-12 h-8 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-3 h-3 text-purple-300/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
        </svg>
      </div>
    )}

    {/* Song Info */}
    <div className="flex-1 min-w-0">
      <p className={`text-sm truncate ${isActive ? 'text-white font-medium' : 'text-purple-300/70'}`}>
        {video ? video.title : 'No video'}
      </p>
      <div className="flex items-center gap-2 text-[11px] text-purple-300/50">
        {showTime && duration > 0 ? (
          <>
            <span className="font-mono">{formatTime(currentTime)}</span>
            <span>/</span>
            <span className="font-mono">{formatTime(duration)}</span>
          </>
        ) : video?.duration ? (
          <>
            <span className="font-mono">{formatDuration(video.duration)}</span>
            {startsIn > 0 && (
              <>
                <span className="text-purple-300/30">·</span>
                <span className="text-purple-300/60">starts in {formatTime(startsIn)}</span>
              </>
            )}
          </>
        ) : (
          <span>--:--</span>
        )}
      </div>
    </div>
  </div>
), (prevProps, nextProps) => {
  // Custom comparison - only re-render if these change
  return (
    prevProps.video?.id === nextProps.video?.id &&
    prevProps.video?.thumbnail_url === nextProps.video?.thumbnail_url &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.playerNum === nextProps.playerNum &&
    prevProps.showTime === nextProps.showTime &&
    prevProps.currentTime === nextProps.currentTime &&
    prevProps.duration === nextProps.duration &&
    prevProps.startsIn === nextProps.startsIn
  );
});
SongRow.displayName = 'SongRow';

// Control button component - defined outside to prevent recreation
const ControlButton = memo(({ onClick, disabled, active, gradient, title, children, size = 'normal' }) => {
  const sizeClasses = size === 'small' ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = size === 'small' ? 'w-5 h-5' : 'w-6 h-6';

  let colorClasses;
  if (disabled) {
    colorClasses = 'bg-white/5 text-white/30 cursor-not-allowed';
  } else if (gradient) {
    colorClasses = 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400';
  } else if (active) {
    colorClasses = 'bg-purple-500 text-white';
  } else {
    colorClasses = 'bg-white/10 text-white/60 hover:bg-white/20';
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClasses} flex items-center justify-center rounded-lg transition-colors ${colorClasses}`}
      title={title}
    >
      <div className={iconSize}>{children}</div>
    </button>
  );
});
ControlButton.displayName = 'ControlButton';

function PlaybackControls({
  activeVideo,
  activePlayer,
  activePlayerState,
  formatTime,
  onPlayPause,
  onStop,
  onSkipToNext,
  isStopped,
  isAutoFading,
  hasVideoToFadeTo,
  hasPlaylistVideos,
  autoQueueEnabled,
  onToggleAutoQueue,
  nextVideo,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const canControl = activeVideo || hasPlaylistVideos;

  // Calculate time until next song starts (remaining time in current song)
  const timeUntilNext = activePlayerState.duration > 0
    ? Math.max(0, activePlayerState.duration - activePlayerState.currentTime)
    : 0;

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="p-2">
        <div className="flex items-center gap-2">
          {/* Current song mini info */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <PlayIcon active={activePlayerState.playing && !isStopped} />
            {activeVideo ? (
              <div className="relative w-10 h-7 rounded overflow-hidden bg-black/50 flex-shrink-0">
                <img
                  src={activeVideo.thumbnail_url}
                  alt={activeVideo.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-10 h-7 rounded bg-white/10 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {activeVideo?.title || 'No video'}
              </p>
              <p className="text-purple-300/50 text-[10px] font-mono">
                {activePlayerState.duration > 0
                  ? `${formatTime(activePlayerState.currentTime)} / ${formatTime(activePlayerState.duration)}`
                  : '--:--'
                }
              </p>
            </div>
          </div>

          {/* Compact controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <ControlButton
              onClick={onPlayPause}
              disabled={!canControl}
              active={activePlayerState.playing}
              title={activePlayerState.playing ? 'Pause' : 'Play'}
              size="small"
            >
              {activePlayerState.playing ? (
                <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </ControlButton>

            <ControlButton
              onClick={onSkipToNext}
              disabled={isAutoFading || !hasVideoToFadeTo}
              gradient={!isAutoFading && hasVideoToFadeTo}
              title="Fade to next"
              size="small"
            >
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5v14l7-7zM12 5v14l7-7z" />
              </svg>
            </ControlButton>

            {/* Expand button */}
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
              title="Expand"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="p-3">
      {/* Control Buttons */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10">
        {/* Play/Pause */}
        <button
          onClick={onPlayPause}
          disabled={!canControl}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
            canControl
              ? 'bg-purple-500 text-white hover:bg-purple-400'
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
              ? !isStopped && activePlayerState.playing
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400'
                : 'bg-purple-500/30 text-purple-300 hover:bg-purple-500/50'
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Collapse button */}
        <button
          onClick={() => setIsCollapsed(true)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
          title="Collapse"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>

      {/* Current & Next Songs */}
      <div className="space-y-2">
        <SongRow
          icon={<PlayIcon active={activePlayerState.playing && !isStopped} />}
          video={activeVideo}
          isActive={true}
          playerNum={activeVideo ? activePlayer : null}
          showTime={true}
          currentTime={activePlayerState.currentTime}
          duration={activePlayerState.duration}
          formatTime={formatTime}
        />
        <SongRow
          icon={<NextIcon />}
          video={nextVideo}
          isActive={false}
          playerNum={nextVideo ? (activePlayer === 1 ? 2 : 1) : null}
          showTime={false}
          startsIn={nextVideo ? timeUntilNext : 0}
          formatTime={formatTime}
        />
      </div>
    </div>
  );
}

export default memo(PlaybackControls);
