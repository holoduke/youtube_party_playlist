import { useState } from 'react';

// Seeded pseudo-random for consistent values
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Pre-generate bar configurations at module level for consistency
const BAR_COUNT = 64;
const BARS_CONFIG = Array.from({ length: BAR_COUNT }, (_, i) => ({
  id: i,
  // Use seeded random for deterministic but varied values
  delay: seededRandom(i * 7) * 0.5,
  duration: 0.3 + seededRandom(i * 13) * 0.4,
  minHeight: 10 + seededRandom(i * 19) * 5,
}));

export default function WaveVisualizer({ isActive, playerNumber, frequencyData }) {
  const barCount = BAR_COUNT;

  // Use pre-generated bar configurations
  const [bars] = useState(BARS_CONFIG);

  // Get height for a bar based on frequency data
  const getBarHeight = (index) => {
    if (!frequencyData || !frequencyData.raw || frequencyData.raw.length === 0) {
      return bars[index].minHeight;
    }

    // Map bar index to frequency data
    const freqIndex = Math.floor((index / barCount) * frequencyData.raw.length);
    const value = frequencyData.raw[freqIndex] || 0;

    // Normalize to percentage (0-100)
    const normalized = (value / 255) * 100;

    // Apply some scaling for visual impact
    return Math.max(5, normalized * 0.9);
  };

  // Get color intensity based on frequency range
  const getBarColor = (index) => {
    const position = index / barCount;

    if (playerNumber === 1) {
      // Purple gradient - bass is darker, treble is lighter
      if (position < 0.33) {
        return 'from-purple-700 to-purple-500'; // Bass - deep purple
      } else if (position < 0.66) {
        return 'from-purple-600 to-purple-400'; // Mids
      } else {
        return 'from-purple-500 to-purple-300'; // Treble - light purple
      }
    } else {
      // Pink gradient
      if (position < 0.33) {
        return 'from-pink-700 to-pink-500'; // Bass - deep pink
      } else if (position < 0.66) {
        return 'from-pink-600 to-pink-400'; // Mids
      } else {
        return 'from-pink-500 to-pink-300'; // Treble - light pink
      }
    }
  };

  const hasAudioData = frequencyData && frequencyData.raw && frequencyData.overall > 0.01;

  return (
    <div className="relative h-20 overflow-hidden rounded-b-xl bg-black/40">
      {/* Gradient overlay */}
      <div className={`absolute inset-0 bg-gradient-to-t ${
        playerNumber === 1
          ? 'from-purple-600/30 to-transparent'
          : 'from-pink-600/30 to-transparent'
      }`} />

      {/* Frequency labels */}
      <div className="absolute top-1 left-2 text-[8px] text-purple-300/40 font-mono">BASS</div>
      <div className="absolute top-1 right-2 text-[8px] text-purple-300/40 font-mono">TREBLE</div>

      {/* Wave bars container */}
      <div className="absolute inset-0 flex items-end justify-center gap-[1px] px-1 pb-1 pt-4">
        {bars.map((bar, index) => {
          const height = isActive && hasAudioData
            ? getBarHeight(index)
            : (isActive ? bar.minHeight * 2 : bar.minHeight);

          return (
            <div
              key={bar.id}
              className={`flex-1 max-w-2 rounded-t bg-gradient-to-t ${getBarColor(index)} transition-all duration-75 ${
                isActive ? 'opacity-100' : 'opacity-20'
              }`}
              style={{
                height: `${height}%`,
                animation: isActive && !hasAudioData
                  ? `wave ${bar.duration}s ease-in-out ${bar.delay}s infinite alternate`
                  : 'none',
                boxShadow: isActive && height > 30
                  ? playerNumber === 1
                    ? '0 0 8px rgba(168, 85, 247, 0.6)'
                    : '0 0 8px rgba(236, 72, 153, 0.6)'
                  : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Glow effect at bottom based on bass */}
      {isActive && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-10 blur-md transition-opacity duration-100 ${
            playerNumber === 1
              ? 'bg-gradient-to-t from-purple-500 to-transparent'
              : 'bg-gradient-to-t from-pink-500 to-transparent'
          }`}
          style={{
            opacity: hasAudioData ? frequencyData.lowAvg * 0.5 : 0.2,
          }}
        />
      )}

      {/* Center line */}
      <div className="absolute bottom-1 left-0 right-0 h-[1px] bg-white/10" />

      <style>{`
        @keyframes wave {
          0% {
            transform: scaleY(0.3);
          }
          100% {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}
