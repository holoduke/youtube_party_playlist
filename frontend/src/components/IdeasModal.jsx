import { useState, useEffect, useRef } from 'react';
import { getIdeas, createIdea, toggleIdeaDone, deleteIdea } from '../services/api';

export default function IdeasModal({ currentUser, onClose }) {
  const [ideas, setIdeas] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newIdea, setNewIdea] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadIdeas();
    // Focus input after mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const data = await getIdeas(currentUser?.id);
      setIdeas(data.ideas);
      setIsAdmin(data.is_admin);
    } catch (err) {
      console.error('Failed to load ideas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newIdea.trim() || submitting) return;

    setSubmitting(true);
    try {
      const idea = await createIdea(currentUser.id, newIdea.trim());
      setIdeas([idea, ...ideas]);
      setNewIdea('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to create idea:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDone = async (idea) => {
    if (!isAdmin || togglingId) return;

    setTogglingId(idea.id);
    try {
      const updated = await toggleIdeaDone(idea.id, currentUser.id);
      setIdeas(ideas.map(i => i.id === idea.id ? updated : i));
    } catch (err) {
      console.error('Failed to toggle idea:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (idea) => {
    if (deletingId) return;

    // Only owner or admin can delete
    if (idea.user_id !== currentUser.id && !isAdmin) return;

    setDeletingId(idea.id);
    try {
      await deleteIdea(idea.id, currentUser.id);
      setIdeas(ideas.filter(i => i.id !== idea.id));
    } catch (err) {
      console.error('Failed to delete idea:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const pendingIdeas = ideas.filter(i => !i.is_done);
  const doneIdeas = ideas.filter(i => i.is_done);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-purple-900/90 to-indigo-900/90 backdrop-blur-xl rounded-3xl p-6 max-w-lg w-full border border-purple-500/20 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Ideas & Wishes</h2>
              <p className="text-xs text-purple-300/60">Share your suggestions for the app</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add new idea form */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newIdea}
              onChange={(e) => setNewIdea(e.target.value)}
              placeholder="Share your idea or suggestion..."
              maxLength={1000}
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!newIdea.trim() || submitting}
              className="px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium rounded-xl hover:from-yellow-400 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          </div>
        </form>

        {/* Ideas list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
            </div>
          ) : ideas.length === 0 ? (
            <div className="text-center py-12 text-purple-300/60">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <p>No ideas yet</p>
              <p className="text-sm mt-1">Be the first to share an idea!</p>
            </div>
          ) : (
            <>
              {/* Pending ideas */}
              {pendingIdeas.length > 0 && (
                <div className="space-y-2">
                  {pendingIdeas.map(idea => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      currentUser={currentUser}
                      isAdmin={isAdmin}
                      onToggle={handleToggleDone}
                      onDelete={handleDelete}
                      togglingId={togglingId}
                      deletingId={deletingId}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}

              {/* Done ideas */}
              {doneIdeas.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-400/70 mt-4 mb-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Completed ({doneIdeas.length})</span>
                  </div>
                  {doneIdeas.map(idea => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      currentUser={currentUser}
                      isAdmin={isAdmin}
                      onToggle={handleToggleDone}
                      onDelete={handleDelete}
                      togglingId={togglingId}
                      deletingId={deletingId}
                      formatDate={formatDate}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Admin indicator */}
        {isAdmin && (
          <div className="mt-4 pt-3 border-t border-white/10 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Admin: You can mark ideas as done
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function IdeaCard({ idea, currentUser, isAdmin, onToggle, onDelete, togglingId, deletingId, formatDate }) {
  const canDelete = idea.user_id === currentUser?.id || isAdmin;
  const isToggling = togglingId === idea.id;
  const isDeleting = deletingId === idea.id;

  return (
    <div className={`group relative bg-black/20 rounded-xl p-4 transition-all ${idea.is_done ? 'opacity-60' : ''}`}>
      <div className="flex gap-3">
        {/* Checkbox/status indicator */}
        <button
          onClick={() => onToggle(idea)}
          disabled={!isAdmin || isToggling}
          className={`w-6 h-6 flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
            idea.is_done
              ? 'bg-green-500 border-green-500 text-white'
              : isAdmin
                ? 'border-white/30 hover:border-purple-500 hover:bg-purple-500/20'
                : 'border-white/20 cursor-default'
          } ${isToggling ? 'opacity-50' : ''}`}
          title={isAdmin ? (idea.is_done ? 'Mark as pending' : 'Mark as done') : 'Only admins can mark as done'}
        >
          {isToggling ? (
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : idea.is_done ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={`text-white ${idea.is_done ? 'line-through text-white/60' : ''}`}>
            {idea.content}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-purple-300/50">
            {idea.user?.avatar ? (
              <img src={idea.user.avatar} alt="" className="w-4 h-4 rounded-full" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[8px] text-white font-bold">
                {idea.user?.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
            <span>{idea.user?.name}</span>
            <span className="text-purple-300/30">·</span>
            <span>{formatDate(idea.created_at)}</span>
            {idea.is_done && idea.completed_by_user && (
              <>
                <span className="text-purple-300/30">·</span>
                <span className="text-green-400/70">Done by {idea.completed_by_user.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Delete button */}
        {canDelete && (
          <button
            onClick={() => onDelete(idea)}
            disabled={isDeleting}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-white/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Delete idea"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
