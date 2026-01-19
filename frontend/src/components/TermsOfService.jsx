export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-950 to-pink-950 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-black/40 backdrop-blur-xl rounded-3xl p-8 border border-purple-500/20">
        <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
        <p className="text-white/60 mb-4">Last updated: January 2026</p>

        <div className="space-y-6 text-white/80">
          <section>
            <h2 className="text-xl font-semibold text-white mb-2">1. Acceptance of Terms</h2>
            <p>By accessing and using Barmania, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">2. Description of Service</h2>
            <p>Barmania is a music playlist management application that allows users to create, manage, and share playlists. The service integrates with YouTube to enable playlist imports and video playback.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">3. User Accounts</h2>
            <p>You may sign in using your Google account. You are responsible for maintaining the security of your account and for all activities that occur under your account.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use the service for any illegal purpose</li>
              <li>Attempt to gain unauthorized access to the service</li>
              <li>Interfere with or disrupt the service</li>
              <li>Violate YouTube's Terms of Service while using our YouTube integration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">5. Third-Party Services</h2>
            <p>Barmania uses YouTube API Services. Your use of YouTube content through our service is subject to <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">YouTube's Terms of Service</a>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">6. Intellectual Property</h2>
            <p>The Barmania service and its original content are owned by the developer. YouTube videos and content accessed through the service remain the property of their respective owners.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">7. Disclaimer of Warranties</h2>
            <p>The service is provided "as is" without warranties of any kind. We do not guarantee that the service will be uninterrupted or error-free.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">8. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">9. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-2">10. Contact</h2>
            <p>For questions about these terms, contact us at the email associated with this application.</p>
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
