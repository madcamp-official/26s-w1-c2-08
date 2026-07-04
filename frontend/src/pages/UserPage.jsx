import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function UserPage() {
  const { userId } = useParams()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | success | not-found | error

  const [starredItems, setStarredItems] = useState([])
  const [starStatus, setStarStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false

    const fetchUser = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/user/${encodeURIComponent(userId)}/`,
        )

        if (!ignore) {
          setUser(response.data)
          setStatus('success')
        }
      } catch (error) {
        if (ignore) return

        if (error.response?.status === 404) {
          setStatus('not-found')
        } else {
          setStatus('error')
        }
      }
    }

    const fetchStarredItems = async () => {
    setStarStatus('loading')

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/items/users/${encodeURIComponent(userId)}/stars/`,
      )

      if (!ignore) {
        setStarredItems(response.data?.results ?? [])
        setStarStatus('success')
      }
    } catch (error) {
      if (!ignore) {
        setStarStatus('error')
      }
    }
  }

    fetchUser()
    fetchStarredItems()

    return () => {
      ignore = true
    }
  }, [userId])

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        {status === 'loading' && (
          <p className="state-text">불러오는 중...</p>
        )}

        {status === 'not-found' && (
          <div className="empty-state">
            <strong>사용자를 찾을 수 없습니다</strong>
            <p>'{userId}'에 해당하는 유저가 존재하지 않습니다.</p>
          </div>
        )}

        {status === 'error' && (
          <p className="feedback feedback-error">
            사용자 정보를 불러오는 중 오류가 발생했습니다.
          </p>
        )}

        {status === 'success' && user && (
          <>
            <div className="panel user-card">
              <p className="user-id-label">user id</p>
              <p className="user-id-value">{user.id}</p>
            </div>

            <div className="panel" style={{ marginTop: '24px', padding: '20px' }}>
              <h2 style={{ marginTop: 0 }}>별표한 아이템</h2>

              {starStatus === 'loading' && (
                <p className="state-text">불러오는 중...</p>
              )}

              {starStatus === 'error' && (
                <p className="feedback feedback-error">
                  별표 목록을 불러오는 중 오류가 발생했습니다.
                </p>
              )}

              {starStatus === 'success' && starredItems.length === 0 && (
                <p className="state-text">아직 별표한 아이템이 없습니다.</p>
              )}

              {starStatus === 'success' && starredItems.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {starredItems.map((item) => (
                    <li
                      key={item.itemId}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <Link to={`/items/${item.itemId}`} className="text-link">
                        {item.itemName}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default UserPage