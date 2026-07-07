import { Link, NavLink, Route, Routes, useNavigate, Navigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from './context/AuthContext'
import { FALLBACK_CATEGORIES } from './constants/categories'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import SignupPage from './pages/SignupPage'
import UserPage from './pages/UserPage'
import ItemRegPage from './itemreg/ItemRegPage.jsx'
import ItemPage from './itempage/ItemPage.jsx'
import ReviewPage from './reviewpage/ReviewPage.jsx'
import ReviewCreatePage from './reviewcreate/ReviewCreatePage.jsx'
import RankingPage from './rank/ranking.jsx'
import MyPage from './pages/MyPage.jsx'
import { buildApiUrl } from './lib/api'
import UserlistPage from './pages/UserlistPage.jsx'
import FollowerListPage from './pages/FollowerPage.jsx'
import FollowingListPage from './pages/FollowingPage.jsx'
import IdChangePage from './pages/IdchangePage.jsx'

function App() {
  const navigate = useNavigate()
  const { accessToken, refreshToken, userId, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await axios.post(
        buildApiUrl('/accounts/logout/'),
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
          <svg
            className="site-brand-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden="true"
          >
            <circle
              cx="8"
              cy="13"
              r="5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
            />
            <line
              x1="11.5"
              y1="16.5"
              x2="16"
              y2="21"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M17 2L18.5 5.5L22 7L18.5 8.5L17 12L15.5 8.5L12 7L15.5 5.5Z"
              fill="currentColor"
            />
          </svg>
          꿀템
        </NavLink>
        <div className="site-links">
          <NavLink className="nav-link-main" to="/" end>
            Main
          </NavLink>
          <div className="nav-item nav-item-ranking">
            <NavLink className="nav-link-ranking" to="/ranking">
              Ranking
            </NavLink>
            <div className="nav-dropdown">
              {FALLBACK_CATEGORIES.map((category) => (
                <Link
                  className="nav-dropdown-item"
                  key={category.value}
                  to={`/ranking?category=${encodeURIComponent(category.value)}`}
                >
                  {category.label}
                </Link>
              ))}
            </div>
          </div>
          <NavLink className="nav-link-additem" to="/itemreg">
            Add item
          </NavLink>
          <NavLink className="nav-link-users" to="/users">
            Users
          </NavLink>
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
          <NavLink
            className="nav-user-icon"
            to={accessToken && userId ? `/me` : '/login'}
            aria-label="내 프로필"
            title="내 프로필"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="8" r="4" fill="currentColor" />
              <path
                d="M4 20c0-4.418 3.582-7 8-7s8 2.582 8 7"
                fill="currentColor"
              />
            </svg>
          </NavLink>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/itemreg/*" element={<ItemRegPage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/items/:itemId" element={<ItemPage />} />
        <Route path="/items/:itemId/reviews/new" element={<ReviewCreatePage />} />
        <Route path="/items/:itemId/reviews/:reviewId" element={<ReviewPage />} />
        <Route path="/me" element={<MyPage />} />
        <Route path="/user/:userId" element={<UserPage />} />
        <Route path="/users" element={<UserlistPage />} />
        <Route path="/user/:userId/follower" element={<FollowerListPage />} />
        <Route path="/user/:userId/following" element={<FollowingListPage />} />
        <Route path="/me/change-username" element={<IdChangePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
