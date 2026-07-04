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
