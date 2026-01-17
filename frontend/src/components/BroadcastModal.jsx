import { QRCodeSVG } from 'qrcode.react';

export default function BroadcastModal({
  isOpen,
  onClose,
  playlistName,
  broadcastHash,
  onStopBroadcast,
  showNotification,
}) {
  if (!isOpen) return null;

  const broadcastUrl = `${window.location.origin}/broadcast/${broadcastHash}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-red-500/30 p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          {/* Header with live indicator */}
          <div className="mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-red-400 font-bold uppercase tracking-wide">Broadcasting</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{playlistName}</h2>
            <p className="text-purple-200/70 text-sm mt-1">
              Share this link with viewers
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl inline-block mb-4">
            <QRCodeSVG
              value={broadcastUrl}
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* URL Display */}
          <div className="bg-black/30 rounded-xl p-3 mb-4">
            <p className="text-purple-300/60 text-xs mb-1 uppercase tracking-wide">Broadcast URL</p>
            <p className="text-white font-mono text-sm break-all select-all">
              {broadcastUrl}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(broadcastUrl);
                showNotification('URL copied to clipboard!');
              }}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy URL
            </button>
            <button
              onClick={() => window.open(broadcastUrl, '_blank')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Open Viewer
            </button>
          </div>

          {/* Stop Broadcasting button */}
          <button
            onClick={onStopBroadcast}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 border border-red-500/30 rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
            Stop Broadcasting
          </button>
        </div>
      </div>
    </div>
  );
}
