import { useState } from 'react';
import { stopChannelBroadcast, startChannelBroadcast } from '../services/api';

export default function ChannelSection({
  currentUser,
  isBroadcasting,
  broadcastCode,
  viewerCount,
  selectedPlaylist,
  playlistRemainingInfo,
  formatPlaylistDuration,
  onBroadcastStart,
  onBroadcastStop,
  onShowBroadcastModal,
  onShowPlaylistModal,
  onShowPlaylistSettings,
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
      {/* Channel row */}
      <div className="p-3 flex items-center gap-3 border-b border-white/10">
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
          {isBroadcasting ? (
            <p className="text-green-300/60 text-xs">Viewers: {viewerCount ?? 0}</p>
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

      {/* Playlist row */}
      <div className="p-3 flex items-center gap-3">
        <div
          onClick={onShowPlaylistModal}
          className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
            </svg>
          </div>
          <div className="flex-1 text-left min-w-0">
            {selectedPlaylist ? (
              <>
                <p className="text-white font-medium text-sm truncate">{selectedPlaylist.name}</p>
                <p className="text-purple-300/60 text-xs">
                  {selectedPlaylist.videos?.length || 0} songs
                  {playlistRemainingInfo?.totalTime > 0 && (
                    <span className="ml-1">· {formatPlaylistDuration(playlistRemainingInfo.totalTime)}</span>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="text-white font-medium text-sm">Select Playlist</p>
                <p className="text-purple-300/60 text-xs">Choose or create a playlist</p>
              </>
            )}
          </div>
          <svg className="w-5 h-5 text-purple-300/50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>

        {/* Settings Button */}
        {selectedPlaylist && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowPlaylistSettings();
            }}
            className="p-2 rounded-lg bg-white/10 text-purple-300/60 hover:bg-white/20 hover:text-white transition-all flex-shrink-0"
            title="Playlist Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
