import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { buildApiUrl } from '../lib/api'

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

        <div style={{ marginTop: '1px' }}>
          <h2>인기 유저 TOP 5</h2>

          <ul>
            {recommendedUsers.map((user) => (
              <li key={user.id}>
                <Link to={`/user/${user.username}`}>
                  {user.username}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {topUserItems.items.length > 0 && (
          <div style={{ marginTop: '1px' }}>
            <h2>팔로워 1위 {topUserItems.username}님의 꿀템</h2>

            <ul>
              {topUserItems.items.map((item) => (
                <li key={item.id}>
                  <Link to={`/items/${item.id}`}>
                    {item.name}
                  </Link>
                  <span style={{ marginLeft: '8px' }}>
                    ⭐ {item.star_count} · {item.price.toLocaleString()}원
                  </span>
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
    </main>
  )
}

export default HomePage