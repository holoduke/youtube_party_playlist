import { useState, useRef } from 'react';
import { updatePlaylist, uploadPlaylistIdleImage, deletePlaylistIdleImage, IDLE_IMAGE_PRESETS, getPresetImageUrl } from '../services/api';

export default function PlaylistSettingsModal({
  isOpen,
  onClose,
  playlist,
  onPlaylistUpdated,
  showNotification,
}) {
  const [customImage, setCustomImage] = useState(null);
  const [customImagePreview, setCustomImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen || !playlist) return null;

  // Determine current selection based on playlist data
  const currentIdlePath = playlist.idle_image_path;
  const isPreset = currentIdlePath?.startsWith('presets/');
  const currentPresetId = isPreset ? currentIdlePath.replace('presets/', '').replace('.png', '') : null;

  const handlePresetSelect = async (presetId) => {
    setSaving(true);
    try {
      await updatePlaylist(playlist.id, { idle_image_preset: presetId });
      onPlaylistUpdated();
      showNotification?.('Idle screen updated');
    } catch (error) {
      console.error('Failed to update idle screen:', error);
      showNotification?.('Failed to update idle screen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification?.('Image must be less than 5MB', 'error');
        return;
      }
      setCustomImage(file);
      setCustomImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCustomUpload = async () => {
    if (!customImage) return;
    setUploading(true);
    try {
      await uploadPlaylistIdleImage(playlist.id, customImage);
      setCustomImage(null);
      setCustomImagePreview(null);
      onPlaylistUpdated();
      showNotification?.('Custom image uploaded');
    } catch (error) {
      console.error('Failed to upload image:', error);
      showNotification?.('Failed to upload image', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    setSaving(true);
    try {
      await deletePlaylistIdleImage(playlist.id);
      onPlaylistUpdated();
      showNotification?.('Idle screen removed');
    } catch (error) {
      console.error('Failed to remove idle screen:', error);
      showNotification?.('Failed to remove idle screen', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancelCustomUpload = () => {
    setCustomImage(null);
    if (customImagePreview) {
      URL.revokeObjectURL(customImagePreview);
    }
    setCustomImagePreview(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gradient-to-br from-purple-900/90 to-pink-900/90 backdrop-blur-xl rounded-3xl border border-purple-500/30 p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-white mb-1">Playlist Settings</h2>
        <p className="text-purple-300/70 text-sm mb-6">{playlist.name}</p>

        {/* Idle Screen Section */}
        <div className="space-y-4">
          <div>
            <h3 className="text-white font-medium mb-1">Idle Screen Image</h3>
            <p className="text-purple-300/60 text-sm">
              Shown to viewers when broadcast is paused or no video is playing.
            </p>
          </div>

          {/* Current Image Preview */}
          {playlist.idle_image_url && !customImagePreview && (
            <div className="relative group">
              <img
                src={playlist.idle_image_url}
                alt="Current idle screen"
                className="w-full h-40 object-cover rounded-xl border border-white/10"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                <button
                  onClick={handleRemoveImage}
                  disabled={saving}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Removing...' : 'Remove'}
                </button>
              </div>
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white/80">
                {isPreset ? 'Preset' : 'Custom'}
              </div>
            </div>
          )}

          {/* Preset Options */}
          <div>
            <p className="text-purple-300/80 text-sm mb-2">Preset Images</p>
            <div className="grid grid-cols-2 gap-2">
              {IDLE_IMAGE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  disabled={saving}
                  className={`relative p-2 rounded-xl border-2 transition-all disabled:opacity-50 ${
                    currentPresetId === preset.id
                      ? 'border-purple-400 bg-purple-500/20'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <img
                    src={getPresetImageUrl(preset.id)}
                    alt={preset.name}
                    className="w-full h-16 object-cover rounded-lg mb-1"
                  />
                  <span className="text-xs text-white/80">{preset.name}</span>
                  {currentPresetId === preset.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Upload */}
          <div>
            <p className="text-purple-300/80 text-sm mb-2">Custom Image</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />

            {customImagePreview ? (
              <div className="space-y-2">
                <img
                  src={customImagePreview}
                  alt="Preview"
                  className="w-full h-32 object-cover rounded-xl border border-white/10"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCustomUpload}
                    disabled={uploading}
                    className="flex-1 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Use This Image'}
                  </button>
                  <button
                    onClick={cancelCustomUpload}
                    disabled={uploading}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Click to upload custom image
                <span className="block text-xs text-white/40 mt-1">JPG, PNG, GIF, WebP (max 5MB)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
