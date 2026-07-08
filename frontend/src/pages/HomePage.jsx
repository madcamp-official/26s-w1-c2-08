import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { buildApiUrl } from '../lib/api'
import heroArtwork from '../assets/c.avif'

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

const USER_SLOT_COUNT = 10
const USERS_PER_PAGE = 7
const USER_PAGE_COUNT = Math.ceil(USER_SLOT_COUNT / USERS_PER_PAGE)

function SectionDivider() {
  return <div className="section-divider" aria-hidden="true" />
}

function HomePage() {
  const [recommendedUsers, setRecommendedUsers] = useState([])
  const [topUserItems, setTopUserItems] = useState({ username: '', items: [] })
  const [categoryTopItems, setCategoryTopItems] = useState([])
  const [userPage, setUserPage] = useState(0)

  useEffect(() => {
    const fetchRecommendedUsers = async () => {
      try {
        const response = await axios.get(buildApiUrl('/recommend/'))
        setRecommendedUsers(response.data.results ?? [])
        setTopUserItems(
          response.data.top_user_items ?? { username: '', items: [] },
        )
        setCategoryTopItems(response.data.category_top_items ?? [])
      } catch (error) {
        console.error('추천 유저를 불러오지 못했습니다.', error)
      }
    }

    fetchRecommendedUsers()
  }, [])

  return (
    <main className="page-shell home-page-shell">
      <section className="home-hero">
        <div className="home-hero-intro">
          <div
            className="home-panel-shell home-panel-shell-intro"
            style={{
              backgroundImage: `
                linear-gradient(135deg, rgba(255, 250, 241, 0.82), rgba(255, 255, 255, 0.7)),
                url(${heroArtwork})
              `,
            }}
          >
            <div className="home-panel-copy home-panel-copy-intro">
              <h1 style={{ fontSize: '2rem' }}>
                써본 사람만 아는<br className="home-mobile-break" />{' '}
                진짜 꿀템을<br className="home-mobile-break" />{' '}
                한 곳에서
              </h1>

              <p className="home-lead">
                꿀템은 사용자들의 추천을 받아 카테고리별 아이템 순위를 매기는 서비스예요.
                <br />
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
            </div>
          </div>
        </div>

        <div className="home-highlight-section">
          <div className="home-panel-shell">
            <div className="home-section-header home-section-header-compact">
              <div>
                <p className="home-eyebrow">Category Best</p>
                <h2>카테고리별 1위 꿀템</h2>
              </div>
            </div>

            <ul className="home-item-row home-item-grid home-category-items">
              {categoryTopItems.map((item) => (
                <li className="home-item-card" key={item.id}>
                  <Link to={`/items/${item.id}`}>
                    <span className="home-item-thumb">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: 'inherit',
                          }}
                        />
                      ) : (
                        item.name.slice(0, 1)
                      )}
                    </span>
                    <span className="home-item-name">{item.name}</span>
                    <span className="home-item-footer">
                      <span className="home-item-brand-price">
                        {item.shop_or_brand_name}
                        {item.shop_or_brand_name ? ' · ' : ''}
                        {item.price.toLocaleString()}원
                      </span>
                      <span className="home-item-stars">
                        <span className="home-item-star">★</span>
                        {item.star_count}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <SectionDivider />

        <div className="home-highlight-section">
          <div className="home-panel-shell">
            <div className="home-section-header home-section-header-compact">
              <div>
                <p className="home-eyebrow">Top Honey Bees</p>
                <h2>인기 유저 랭킹</h2>
              </div>
            </div>

            <div className="home-user-carousel">
              {userPage > 0 && (
                <button
                  type="button"
                  className="home-carousel-arrow"
                  onClick={() => setUserPage((page) => Math.max(page - 1, 0))}
                  aria-label="이전 순위 보기"
                >
                  ‹
                </button>
              )}

              <ul className="home-user-row">
                {Array.from({ length: USERS_PER_PAGE }).map((_, slot) => {
                  const index = userPage * USERS_PER_PAGE + slot
                  const user = recommendedUsers[index]

                  if (!user) {
                    return (
                      <li className="home-user-card home-user-card-empty" key={`empty-${index}`}>
                        <span className="home-user-rank">{index + 1}</span>
                        <span className="home-user-name home-user-name-empty">-</span>
                        <span className="home-user-followers home-user-followers-empty">
                          placeholder
                        </span>
                      </li>
                    )
                  }

                  return (
                    <li className="home-user-card" key={user.id}>
                      <Link to={`/user/${user.id}`}>
                        <span className="home-user-rank">{index + 1}</span>
                        <span className="home-user-name">{user.username}</span>
                        <span className="home-user-followers">팔로워 {user.follower_count}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>

              {userPage < USER_PAGE_COUNT - 1 && (
                <button
                  type="button"
                  className="home-carousel-arrow"
                  onClick={() =>
                    setUserPage((page) => Math.min(page + 1, USER_PAGE_COUNT - 1))
                  }
                  aria-label="다음 순위 보기"
                >
                  ›
                </button>
              )}
            </div>
          </div>
        </div>

        {topUserItems.items.length > 0 && (
          <>
            <SectionDivider />

            <div className="home-highlight-section">
              <div className="home-section-header home-section-header-compact">
                <div>
                  <p className="home-eyebrow">Best Picks</p>
                  <h2 className="home-top-user-title">
                    팔로워 1위 '{topUserItems.username}'님의 꿀템
                  </h2>
                </div>
              </div>

              <ul className="home-item-row home-top-user-items">
                {topUserItems.items.map((item) => (
                  <li className="home-item-card" key={item.id}>
                    <Link to={`/items/${item.id}`}>
                      <span className="home-item-thumb">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              borderRadius: 'inherit',
                            }}
                          />
                        ) : (
                          item.name.slice(0, 1)
                        )}
                      </span>
                      <span className="home-item-name">{item.name}</span>
                      <span className="home-item-footer">
                        <span className="home-item-brand-price">
                          {item.shop_or_brand_name}
                          {item.shop_or_brand_name ? ' · ' : ''}
                          {item.price.toLocaleString()}원
                        </span>
                        <span className="home-item-stars">
                          <span className="home-item-star">★</span>
                          {item.star_count}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      <div className="home-section-header">
        <div>
          <h2>한눈에 보는 꿀템 활용법</h2>
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
