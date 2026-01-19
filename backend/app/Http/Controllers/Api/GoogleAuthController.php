<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\OAuthToken;
use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    private const YOUTUBE_SCOPES = [
        'https://www.googleapis.com/auth/youtube.readonly',
    ];

    /**
     * Redirect to Google OAuth consent screen.
     */
    public function redirect(Request $request)
    {
        // Store the frontend return URL for after callback
        session(['oauth_return_url' => $request->input('return_url', '/')]);

        return Socialite::driver('google')
            ->scopes(self::YOUTUBE_SCOPES)
            ->with(['access_type' => 'offline', 'prompt' => 'consent'])
            ->redirect();
    }

    /**
     * Handle the OAuth callback from Google.
     */
    public function callback(Request $request)
    {
        try {
            $googleUser = Socialite::driver('google')->user();
        } catch (\Exception $e) {
            $returnUrl = session('oauth_return_url', '/');
            return redirect($returnUrl . '?error=google_auth_failed');
        }

        // Find existing user by google_id or email
        $user = User::where('google_id', $googleUser->getId())
            ->orWhere('email', $googleUser->getEmail())
            ->first();

        if ($user) {
            // Link Google account if not already linked
            if (!$user->google_id) {
                $user->update([
                    'google_id' => $googleUser->getId(),
                    'avatar' => $googleUser->getAvatar(),
                ]);
            }
        } else {
            // Create new user
            $user = User::create([
                'name' => $googleUser->getName(),
                'email' => $googleUser->getEmail(),
                'google_id' => $googleUser->getId(),
                'avatar' => $googleUser->getAvatar(),
                'password' => null,
            ]);
        }

        // Store/update OAuth tokens
        OAuthToken::updateOrCreate(
            ['user_id' => $user->id, 'provider' => 'google'],
            [
                'access_token' => $googleUser->token,
                'refresh_token' => $googleUser->refreshToken,
                'expires_at' => now()->addSeconds($googleUser->expiresIn ?? 3600),
                'scopes' => self::YOUTUBE_SCOPES,
            ]
        );

        // Redirect back to frontend with user data encoded
        $returnUrl = session('oauth_return_url', '/');
        $userData = base64_encode(json_encode([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'avatar' => $user->avatar,
            'has_youtube_access' => true,
        ]));

        return redirect($returnUrl . '?oauth_user=' . $userData);
    }

    /**
     * Disconnect Google account from user.
     */
    public function disconnect(Request $request)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $user = User::findOrFail($request->user_id);

        // Only allow disconnect if user has a password set
        if (!$user->password) {
            return response()->json([
                'error' => 'Cannot disconnect Google - no password set. Please set a password first.'
            ], 400);
        }

        $user->oauthTokens()->where('provider', 'google')->delete();
        $user->update(['google_id' => null, 'avatar' => null]);

        return response()->json(['success' => true]);
    }

    /**
     * Check if user has YouTube access.
     */
    public function status(Request $request)
    {
        $request->validate(['user_id' => 'required|exists:users,id']);

        $user = User::findOrFail($request->user_id);
        $token = $user->googleToken();

        return response()->json([
            'has_google_connected' => $user->hasGoogleConnected(),
            'has_youtube_access' => $token && !$token->isExpired(),
            'avatar' => $user->avatar,
        ]);
    }
}
