import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBroadcastByCode } from '../services/api';

export default function BroadcastCodeEntry() {
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Focus first input on mount
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleInput = (index, value) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    // Move to next input if digit entered
    if (digit && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3) {
      const fullCode = newCode.join('');
      if (fullCode.length === 4) {
        handleSubmit(fullCode);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length === 4) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs[3].current?.focus();
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (fullCode) => {
    if (fullCode.length !== 4) {
      setError('Please enter a 4-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await getBroadcastByCode(fullCode);
      if (result.success && result.hash) {
        navigate(`/broadcast/${result.hash}`);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Broadcast not found. Check the code and try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      // Clear code on error
      setCode(['', '', '', '']);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-black/40 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8 max-w-md w-full">
        <div className="text-center">
          {/* Header */}
          <div className="mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
                <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
                <circle cx="12" cy="12" r="2" />
                <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
                <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Join Broadcast</h1>
            <p className="text-purple-200/70">
              Enter the 4-digit code to watch the live broadcast
            </p>
          </div>

          {/* Code Input */}
          <div className="flex justify-center gap-3 mb-6" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInput(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading}
                className={`w-16 h-20 text-4xl font-bold text-center rounded-xl border-2 bg-black/30 text-white outline-none transition-all ${
                  error
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-purple-500/30 focus:border-purple-500'
                } ${loading ? 'opacity-50' : ''}`}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-2 text-purple-300">
              <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Connecting...</span>
            </div>
          )}

          {/* Instructions */}
          <p className="text-purple-200/50 text-sm mt-8">
            The code is displayed on the DJ's screen when broadcasting
          </p>
        </div>
      </div>
    </div>
  );
}
