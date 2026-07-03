import { Link, NavLink } from 'react-router-dom'
import '../rank/ranking.css'

function HomePage() {
  return (
    <>
      <nav className="top-nav">
        <Link className="brand-link" to="/">
          꿀템
        </Link>
        <div className="nav-links">
          <NavLink to="/">홈</NavLink>
          <NavLink to="/ranking">랭킹</NavLink>
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
