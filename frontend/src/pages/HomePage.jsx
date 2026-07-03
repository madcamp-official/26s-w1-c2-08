<<<<<<< HEAD
import { Link } from 'react-router-dom'

const FEATURES = [
  {
    index: '01',
    title: '사용자 추천수 랭킹',
    description: '추천/비추천 반응을 집계해 진짜 쓸만한 아이템만 상위에 노출해요.',
  },
  {
    index: '02',
    title: '카테고리별 탐색',
    description: '패션, 뷰티, 전자제품 등 카테고리로 필터링해 원하는 꿀템만 빠르게 찾아요.',
  },
  {
    index: '03',
    title: '간편한 아이템 등록',
    description: '구매 사이트 스크린샷을 올리면 추천하고 싶은 아이템을 등록할 수 있어요.',
  },
]

function HomePage() {
  return (
    <main className="page-shell">
      <section className="home-hero">
        <h1>써본 사람만 아는 진짜 꿀템을 한곳에서</h1>
        <p className="home-lead">
          꿀템은 사용자들의 추천을 받아 카테고리별 아이템 순위를 매기는 서비스예요.
          랭킹에서 검증된 아이템을 둘러보고, 내가 찾은 꿀템도 직접 등록해 보세요.
        </p>
        <div className="home-actions">
          <Link className="home-cta" to="/ranking">
            랭킹 보러 가기
          </Link>
          <Link className="home-cta-ghost" to="/itemreg">
            추천템 등록하기 <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <ul className="home-features">
        {FEATURES.map((feature) => (
          <li className="home-feature-card" key={feature.title}>
            <span className="home-feature-index">{feature.index}</span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default HomePage
=======
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
>>>>>>> fbd6ebd3b5afd882150707b9e79ee3cf74ce7c88
