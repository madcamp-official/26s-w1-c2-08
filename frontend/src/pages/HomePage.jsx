import { Link, NavLink, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import '../rank/ranking.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function HomePage() {
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
      <nav className="top-nav">
        <Link className="brand-link" to="/">
          꿀템
        </Link>

        <div className="nav-links">
          <NavLink to="/">홈</NavLink>
          <NavLink to="/ranking">랭킹</NavLink>

          {accessToken ? (
            <button
              onClick={handleLogout}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              로그아웃
            </button>
          ) : (
            <Link
              to="/login"
              style={{
                fontSize: '1rem',
              }}
            >
              로그인
            </Link>
          )}
        </div>
      </nav>

      <main className="app-shell">
        <section className="home-section">
          <p className="eyebrow">아이템 추천 웹 서비스</p>
          <h1>좋은 아이템을 빠르게 찾기</h1>

          <Link className="home-primary-link" to="/ranking">
            꿀템 랭킹 보기
          </Link>
        </section>
      </main>
    </>
  )
}

export default HomePage
