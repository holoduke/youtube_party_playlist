export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-pink-950 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-black/40 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/20">
        <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
        <p className="text-white/60 mb-4">Last updated: January 2026</p>

        <div className="space-y-6 text-white/80">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Information We Collect</h2>
            <p>When you use Barmania, we may collect:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Account information (name, email) when you sign in with Google</li>
              <li>YouTube playlist data when you choose to import playlists</li>
              <li>Playlists and preferences you create within the app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Provide and improve the Barmania service</li>
              <li>Import your YouTube playlists at your request</li>
              <li>Save your playlists and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. Data Sharing</h2>
            <p>We do not sell or share your personal information with third parties, except as necessary to provide the service (e.g., Google OAuth for authentication).</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. YouTube API Services</h2>
            <p>Barmania uses YouTube API Services. By using our service, you agree to be bound by the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">YouTube Terms of Service</a> and <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Google Privacy Policy</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Data Security</h2>
            <p>We implement appropriate security measures to protect your data. OAuth tokens are encrypted at rest.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Your Rights</h2>
            <p>You can disconnect your Google account at any time, which will revoke our access to your YouTube data. You can also delete your account and all associated data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">7. Contact</h2>
            <p>For questions about this privacy policy, contact us at the email associated with this application.</p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <a href="/" className="text-purple-400 hover:text-purple-300 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Barmania
          </a>
        </div>
      </div>
    </div>
  );
}
