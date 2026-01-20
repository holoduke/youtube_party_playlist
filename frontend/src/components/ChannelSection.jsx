import { useState } from 'react';
import { stopChannelBroadcast, startChannelBroadcast } from '../services/api';

export default function ChannelSection({
  currentUser,
  isBroadcasting,
  broadcastCode,
  selectedPlaylist,
  onBroadcastStart,
  onBroadcastStop,
  onShowBroadcastModal,
  showNotification,
}) {
  const [isToggling, setIsToggling] = useState(false);

  if (!currentUser) return null;

  const handleToggleBroadcast = async () => {
    if (isToggling) return;
    setIsToggling(true);

    try {
      if (isBroadcasting) {
        await stopChannelBroadcast(currentUser.id);
        onBroadcastStop();
        showNotification('Broadcast stopped');
      } else {
        const result = await startChannelBroadcast(currentUser.id, selectedPlaylist?.id);
        onBroadcastStart(result);
        showNotification('Broadcast started');
      }
    } catch (error) {
      showNotification(isBroadcasting ? 'Failed to stop broadcast' : 'Failed to start broadcast', 'error');
    }

    setIsToggling(false);
  };

  return (
    <div className={`bg-white/5 backdrop-blur-xl rounded-xl border transition-all overflow-hidden ${isBroadcasting ? 'border-green-500/50' : 'border-white/10'}`}>
      <div className="p-3 flex items-center gap-3">
        {/* Broadcast toggle icon */}
        <button
          onClick={handleToggleBroadcast}
          disabled={isToggling}
          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
            isBroadcasting
              ? 'bg-green-500/20 hover:bg-green-500/30'
              : 'bg-white/10 hover:bg-white/20'
          } ${isToggling ? 'opacity-50' : ''}`}
          title={isBroadcasting ? 'Stop broadcasting' : 'Start broadcasting'}
        >
          {isToggling ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-purple-300/60" />
          ) : (
            <svg className={`w-5 h-5 ${isBroadcasting ? 'text-green-400' : 'text-purple-300/60'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
              <circle cx="12" cy="12" r="2" />
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
            </svg>
          )}
        </button>

        {/* Channel info */}
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isBroadcasting ? 'text-green-400' : 'text-white'}`}>
            Your Channel
          </p>
          {isBroadcasting && broadcastCode ? (
            <p className="text-green-300/60 text-xs">Code: {broadcastCode}</p>
          ) : (
            <p className="text-purple-300/60 text-xs">Click icon to broadcast</p>
          )}
        </div>

        {/* View icon - only when broadcasting */}
        {isBroadcasting && (
          <svg
            onClick={onShowBroadcastModal}
            className="w-5 h-5 text-purple-300/60 hover:text-white cursor-pointer transition-colors flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            title="View broadcast details"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </div>
    </div>
  );
}
