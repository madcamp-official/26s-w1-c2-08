import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

function UserPage() {
  const { accessToken } = useAuth()

  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const [starredItems, setStarredItems] = useState([])
  const [starStatus, setStarStatus] = useState('loading')

  useEffect(() => {
    let ignore = false

    const fetchStarredItems = async (userId) => {
      setStarStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/items/users/${userId}/stars/`),
        )

        if (ignore) return

        setStarredItems(response.data?.results ?? [])
        setStarStatus('success')
      } catch {
        if (!ignore) {
          setStarStatus('error')
        }
      }
    }

    const fetchUser = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl('/accounts/me/'),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )

        if (ignore) return

        setUser(response.data)
        setStatus('success')

        fetchStarredItems(response.data.id)
      } catch {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

    fetchUser()

    return () => {
      ignore = true
    }
  }, [accessToken])

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        {status === 'loading' && (
          <p className="state-text">불러오는 중...</p>
        )}

        {status === 'error' && (
          <p className="feedback feedback-error">
            사용자 정보를 불러오는 중 오류가 발생했습니다.
          </p>
        )}

        {status === 'success' && user && (
          <>
            <div className="panel user-card">
              <p className="user-id-value">{user.username}</p>
            </div>

            <div
              className="panel"
              style={{ marginTop: '24px', padding: '20px' }}
            >
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
                      <Link
                        to={`/items/${item.itemId}`}
                        className="text-link"
                      >
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
