import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import RemotePlayer from './components/RemotePlayer.jsx'
import LivePlaylistPage from './components/LivePlaylistPage.jsx'
import { UserProvider } from './contexts/UserContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/remote" element={<RemotePlayer />} />
          <Route path="/live/:shareCode" element={<LivePlaylistPage />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  </StrictMode>,
)
