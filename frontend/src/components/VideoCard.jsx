import { useState } from 'react';

// Generate fallback thumbnail URL from youtube_id
const getFallbackThumbnail = (youtubeId) => {
  if (!youtubeId) return null;
  return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
};

export default function VideoCard({ video, onShowAddModal }) {
  const [isDragging, setIsDragging] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Get the best thumbnail URL
  const thumbnailUrl = imgError
    ? getFallbackThumbnail(video.youtube_id)
    : (video.thumbnail_url || getFallbackThumbnail(video.youtube_id));

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
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 pointer-events-none"
            onError={() => !imgError && setImgError(true)}
            loading="lazy"
            draggable="false"
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

        {/* Add button */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowAddModal(video);
            }}
            className="p-2 bg-black/60 hover:bg-purple-600 text-white rounded-lg transition-colors"
            title="Add to..."
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-medium text-white truncate" title={video.title}>
          {video.title}
        </h3>
        {video.duration && (
          <p className="text-white/50 text-xs mt-0.5">
            {Math.floor(video.duration / 60)}:{(video.duration % 60).toString().padStart(2, '0')}
          </p>
        )}
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
  );
}
