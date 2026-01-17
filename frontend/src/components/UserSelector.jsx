import { useUser } from '../contexts/UserContext';

export default function UserSelector() {
  const { users, currentUser, selectUser, loading } = useUser();

  if (loading) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (currentUser) {
    return null; // User is selected, no UI needed
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-pink-900">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 max-w-lg border border-white/20 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
            BARMANIA
          </h1>
          <h2 className="text-xl text-white/80">Who's DJing today?</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {users.map(user => (
            <button
              key={user.id}
              onClick={() => selectUser(user)}
              className="group p-6 bg-white/5 hover:bg-white/15 rounded-2xl transition-all duration-300 border border-white/10 hover:border-purple-500/50 hover:scale-105"
            >
              <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-lg group-hover:shadow-purple-500/30">
                {user.name.charAt(0)}
              </div>
              <span className="text-white font-medium block">{user.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
