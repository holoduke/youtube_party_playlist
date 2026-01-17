import VideoCard from './VideoCard';

export default function VideoList({ videos, onPlay, playlists, onAddToPlaylist }) {
  if (!videos.length) {
    return (
      <div className="flex items-center justify-center h-64 text-purple-300">
        <p>No videos found in this category</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onPlay={onPlay}
          playlists={playlists}
          onAddToPlaylist={onAddToPlaylist}
        />
      ))}
    </div>
  );
}
