import { useState } from 'react';

export default function PlaylistVideoList({ videos, onReorder, onRemove, onPlay }) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isOverTrash, setIsOverTrash] = useState(false);

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

      {/* Video List */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
        {videos.map((video, index) => (
          <div
            key={video.id}
            draggable="true"
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={`group relative bg-white/5 backdrop-blur-md rounded-xl overflow-hidden border transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
              draggedIndex === index
                ? 'opacity-50 scale-95 border-purple-500'
                : dragOverIndex === index
                ? 'border-pink-500 scale-105 shadow-lg shadow-pink-500/20'
                : 'border-white/10 hover:border-purple-500/50 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20'
            }`}
          >
            {/* Position Badge */}
            <div className="absolute top-2 left-2 z-10 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-xs font-bold text-white">
              {index + 1}
            </div>

            <div className="relative aspect-video overflow-hidden bg-gray-800">
              <img
                src={video.thumbnail_url || `https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                alt={video.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
                draggable="false"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlay(video, index);
                  }}
                  className="p-3 bg-black/60 hover:bg-green-600 text-white rounded-full transition-colors"
                  title="Play"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>

              {/* Drag handle indicator */}
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="p-1.5 bg-black/60 rounded text-white/60">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                </div>
              </div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
