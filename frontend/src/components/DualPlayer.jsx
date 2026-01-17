import { useState, useEffect, useRef } from 'react';
import VideoPlayer from './VideoPlayer';
import Crossfader from './Crossfader';
import useAudioAnalyzer from '../hooks/useAudioAnalyzer';

const FADE_DURATION = 10; // seconds before end to start fading

export default function DualPlayer({ player1Video, player2Video, crossfadeValue, onCrossfadeChange, playlistMode, onPlaylistVideoEnded, onPlayerStateUpdate }) {
  const [autoFade, setAutoFade] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const fadeIntervalRef = useRef(null);

  const { isListening, frequencyData, error, startListening, stopListening } = useAudioAnalyzer();

  const player1Volume = 100 - crossfadeValue;
  const player2Volume = crossfadeValue;

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  // Auto-enable fade in playlist mode
  useEffect(() => {
    if (playlistMode) {
      setAutoFade(true);
    }
  }, [playlistMode]);

  const startAutoFade = (fromPlayer) => {
    if (isFading || fadeIntervalRef.current) return;

    setIsFading(true);
    const targetValue = fromPlayer === 1 ? 100 : 0;
    const startValue = crossfadeValue;
    const steps = 50; // Number of steps for smooth fade
    const stepDuration = (FADE_DURATION * 1000) / steps;
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const newValue = Math.round(startValue + (targetValue - startValue) * progress);
      onCrossfadeChange(newValue);

      if (currentStep >= steps) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
        setIsFading(false);
      }
    }, stepDuration);
  };

  const handleTimeUpdate = (playerNumber, currentTime, duration) => {
    if (!autoFade || isFading) return;

    const timeRemaining = duration - currentTime;

    // Only trigger fade if this player is currently active (has volume)
    const isActivePlayer = playerNumber === 1 ? crossfadeValue < 50 : crossfadeValue >= 50;
    // Check if other player has a video loaded
    const otherPlayerHasVideo = playerNumber === 1 ? player2Video : player1Video;

    if (isActivePlayer && otherPlayerHasVideo && timeRemaining <= FADE_DURATION && timeRemaining > 0) {
      startAutoFade(playerNumber);
    }
  };

  const handleVideoEnded = (playerNumber) => {
    // If auto-fade is on and we haven't faded yet, do an instant switch
    if (autoFade && !isFading) {
      const otherPlayerHasVideo = playerNumber === 1 ? player2Video : player1Video;
      if (otherPlayerHasVideo) {
        onCrossfadeChange(playerNumber === 1 ? 100 : 0);
      }
    }

    // Notify parent for playlist mode to load next video
    if (playlistMode && onPlaylistVideoEnded) {
      onPlaylistVideoEnded(playerNumber);
    }
  };

  const toggleAudioAnalyzer = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-2xl">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VideoPlayer
          video={player1Video}
          volume={player1Volume}
          playerNumber={1}
          isActive={crossfadeValue < 50}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onStateUpdate={onPlayerStateUpdate}
          frequencyData={isListening ? frequencyData : null}
        />
        <VideoPlayer
          video={player2Video}
          volume={player2Volume}
          playerNumber={2}
          isActive={crossfadeValue >= 50}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onStateUpdate={onPlayerStateUpdate}
          frequencyData={isListening ? frequencyData : null}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
        <Crossfader value={crossfadeValue} onChange={onCrossfadeChange} />

        <div className="flex gap-2">
          <button
            onClick={() => setAutoFade(!autoFade)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-300 ${
              autoFade
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoFade ? 'bg-white animate-pulse' : 'bg-purple-400'}`} />
            Auto Fade
            {isFading && <span className="text-xs">(Fading...)</span>}
          </button>

          <button
            onClick={toggleAudioAnalyzer}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all duration-300 ${
              isListening
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'bg-white/10 text-purple-200 hover:bg-white/20'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-white animate-pulse' : 'bg-purple-400'}`} />
            {isListening ? 'Live Audio ON' : 'Live Audio'}
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-purple-300/60 mt-2 space-y-1">
        {autoFade && (
          <p>Will automatically crossfade {FADE_DURATION}s before song ends</p>
        )}
        {isListening && (
          <p>Listening via microphone - plays speakers audio through visualizer</p>
        )}
        {error && (
          <p className="text-red-400">Microphone error: {error}</p>
        )}
      </div>
    </div>
  );
}
