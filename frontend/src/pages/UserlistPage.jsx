import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'
import '../pages/userlist.css'

function UserListPage() {
  const { accessToken } = useAuth()

  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading') // loading | success | error
  const [recommendedUsers, setRecommendedUsers] = useState([])
  const [topUserItems, setTopUserItems] = useState({ username: '', items: [] })
  const [byCategory, setByCategory] = useState({})

  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    let ignore = false

    const fetchUsers = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(buildApiUrl('/user/'), {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
        })

        if (!ignore) {
          setUsers(response.data?.users ?? [])
          setStatus('success')
        }
      } catch (error) {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

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

    fetchUsers()
    fetchRecommendedUsers()

    return () => {
      ignore = true
    }
  }, [accessToken])

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const isSearching = normalizedSearchTerm.length > 0

  const searchedUsers = isSearching
    ? users.filter((user) =>
        user.username.toLowerCase().includes(normalizedSearchTerm),
      )
    : []

  return (
    <main className="page-shell">
      <section className="page-content">
        <div style={{ marginTop: '40px' }}>

          <div style={{ margin: '16px 0' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="유저 이름 검색"
              aria-label="유저 이름 검색"
              style={{ width: '100%', padding: '10px 12px' }}
            />
          </div>

          {isSearching ? (
            <div style={{ marginTop: '24px' }}>
              {status === 'loading' && (
                <p className="state-text">불러오는 중...</p>
              )}

              {status === 'error' && (
                <p className="feedback feedback-error">
                  유저 목록을 불러오는 중 오류가 발생했습니다.
                </p>
              )}

              {status === 'success' && searchedUsers.length === 0 && (
                <p className="state-text">
                  '{searchTerm}'에 해당하는 유저가 없습니다.
                </p>
              )}

              {status === 'success' && searchedUsers.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {searchedUsers.map((user) => (
                    <li
                      key={user.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <Link to={`/user/${user.id}`} className="text-link">
                        {user.username}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            Object.keys(byCategory).length > 0 &&
            Object.entries(byCategory).map(([categoryValue, categoryData]) => (
              <div
                key={categoryValue}
                style={{
                  marginTop: '32px',
                  paddingTop: '24px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <h3 style={{ marginBottom: '12px' }}>{categoryData.category_label}</h3>

                <ol className="ranking-list category-user-list">
                  {categoryData.top_users.map((user, index) => {
                    const rank = index + 1
                    const rankBadgeClass =
                      rank === 1
                        ? 'rank-badge rank-badge-gold'
                        : rank === 2
                          ? 'rank-badge rank-badge-silver'
                          : rank === 3
                            ? 'rank-badge rank-badge-bronze'
                            : 'rank-badge'

                    return (
                      <li className="ranking-item" key={user.id}>
                        <div className={rankBadgeClass}>
                          {rank === 1 && (
                            <span className="rank-star" aria-hidden="true">★</span>
                          )}
                          {rank}
                        </div>

                        <Link
                          className="item-image"
                          to={`/user/${user.id}`}
                          aria-label={user.username}
                        >
                          <span>{user.username.slice(0, 1).toUpperCase()}</span>
                        </Link>

                        <div className="item-body">
                          <div className="item-heading">
                            <h2 className="ranking-item-link">{user.username}</h2>
                          </div>

                          <div className="item-meta">
                            <span>팔로워 {user.follower_count}</span>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

export default UserListPage