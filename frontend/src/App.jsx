import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'
import RankingPageApp from './rank/ranking.jsx'

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
          꿀템
        </NavLink>
        <div className="site-links">
          <NavLink to="/" end>
            홈
          </NavLink>
          <NavLink to="/ranking">랭킹</NavLink>
          <NavLink to="/itemreg">등록</NavLink>
          {accessToken ? (
            <button className="nav-logout-button" type="button" onClick={handleLogout}>
              로그아웃
            </button>
          ) : (
            <NavLink to="/login">로그인</NavLink>
          )}
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/itemreg" element={<ItemRegPage />} />
        <Route path="/ranking" element={<RankingPageApp />} />
        <Route path="/user/:userId" element={<UserPage />} />
      </Routes>
    </>
  )
}

export default App
