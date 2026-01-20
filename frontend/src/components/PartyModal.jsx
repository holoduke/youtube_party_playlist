import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { goLivePlaylist } from '../services/api';

export default function PartyModal({
  isOpen,
  onClose,
  playlists,
  showNotification,
  onOpenAsHost,
}) {
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [liveResult, setLiveResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const getLiveUrl = (shareCode) => {
    const host = window.location.hostname;
    const port = window.location.port;
    const protocol = window.location.protocol;
    return `${protocol}//${host}${port ? ':' + port : ''}/live/${shareCode}`;
  };

  const handleGoLive = async () => {
    if (!selectedPlaylist) return;
    setLoading(true);
    try {
      const result = await goLivePlaylist(selectedPlaylist.id);
      setLiveResult(result);
    } catch (error) {
      console.error('Failed to go live:', error);
      showNotification('Failed to start live session', 'error');
    }
    setLoading(false);
  };

  const handleClose = () => {
    setPlaylistSearch('');
    setSelectedPlaylist(null);
    setDropdownOpen(false);
    setLiveResult(null);
    setLoading(false);
    onClose();
  };

  const filteredPlaylists = playlists.filter(p =>
    p.name.toLowerCase().includes(playlistSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content - Step 1: Select Playlist */}
        {!liveResult ? (
          <div>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Start Live Session
              </h2>
              <p className="text-purple-200/70 text-sm mt-1">
                Select a playlist to share with others
              </p>
            </div>

            {/* Playlist Selector */}
            <div className="relative mb-6">
              <label className="block text-purple-300 text-sm mb-2">Select Playlist</label>
              <div className="relative">
                <input
                  type="text"
                  value={selectedPlaylist ? selectedPlaylist.name : playlistSearch}
                  onChange={(e) => {
                    setPlaylistSearch(e.target.value);
                    setSelectedPlaylist(null);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Search playlists..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Dropdown */}
              {dropdownOpen && filteredPlaylists.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-purple-900/95 border border-purple-500/30 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {filteredPlaylists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        setSelectedPlaylist(playlist);
                        setPlaylistSearch('');
                        setDropdownOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors flex items-center gap-3"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{playlist.name}</p>
                        <p className="text-purple-300/60 text-xs">{playlist.videos_count || 0} videos</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {dropdownOpen && filteredPlaylists.length === 0 && (
                <div className="absolute z-10 w-full mt-2 bg-purple-900/95 border border-purple-500/30 rounded-xl shadow-xl p-4 text-center text-purple-300/60">
                  No playlists found
                </div>
              )}
            </div>

            {/* Selected Playlist Preview */}
            {selectedPlaylist && (
              <div className="mb-6 p-4 bg-white/5 border border-purple-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-semibold">{selectedPlaylist.name}</p>
                    <p className="text-purple-300/60 text-sm">{selectedPlaylist.videos_count || 0} videos ready to play</p>
                  </div>
                </div>
              </div>
            )}

            {/* Go Live Button */}
            <button
              onClick={handleGoLive}
              disabled={!selectedPlaylist || loading}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                selectedPlaylist && !loading
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/30'
                  : 'bg-white/10 text-white/40 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                  Go Live
                </>
              )}
            </button>
          </div>
        ) : (
          /* Content - Step 2: Live Session Created */
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                You're Live!
              </h2>
              <p className="text-purple-200/70 text-sm mt-1">
                Share this code with your friends
              </p>
            </div>

            {/* Share Code Display */}
            <div className="bg-black/30 rounded-xl p-4 mb-4">
              <p className="text-purple-300/60 text-xs mb-2 uppercase tracking-wide">Share Code</p>
              <p className="text-4xl font-mono font-bold text-white tracking-[0.3em]">
                {liveResult.share_code}
              </p>
            </div>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-2xl inline-block mb-4">
              <QRCodeSVG
                value={getLiveUrl(liveResult.share_code)}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* URL Display */}
            <div className="bg-black/30 rounded-xl p-3 mb-4">
              <p className="text-purple-300/60 text-xs mb-1 uppercase tracking-wide">Or share this URL</p>
              <p className="text-white font-mono text-sm break-all select-all">
                {getLiveUrl(liveResult.share_code)}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(getLiveUrl(liveResult.share_code));
                  showNotification('URL copied to clipboard!');
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </button>
              <button
                onClick={() => onOpenAsHost(liveResult)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Playing
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
