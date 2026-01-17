import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import RemotePlayer from './components/RemotePlayer.jsx'
import LivePlaylistPage from './components/LivePlaylistPage.jsx'
import PublicPlaylistPage from './components/PublicPlaylistPage.jsx'
import BroadcastViewer from './components/BroadcastViewer.jsx'
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
          <Route path="/broadcast/:hash" element={<BroadcastViewer />} />
          {/* Legacy route - redirect to new format */}
          <Route path="/playlist/:playlistId" element={<PublicPlaylistPage />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  </StrictMode>,
)
