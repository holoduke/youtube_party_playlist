import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { getGoogleAuthStatus, disconnectGoogle, deleteUser } from '../services/api';

export default function AccountSettings({ onClose }) {
  const { currentUser, updateUser, loginWithGoogle, logout } = useUser();
  const [displayName, setDisplayName] = useState(currentUser?.name || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [googleStatus, setGoogleStatus] = useState(null);
  const [loadingGoogle, setLoadingGoogle] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (currentUser?.id) {
      loadGoogleStatus();
    }
  }, [currentUser?.id]);

  const loadGoogleStatus = async () => {
    setLoadingGoogle(true);
    try {
      const status = await getGoogleAuthStatus(currentUser.id);
      setGoogleStatus(status);
    } catch (err) {
      console.error('Failed to load Google status:', err);
      setGoogleStatus({ has_google_connected: false, has_youtube_access: false });
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) return;

    setSaving(true);
    try {
      // Update locally (in a real app, you'd also call an API)
      updateUser({ name: displayName.trim() });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!confirm('Are you sure you want to disconnect your Google account? You will lose access to YouTube playlist import.')) {
      return;
    }

    setDisconnecting(true);
    try {
      await disconnectGoogle(currentUser.id);
      setGoogleStatus({ has_google_connected: false, has_youtube_access: false });
      updateUser({ has_youtube_access: false, avatar: null });
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to disconnect Google account');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleting(true);
    try {
      await deleteUser(currentUser.id);
      logout();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-xl rounded-3xl p-6 max-w-md w-full border border-purple-500/20 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Account Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <section>
            <h3 className="text-sm font-medium text-purple-300 mb-3">Profile</h3>
            <div className="bg-black/20 rounded-xl p-4 space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-2xl">
                    {currentUser?.name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-white font-medium">{currentUser?.name}</p>
                  <p className="text-white/50 text-sm">{currentUser?.email}</p>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm text-white/70 mb-1">Display Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                    placeholder="Your display name"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !displayName.trim() || displayName === currentUser?.name}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                  >
                    {saving ? '...' : saved ? 'Saved!' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Connected Accounts Section */}
          <section>
            <h3 className="text-sm font-medium text-purple-300 mb-3">Connected Accounts</h3>
            <div className="bg-black/20 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Google</p>
                    {loadingGoogle ? (
                      <p className="text-white/50 text-sm">Loading...</p>
                    ) : googleStatus?.has_google_connected ? (
                      <p className="text-green-400 text-sm flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Connected
                        {googleStatus.has_youtube_access && ' - YouTube access'}
                      </p>
                    ) : (
                      <p className="text-white/50 text-sm">Not connected</p>
                    )}
                  </div>
                </div>

                {loadingGoogle ? null : googleStatus?.has_google_connected ? (
                  <button
                    onClick={handleDisconnectGoogle}
                    disabled={disconnecting}
                    className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={loginWithGoogle}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-800 rounded-lg text-sm font-medium transition-colors"
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Account Actions */}
          <section>
            <h3 className="text-sm font-medium text-purple-300 mb-3">Account</h3>
            <div className="bg-black/20 rounded-xl p-4 space-y-3">
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to sign out?')) {
                    logout();
                    onClose();
                  }
                }}
                className="w-full py-2.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>

              <div className="border-t border-white/10 pt-3">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete All My Data
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                      <p className="text-red-300 text-sm font-medium mb-1">Warning: This action cannot be undone!</p>
                      <p className="text-red-300/80 text-xs">
                        This will permanently delete your account, all your playlists, and any connected services. You will be logged out immediately.
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm text-white/70 mb-1">
                        Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        className="w-full px-3 py-2 bg-white/10 border border-red-500/30 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-red-500"
                        placeholder="Type DELETE"
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          setDeleteConfirmText('');
                        }}
                        className="flex-1 py-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={deleteConfirmText !== 'DELETE' || deleting}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        {deleting ? 'Deleting...' : 'Delete Forever'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-white/10 flex justify-center gap-4 text-xs text-white/40">
          <a href="/privacy" className="hover:text-white/60">Privacy Policy</a>
          <span>|</span>
          <a href="/terms" className="hover:text-white/60">Terms of Service</a>
        </div>
      </div>
    </div>
  );
}
