import { useState, useEffect } from 'react';
import { getVideos, addVideoToPlaylist, removeVideoFromPlaylist, reorderPlaylistVideos, searchYouTube, importYouTubeVideo } from '../services/api';

export default function PlaylistEditor({ playlist, onUpdate, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('database'); // 'database' or 'youtube'
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);

      try {
        if (searchMode === 'database') {
          const results = await getVideos(null, searchQuery);
          const playlistVideoIds = playlist.videos?.map(v => v.id) || [];
          const filteredResults = results.filter(v => !playlistVideoIds.includes(v.id));
          setSearchResults(filteredResults);
        } else {
          const results = await searchYouTube(searchQuery);
          // Filter out videos already in playlist (by youtube_id)
          const playlistYoutubeIds = playlist.videos?.map(v => v.youtube_id) || [];
          const filteredResults = results.filter(v => !playlistYoutubeIds.includes(v.youtube_id));
          setSearchResults(filteredResults);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setSearchError(error.response?.data?.error || 'Search failed. Make sure YouTube API key is configured.');
        setSearchResults([]);
      }
      setIsSearching(false);
    };

    const debounce = setTimeout(performSearch, 500);
    return () => clearTimeout(debounce);
  }, [searchQuery, searchMode, playlist.videos]);

  const handleAddDatabaseVideo = async (video) => {
    try {
      const updated = await addVideoToPlaylist(playlist.id, video.id);
      onUpdate(updated);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to add video:', error);
    }
  };

  const handleAddYouTubeVideo = async (youtubeVideo) => {
    try {
      // First import the video to our database
      const importedVideo = await importYouTubeVideo(youtubeVideo);
      // Then add to playlist
      const updated = await addVideoToPlaylist(playlist.id, importedVideo.id);
      onUpdate(updated);
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Failed to add YouTube video:', error);
    }
  };

  const handleRemoveVideo = async (videoId) => {
    try {
      const updated = await removeVideoFromPlaylist(playlist.id, videoId);
      onUpdate(updated);
    } catch (error) {
      console.error('Failed to remove video:', error);
    }
  };

  const handleMoveVideo = async (index, direction) => {
    const videos = [...playlist.videos];
    const newIndex = index + direction;

    if (newIndex < 0 || newIndex >= videos.length) return;

    [videos[index], videos[newIndex]] = [videos[newIndex], videos[index]];
    const videoIds = videos.map(v => v.id);

    try {
      const updated = await reorderPlaylistVideos(playlist.id, videoIds);
      onUpdate(updated);
    } catch (error) {
      console.error('Failed to reorder videos:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-purple-900/90 to-black/90 border border-purple-500/30 rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Edit Playlist: {playlist.name}</h2>
          <button
            onClick={onClose}
            className="text-purple-300 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search Mode Toggle */}
        <div className="px-4 pt-4">
          <div className="flex gap-2 p-1 bg-white/5 rounded-lg">
            <button
              onClick={() => { setSearchMode('database'); setSearchResults([]); setSearchError(null); }}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                searchMode === 'database'
                  ? 'bg-purple-600 text-white'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              My Library
            </button>
            <button
              onClick={() => { setSearchMode('youtube'); setSearchResults([]); setSearchError(null); }}
              className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                searchMode === 'youtube'
                  ? 'bg-red-600 text-white'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchMode === 'database' ? 'Search your library...' : 'Search YouTube...'}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Error */}
          {searchError && (
            <div className="mt-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
              {searchError}
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((video) => (
                <div
                  key={video.youtube_id || video.id}
                  className="flex items-center gap-3 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-16 h-10 object-cover rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white truncate block">{video.title}</span>
                    {searchMode === 'youtube' && video.channel && (
                      <span className="text-xs text-purple-300/60">{video.channel}</span>
                    )}
                  </div>
                  {searchMode === 'youtube' && video.in_database && (
                    <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded">
                      In Library
                    </span>
                  )}
                  <button
                    onClick={() => searchMode === 'database' ? handleAddDatabaseVideo(video) : handleAddYouTubeVideo(video)}
                    className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors flex-shrink-0"
                  >
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Playlist Videos */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-medium text-purple-300 mb-3">
            Playlist ({playlist.videos?.length || 0} videos)
          </h3>

          {playlist.videos?.length === 0 ? (
            <div className="text-center text-purple-300/60 py-8">
              No videos in playlist. Search and add some!
            </div>
          ) : (
            <div className="space-y-2">
              {playlist.videos?.map((video, index) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-lg group"
                >
                  <span className="w-6 text-center text-purple-400 font-mono text-sm">
                    {index + 1}
                  </span>
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-16 h-10 object-cover rounded"
                  />
                  <span className="flex-1 text-sm text-white truncate">{video.title}</span>

                  {/* Move buttons */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMoveVideo(index, -1)}
                      disabled={index === 0}
                      className="p-1 text-purple-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveVideo(index, 1)}
                      disabled={index === playlist.videos.length - 1}
                      className="p-1 text-purple-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <button
                    onClick={() => handleRemoveVideo(video.id)}
                    className="p-1 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
