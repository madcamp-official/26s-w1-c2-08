import { Route, Routes } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'
import RankingApp from './rank/ranking.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/:userId" element={<UserPage />} />
      <Route path="/itemreg" element={<ItemRegPage />} />
      <Route path="/ranking" element={<RankingApp />} />
    </Routes>
  )
}

export default App
