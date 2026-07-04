import { Link } from 'react-router-dom'

const FEATURES = [
  {
    title: '사용자 추천수 랭킹',
    description: '사용자 추천 반응을 집계해 진짜 쓸만한 아이템만 상위에 노출해요.',
  },
  {
    title: '카테고리별 탐색',
    description: '패션, 뷰티, 전자제품 등 카테고리로 필터링해 원하는 꿀템만 빠르게 찾아요.',
  },
  {
    title: '간편한 아이템 등록',
    description: '구매 사이트 스크린샷을 올리면 추천하고 싶은 아이템을 등록할 수 있어요.',
  },
]

const GALLERY = [
  'https://images.unsplash.com/photo-1567016432779-094069958ea5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
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

        <ul className="home-gallery">
          {GALLERY.map((src) => (
            <li className="home-gallery-item" key={src}>
              <img src={src} alt="" />
            </li>
          ))}
        </ul>
      </section>

      <div className="home-section-header">
        <div>
          <span className="home-eyebrow">Why wishlist</span>
          <h2>사람들의 추천템을 한 눈에</h2>
        </div>
      </div>

      <ul className="home-features">
        {FEATURES.map((feature) => (
          <li className="home-feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default HomePage
