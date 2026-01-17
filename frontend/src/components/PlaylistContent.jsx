import { useState } from 'react';
import { reorderPlaylistVideos, removeVideoFromPlaylist, addVideoToPlaylist } from '../services/api';

export default function PlaylistContent({ playlist, onUpdate, onPlayVideo, isCollapsed, onToggleCollapse }) {
  // Use playlist.videos directly instead of syncing to local state
  const videos = playlist?.videos || [];
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);
  // Local optimistic state for reordering
  const [localVideos, setLocalVideos] = useState(null);

  // Use localVideos during drag operations, otherwise use playlist videos
  const displayVideos = localVideos !== null ? localVideos : videos;

  // Check if drag is from external source (video grid)
  // During dragover we can only check types, not data
  const isExternalDrag = (e) => {
    try {
      // If we started an internal drag, it's not external
      if (draggedIndex !== null) return false;
      // Check if it has JSON data (from video cards)
      return e.dataTransfer.types.includes('application/json');
    } catch {
      return false;
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Mark as internal reorder
    e.dataTransfer.setData('text/plain', 'internal-reorder');
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (isExternalDrag(e)) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverIndex(index);
      return;
    }
    if (draggedIndex === null) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();

    // Check if it's an external drop (from video grid)
    if (isExternalDrag(e)) {
      try {
        const videoData = JSON.parse(e.dataTransfer.getData('application/json'));
        if (videoData && videoData.id && playlist) {
          const updated = await addVideoToPlaylist(playlist.id, videoData.id);
          onUpdate?.(updated);
        }
      } catch (error) {
        console.error('Failed to add video:', error);
      }
      setDragOverIndex(null);
      setIsDragOverContainer(false);
      return;
    }

    // Internal reorder
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newVideos = [...displayVideos];
    const [draggedVideo] = newVideos.splice(draggedIndex, 1);
    newVideos.splice(dropIndex, 0, draggedVideo);

    // Optimistic update
    setLocalVideos(newVideos);
    setDraggedIndex(null);
    setDragOverIndex(null);

    // Update on server
    try {
      const videoIds = newVideos.map(v => v.id);
      const updated = await reorderPlaylistVideos(playlist.id, videoIds);
      onUpdate?.(updated);
      setLocalVideos(null); // Clear optimistic state
    } catch (error) {
      console.error('Failed to reorder:', error);
      setLocalVideos(null); // Revert to server state
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragOverContainer(false);
  };

  // Container drag handlers for dropping on empty playlist or at the end
  const handleContainerDragOver = (e) => {
    e.preventDefault();
    if (isExternalDrag(e)) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOverContainer(true);
    }
  };

  const handleContainerDragLeave = (e) => {
    // Only set false if leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragOverContainer(false);
    }
  };

  const handleContainerDrop = async (e) => {
    e.preventDefault();
    if (!isExternalDrag(e) || !playlist) {
      setIsDragOverContainer(false);
      return;
    }

    try {
      const videoData = JSON.parse(e.dataTransfer.getData('application/json'));
      if (videoData && videoData.id) {
        const updated = await addVideoToPlaylist(playlist.id, videoData.id);
        onUpdate?.(updated);
      }
    } catch (error) {
      console.error('Failed to add video:', error);
    }
    setIsDragOverContainer(false);
  };

  const handleRemoveVideo = async (videoId, e) => {
    e.stopPropagation();
    try {
      const updated = await removeVideoFromPlaylist(playlist.id, videoId);
      onUpdate?.(updated);
    } catch (error) {
      console.error('Failed to remove video:', error);
    }
  };

  if (!playlist) {
    return (
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4">
        <div className="text-center text-purple-300/60 py-8">
          <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <p className="text-sm">Select a playlist to see its content</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white/5 backdrop-blur-xl rounded-2xl border overflow-hidden transition-all ${
        isDragOverContainer
          ? 'border-green-500 border-2 bg-green-500/10'
          : 'border-white/10'
      }`}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {/* Header with toggle */}
      <div
        onClick={onToggleCollapse}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/10"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-medium text-sm truncate max-w-[150px]">{playlist.name}</h3>
            <p className="text-xs text-purple-300/60">{displayVideos.length} tracks</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-purple-300 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="max-h-[400px] overflow-y-auto">
          {displayVideos.length === 0 ? (
            <div className={`text-center py-6 text-sm transition-colors ${
              isDragOverContainer ? 'text-green-300 bg-green-500/20' : 'text-purple-300/60'
            }`}>
              {isDragOverContainer ? (
                <>
                  <svg className="w-8 h-8 mx-auto mb-2 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Drop to add video
                </>
              ) : (
                'No tracks in playlist - drag videos here'
              )}
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {displayVideos.map((video, index) => (
                <div
                  key={video.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onPlayVideo?.(video, index)}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                    dragOverIndex === index
                      ? 'bg-purple-500/30 border-2 border-purple-500 border-dashed'
                      : draggedIndex === index
                      ? 'opacity-50 bg-white/10'
                      : index % 2 === 0
                      ? 'hover:bg-purple-500/20 border-l-2 border-l-purple-500/50'
                      : 'hover:bg-pink-500/20 border-l-2 border-l-pink-500/50'
                  }`}
                >
                  {/* Drag handle */}
                  <div className="text-purple-400/50 cursor-grab active:cursor-grabbing">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>

                  {/* Track number with player indicator */}
                  <span className={`w-5 text-center text-xs font-mono ${
                    index % 2 === 0 ? 'text-purple-400' : 'text-pink-400'
                  }`}>
                    {index + 1}
                  </span>

                  {/* Thumbnail */}
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-10 h-6 object-cover rounded"
                  />

                  {/* Title */}
                  <span className="flex-1 text-xs text-white truncate">
                    {video.title}
                  </span>

                  {/* Play button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayVideo?.(video, index);
                    }}
                    className={`p-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      index % 2 === 0 ? 'text-purple-300 hover:text-purple-100' : 'text-pink-300 hover:text-pink-100'
                    }`}
                    title={`Play on Player ${index % 2 === 0 ? '1' : '2'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </button>

                  {/* Remove button on hover */}
                  <button
                    onClick={(e) => handleRemoveVideo(video.id, e)}
                    className="p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
