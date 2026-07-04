import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'
import ItemPage from './itempage/ItemPage.jsx'
import ReviewPage from './reviewpage/ReviewPage.jsx'
import RankingPage from './rank/ranking.jsx'
import ItemStarPage from './pages/itemstartest.jsx'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function App() {
  const navigate = useNavigate()
  const { accessToken, refreshToken, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/accounts/logout/`,
        { refresh: refreshToken },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
    } catch (error) {
      console.error('로그아웃 API 실패, 로컬 토큰은 정리합니다.', error)
    } finally {
      logout()
      navigate('/login', { replace: true })
    }
  }

  return (
    <>
      <nav className="site-nav">
        <NavLink className="site-brand" to="/">
          wishlist
        </NavLink>
        <div className="site-links">
          <NavLink to="/" end>
            Main
          </NavLink>
          <NavLink to="/ranking">Ranking</NavLink>
          <NavLink to="/itemreg">Add item</NavLink>
        </div>
        <div className="site-utility">
          {accessToken ? (
            <button className="nav-logout-button" type="button" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <NavLink className="site-utility-item" to="/login">
              Login
            </NavLink>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/itemreg" element={<ItemRegPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/items/:itemId" element={<ItemPage />} />
        <Route path="/items/:itemId/reviews/:reviewId" element={<ReviewPage />} />
        <Route path="/user/:userId" element={<UserPage />} />
        <Route path="/teststar" element={<ItemStarPage />} />
      </Routes>
    </>
  )
}

export default App
