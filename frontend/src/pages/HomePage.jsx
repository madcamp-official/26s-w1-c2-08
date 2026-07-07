import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { buildApiUrl } from '../lib/api'

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
  const [recommendedUsers, setRecommendedUsers] = useState([])
  const [topUserItems, setTopUserItems] = useState({ username: '', items: [] })
  const [byCategory, setByCategory] = useState({})

  useEffect(() => {
    const fetchRecommendedUsers = async () => {
      try {
        const response = await axios.get(buildApiUrl('/recommend/'))
        setRecommendedUsers(response.data.results ?? [])
        setTopUserItems(
          response.data.top_user_items ?? { username: '', items: [] },
        )
        setByCategory(response.data.by_category ?? {})
      } catch (error) {
        console.error('추천 유저를 불러오지 못했습니다.', error)
      }
    }

    fetchRecommendedUsers()
  }, [])

  return (
    <main className="page-shell">
      <section className="home-hero">
        <h1 style={{ fontSize: '2rem' }}>
          써본 사람만 아는 진짜 꿀템을 한 곳에서
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

        <ul className="home-gallery">
          {GALLERY.map((src) => (
            <li className="home-gallery-item" key={src}>
              <img src={src} alt="" />
            </li>
          ))}
        </ul>

        {recommendedUsers.length > 0 && (
          <div className="home-highlight-section">
            <div className="home-section-header home-section-header-compact">
              <div>
                <p className="home-eyebrow">Top Honey Bees</p>
                <h2>인기 유저 TOP 5</h2>
              </div>
            </div>

            <ul className="home-user-row">
              {recommendedUsers.map((user, index) => (
                <li className="home-user-card" key={user.id}>
                  <Link to={`/user/${user.username}`}>
                    <span className="home-user-rank">{index + 1}</span>
                    <span className="home-user-name">{user.username}</span>
                    <span className="home-user-followers">팔로워 {user.follower_count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recommendedUsers.length > 0 && topUserItems.items.length > 0 && (
          <div className="home-divider" aria-hidden="true">
            <span />
          </div>
        )}

        {topUserItems.items.length > 0 && (
          <div className="home-highlight-section">
            <div className="home-section-header home-section-header-compact">
              <div>
                <p className="home-eyebrow">Best Picks</p>
                <h2>팔로워 1위 {topUserItems.username}님의 꿀템</h2>
              </div>
            </div>

            <ul className="home-item-row">
              {topUserItems.items.map((item) => (
                <li className="home-item-card" key={item.id}>
                  <Link to={`/items/${item.id}`}>
                    <span className="home-item-thumb">{item.name.slice(0, 1)}</span>
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
        )}

        {Object.keys(byCategory).length > 0 && (
          <div style={{ marginTop: '1px' }}>
            <h2>카테고리별 꿀벌</h2>

            {Object.entries(byCategory).map(([categoryValue, categoryData]) => (
              <div key={categoryValue} style={{ marginTop: '16px' }}>
                <h3>{categoryData.category_label}</h3>

                <ul>
                  {categoryData.top_users.map((user) => (
                    <li key={user.id}>
                      <Link to={`/user/${user.username}`}>
                        {user.username}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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