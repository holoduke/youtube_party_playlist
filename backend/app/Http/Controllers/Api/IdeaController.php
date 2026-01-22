<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Idea;
use App\Models\User;
use Illuminate\Http\Request;

class IdeaController extends Controller
{
    /**
     * Admin usernames who can mark ideas as done.
     */
    private const ADMIN_USERNAMES = ['gillis', 'arjan'];

    /**
     * Check if a user is an admin.
     */
    private function isAdmin(?int $userId): bool
    {
        if (!$userId) {
            return false;
        }

        $user = User::find($userId);
        return $user && in_array(strtolower($user->name), self::ADMIN_USERNAMES);
    }

    /**
     * GET /api/ideas - Get all ideas (recent first, pending first).
     */
    public function index(Request $request)
    {
        $ideas = Idea::with(['user:id,name,avatar', 'completedByUser:id,name'])
            ->orderBy('is_done', 'asc')
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        // Include admin status for current user
        $isAdmin = $this->isAdmin($request->input('user_id'));

        return response()->json([
            'ideas' => $ideas,
            'is_admin' => $isAdmin,
        ]);
    }

    /**
     * POST /api/ideas - Create a new idea.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'content' => 'required|string|max:1000',
        ]);

        $idea = Idea::create($validated);

        return response()->json(
            $idea->load(['user:id,name,avatar']),
            201
        );
    }

    /**
     * PUT /api/ideas/{idea}/toggle-done - Toggle done status (admin only).
     */
    public function toggleDone(Request $request, Idea $idea)
    {
        $userId = $request->input('user_id');

        if (!$this->isAdmin($userId)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $idea->is_done = !$idea->is_done;

        if ($idea->is_done) {
            $idea->completed_by = $userId;
            $idea->completed_at = now();
        } else {
            $idea->completed_by = null;
            $idea->completed_at = null;
        }

        $idea->save();

        return response()->json(
            $idea->load(['user:id,name,avatar', 'completedByUser:id,name'])
        );
    }

    /**
     * DELETE /api/ideas/{idea} - Delete an idea (owner or admin only).
     */
    public function destroy(Request $request, Idea $idea)
    {
        $userId = $request->input('user_id');

        // Allow deletion by owner or admin
        if ($idea->user_id !== (int)$userId && !$this->isAdmin($userId)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $idea->delete();

        return response()->json(['success' => true]);
    }
}
