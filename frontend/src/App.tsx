import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LandingPage } from '@/pages/landing'
import { AppPage } from '@/pages/app-page'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="/app/:id" element={<AppPage />} />
      </Routes>
    </BrowserRouter>
  )
}
