import { QRCodeSVG } from 'qrcode.react';
import { updatePlaylist, getPlaylist } from '../services/api';

export default function PublishModal({
  isOpen,
  onClose,
  playlist,
  onPlaylistUpdated,
  showNotification,
  loadPlaylists,
}) {
  if (!isOpen || !playlist) return null;

  const shareUrl = `${window.location.origin}/watch?pl=${playlist.hash}`;

  const handleUnpublish = async () => {
    try {
      await updatePlaylist(playlist.id, { is_public: false });
      const updated = await getPlaylist(playlist.id);
      onPlaylistUpdated(updated);
      loadPlaylists();
      onClose();
      showNotification('Playlist unpublished');
    } catch (error) {
      console.error('Failed to unpublish:', error);
      showNotification('Failed to unpublish', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-8 max-w-md w-full mx-4 shadow-2xl">
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
          <div className="mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Playlist Published!
            </h2>
            <p className="text-purple-200/70 text-sm mt-1">
              "{playlist.name}" is now public
            </p>
          </div>

          {/* QR Code */}
          <div className="bg-white p-4 rounded-2xl inline-block mb-4">
            <QRCodeSVG
              value={shareUrl}
              size={180}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* URL Display */}
          <div className="bg-black/30 rounded-xl p-3 mb-4">
            <p className="text-purple-300/60 text-xs mb-1 uppercase tracking-wide">Share this URL</p>
            <p className="text-white font-mono text-sm break-all select-all">
              {shareUrl}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
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
              onClick={handleUnpublish}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Unpublish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
