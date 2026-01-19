import { useState, useEffect } from 'react';

// Format duration from seconds to MM:SS
const formatDuration = (seconds) => {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function PlaylistVideoList({ videos, onReorder, onRemove, onPlay, onQueue, activeVideoId }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [pendingVideoId, setPendingVideoId] = useState(null);

  // Clear pending state when the video becomes active
  useEffect(() => {
    if (pendingVideoId && pendingVideoId === activeVideoId) {
      setPendingVideoId(null);
    }
  }, [activeVideoId, pendingVideoId]);

  // Clear pending state after timeout (in case something goes wrong)
  useEffect(() => {
    if (pendingVideoId) {
      const timeout = setTimeout(() => {
        setPendingVideoId(null);
      }, 10000); // 10 second timeout
      return () => clearTimeout(timeout);
    }
  }, [pendingVideoId]);

  const handleDragStart = (e, index) => {
    // Set drag data - include both index for reordering and video data for player drops
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.setData('application/json', JSON.stringify(videos[index]));
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggedIndex(index);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
    setIsOverTrash(false);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    // Reorder the videos
    const newVideos = [...videos];
    const [draggedItem] = newVideos.splice(draggedIndex, 1);
    newVideos.splice(dropIndex, 0, draggedItem);

    onReorder(newVideos.map(v => v.id));
    handleDragEnd();
  };

  const handleTrashDragOver = (e) => {
    e.preventDefault();
    setIsOverTrash(true);
  };

  const handleTrashDragLeave = () => {
    setIsOverTrash(false);
  };

  const handleTrashDrop = (e) => {
    e.preventDefault();
    if (draggedIndex !== null) {
      onRemove(videos[draggedIndex].id);
    }
    handleDragEnd();
  };

  if (!videos.length) {
    return (
      <div className="flex items-center justify-center h-64 text-purple-300">
        <p>No videos in this playlist</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trash Zone - fixed overlay at bottom when dragging */}
      {isDragging && (
        <div
          onDragOver={handleTrashDragOver}
          onDragLeave={handleTrashDragLeave}
          onDrop={handleTrashDrop}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 border-2 border-dashed rounded-xl flex items-center gap-2 transition-all shadow-lg ${
            isOverTrash
              ? 'border-red-500 bg-red-600 text-white scale-110'
              : 'border-red-400/50 bg-gray-900/95 text-red-400'
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="font-medium">Drop to remove</span>
        </div>
      )}

      {/* Video List - Row Layout */}
      <div className="flex flex-col gap-2 p-4">
        {videos.map((video, index) => {
          const isActive = video.id === activeVideoId;
          const isPending = video.id === pendingVideoId;

          return (
            <div
              key={video.id}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              className={`group relative flex items-center gap-4 p-2 rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                draggedIndex === index
                  ? 'opacity-50 scale-[0.98] border-purple-500 bg-purple-500/10'
                  : dragOverIndex === index
                  ? 'border-pink-500 bg-pink-500/10 shadow-lg shadow-pink-500/20'
                  : isPending
                  ? 'border-yellow-500 bg-gradient-to-r from-yellow-500/20 to-orange-500/10 shadow-lg shadow-yellow-500/30 animate-pulse'
                  : isActive
                  ? 'border-green-500 bg-gradient-to-r from-green-500/20 to-emerald-500/10 shadow-lg shadow-green-500/20'
                  : 'border-white/10 bg-white/5 hover:border-purple-500/50 hover:bg-white/10'
              }`}
            >
              {/* Position Number */}
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                isPending
                  ? 'bg-yellow-500 text-white'
                  : isActive
                  ? 'bg-green-500 text-white animate-pulse'
                  : 'bg-white/10 text-white/60'
              }`}>
                {isPending ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : isActive ? (
                  <svg className="w-4 h-4 animate-bounce" fill="currentColor" viewBox="0 0 24 24" style={{ animationDuration: '1s' }}>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>

              {/* Thumbnail */}
              <div className="relative flex-shrink-0 w-24 h-14 rounded-lg overflow-hidden bg-gray-800">
                <img
                  src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  draggable="false"
                />
                {isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-yellow-400 animate-bounce">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                )}
                {isActive && !isPending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-4 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-5 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
                      <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '450ms' }}></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium truncate ${isPending ? 'text-yellow-300' : isActive ? 'text-green-300' : 'text-white'}`} title={video.title}>
                  {video.title}
                </h3>
                {video.duration && (
                  <p className="text-white/50 text-xs mt-0.5">
                    {formatDuration(video.duration)}
                  </p>
                )}
                {video.categories?.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-1">
                    {video.categories.slice(0, 2).map((cat) => (
                      <span
                        key={cat.id}
                        className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded text-[10px]"
                      >
                        {cat.name}
                      </span>
                    ))}
                    {video.categories.length > 2 && (
                      <span className="text-purple-300/60 text-[10px]">+{video.categories.length - 2}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Queue button - queue as next without fading */}
                {!isActive && onQueue && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onQueue(video, index);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 bg-white/10 text-white/60 hover:bg-purple-500 hover:text-white hover:scale-110"
                    title="Queue as next"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="5" />
                      <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" className="stroke-gray-900" />
                      <path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 23l2-2.5-2.5-.5" fill="currentColor" />
                      <path d="M3.5 12A8.5 8.5 0 0 1 12 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12 1l-2 2.5 2.5.5" fill="currentColor" />
                    </svg>
                  </button>
                )}

                {/* Play button - queue as next and immediately fade */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setPendingVideoId(video.id);
                    onPlay(video, index);
                  }}
                  className={`p-2 rounded-lg transition-all duration-200 ${
                    isPending
                      ? 'bg-yellow-500/30 text-yellow-300 cursor-wait'
                      : isActive
                      ? 'bg-green-500/20 text-green-300 cursor-default'
                      : 'bg-white/10 text-white/60 hover:bg-green-500 hover:text-white hover:scale-110'
                  }`}
                  title={isPending ? 'Loading...' : isActive ? 'Now playing' : 'Play now (queue & fade)'}
                  disabled={isActive || isPending}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>

                {/* Drag handle */}
                <div className="p-2 text-white/30 group-hover:text-white/60 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              </div>

              {/* Side indicator */}
              {isPending && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 rounded-full animate-pulse"></div>
              )}
              {isActive && !isPending && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-green-500 rounded-full"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
