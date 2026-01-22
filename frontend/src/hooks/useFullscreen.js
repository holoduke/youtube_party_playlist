import { useState, useRef, useEffect, useCallback } from 'react';

export default function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenControls, setShowFullscreenControls] = useState(true);
  const containerRef = useRef(null);
  const hideTimeoutRef = useRef(null);
  const previousOrientationRef = useRef(null);

  // Start timer to hide fullscreen controls
  const startHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setShowFullscreenControls(false);
    }, 3000);
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (isFs) {
        setShowFullscreenControls(true);
        startHideTimer();
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [startHideTimer]);

  // Show controls on mouse/touch activity in fullscreen
  const handleActivity = useCallback(() => {
    if (!isFullscreen) return;
    setShowFullscreenControls(true);
    startHideTimer();
  }, [isFullscreen, startHideTimer]);

  // Toggle fullscreen for player container
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && containerRef.current) {
      try {
        // Remember current orientation before entering fullscreen
        previousOrientationRef.current = screen.orientation?.type?.startsWith('portrait') ? 'portrait' : 'landscape';

        await containerRef.current.requestFullscreen();
        // Try to lock to landscape on mobile
        if (screen.orientation?.lock) {
          try {
            await screen.orientation.lock('landscape');
          } catch {
            // Orientation lock not supported or not allowed
          }
        }
      } catch (err) {
        console.log('Fullscreen error:', err);
      }
    } else if (document.fullscreenElement) {
      // Lock to portrait when exiting fullscreen if user was in portrait before
      if (screen.orientation?.lock && previousOrientationRef.current === 'portrait') {
        try {
          await screen.orientation.lock('portrait');
        } catch {
          // Lock not supported
        }
      }
      document.exitFullscreen();
    }
  }, []);

  return {
    isFullscreen,
    showFullscreenControls,
    containerRef,
    handleActivity,
    toggleFullscreen,
  };
}
