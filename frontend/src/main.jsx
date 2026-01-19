import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import RemotePlayer from './components/RemotePlayer.jsx'
import LivePlaylistPage from './components/LivePlaylistPage.jsx'
import PublicPlaylistPage from './components/PublicPlaylistPage.jsx'
import BroadcastViewer from './components/BroadcastViewer.jsx'
import BroadcastCodeEntry from './components/BroadcastCodeEntry.jsx'
import PrivacyPolicy from './components/PrivacyPolicy.jsx'
import TermsOfService from './components/TermsOfService.jsx'
import { UserProvider } from './contexts/UserContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/remote" element={<RemotePlayer />} />
          <Route path="/live/:shareCode" element={<LivePlaylistPage />} />
          <Route path="/watch" element={<PublicPlaylistPage />} />
          <Route path="/broadcast" element={<BroadcastCodeEntry />} />
          <Route path="/broadcast/:hash" element={<BroadcastViewer />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* Legacy route - redirect to new format */}
          <Route path="/playlist/:playlistId" element={<PublicPlaylistPage />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  </StrictMode>,
)
