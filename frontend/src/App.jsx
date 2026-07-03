import { Navigate, Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/:userId" element={<UserPage />} />
      <Route path="/itemreg" element={<ItemRegPage />} />
      <Route path="/ranking" element={<RankingPage />} />
    </Routes>
  )
}

export default App
