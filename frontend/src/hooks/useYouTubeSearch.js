import { useState, useRef, useEffect, useCallback } from 'react';
import { searchYouTube, getYouTubeVideo, extractYouTubeVideoId } from '../services/api';

export default function useYouTubeSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [importingVideoId, setImportingVideoId] = useState(null);
  const [clipboardYoutubeUrl, setClipboardYoutubeUrl] = useState(null);
  const searchTimeoutRef = useRef(null);

  // Check clipboard for YouTube URLs on focus
  useEffect(() => {
    const checkClipboard = async () => {
      try {
        const text = await navigator.clipboard?.readText();
        if (text && extractYouTubeVideoId(text.trim())) {
          setClipboardYoutubeUrl(text.trim());
        } else {
          setClipboardYoutubeUrl(null);
        }
      } catch {
        // Clipboard access denied or not available
        setClipboardYoutubeUrl(null);
      }
    };

    // Check on mount and when window gains focus
    checkClipboard();
    window.addEventListener('focus', checkClipboard);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkClipboard();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', checkClipboard);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // YouTube search handler with debounce and URL detection
  const handleSearchInput = useCallback((value) => {
    setSearchQuery(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearchLoading(false);
      return;
    }

    // Debounce search - wait 300ms after typing stops
    setSearchLoading(true);
    setShowDropdown(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        // Check if input is a YouTube URL
        const videoId = extractYouTubeVideoId(value);

        if (videoId) {
          // Fetch single video by ID
          const video = await getYouTubeVideo(videoId);
          setSearchResults(video ? [video] : []);
        } else {
          // Regular search
          const results = await searchYouTube(value);
          setSearchResults(results);
        }
      } catch (error) {
        console.error('YouTube search failed:', error);
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 300);
  }, []);

  // Clear YouTube search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  }, []);

  // Use clipboard URL for search
  const useClipboardUrl = useCallback(() => {
    if (clipboardYoutubeUrl) {
      handleSearchInput(clipboardYoutubeUrl);
    }
  }, [clipboardYoutubeUrl, handleSearchInput]);

  return {
    searchQuery,
    searchResults,
    searchLoading,
    showDropdown,
    setShowDropdown,
    importingVideoId,
    setImportingVideoId,
    clipboardYoutubeUrl,
    handleSearchInput,
    clearSearch,
    useClipboardUrl,
  };
}
