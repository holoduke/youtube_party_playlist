import { useState, useEffect, useRef, useCallback } from 'react';

export default function useAudioAnalyzer() {
  const [isListening, setIsListening] = useState(false);
  const [frequencyData, setFrequencyData] = useState(null);
  const [error, setError] = useState(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);

  const startListening = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        }
      });

      streamRef.current = stream;

      // Create audio context
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256; // Gives us 128 frequency bins
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Connect microphone to analyser
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      setIsListening(true);
      setError(null);

      // Start animation loop
      const updateFrequencyData = () => {
        if (!analyserRef.current) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Split into low (bass) and high (treble) frequencies
        const third = Math.floor(bufferLength / 3);

        const lowFreq = dataArray.slice(0, third); // Bass
        const midFreq = dataArray.slice(third, third * 2); // Mids
        const highFreq = dataArray.slice(third * 2); // Treble

        // Calculate averages
        const lowAvg = lowFreq.reduce((a, b) => a + b, 0) / lowFreq.length;
        const midAvg = midFreq.reduce((a, b) => a + b, 0) / midFreq.length;
        const highAvg = highFreq.reduce((a, b) => a + b, 0) / highFreq.length;

        setFrequencyData({
          raw: Array.from(dataArray),
          low: lowFreq,
          mid: midFreq,
          high: highFreq,
          lowAvg: lowAvg / 255,
          midAvg: midAvg / 255,
          highAvg: highAvg / 255,
          overall: (lowAvg + midAvg + highAvg) / 3 / 255,
        });

        animationRef.current = requestAnimationFrame(updateFrequencyData);
      };

      updateFrequencyData();

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(err.message || 'Could not access microphone');
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setFrequencyData(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    frequencyData,
    error,
    startListening,
    stopListening,
  };
}
