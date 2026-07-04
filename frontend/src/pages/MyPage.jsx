import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function UserPage() {
  const { accessToken } = useAuth()

  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const [starredItems, setStarredItems] = useState([])
  const [starStatus, setStarStatus] = useState('loading')

  const [reviews, setReviews] = useState([])
  const [reviewStatus, setReviewStatus] = useState('loading')

  const [createdItems, setCreatedItems] = useState([])
  const [createdItemsStatus, setCreatedItemsStatus] = useState('loading')

  useEffect(() => {
    let ignore = false

    const fetchStarredItems = async (userId) => {
      setStarStatus('loading')

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/items/users/${userId}/stars/`,
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

    const fetchUserReviews = async (userId) => {
      setReviewStatus('loading')

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/reviews/`,
          { params: { author_id: userId } },
        )

        if (ignore) return

        setReviews(response.data?.results ?? response.data ?? [])
        setReviewStatus('success')
      } catch {
        if (!ignore) {
          setReviewStatus('error')
        }
      }
    }

    const fetchCreatedItems = async (userId) => {
      setCreatedItemsStatus('loading')

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/items/`,
          { params: { created_by: userId } },
        )

        if (ignore) return

        setCreatedItems(response.data?.results ?? response.data ?? [])
        setCreatedItemsStatus('success')
      } catch {
        if (!ignore) {
          setCreatedItemsStatus('error')
        }
      }
    }

    const fetchUser = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          `${API_BASE_URL}/api/accounts/me/`,
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
        fetchUserReviews(response.data.id)
        fetchCreatedItems(response.data.id)
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

            <div
              className="panel"
              style={{ marginTop: '24px', padding: '20px' }}
            >
              <h2 style={{ marginTop: 0 }}>작성한 리뷰</h2>

              {reviewStatus === 'loading' && (
                <p className="state-text">불러오는 중...</p>
              )}

              {reviewStatus === 'error' && (
                <p className="feedback feedback-error">
                  리뷰 목록을 불러오는 중 오류가 발생했습니다.
                </p>
              )}

              {reviewStatus === 'success' && reviews.length === 0 && (
                <p className="state-text">아직 작성한 리뷰가 없습니다.</p>
              )}

              {reviewStatus === 'success' && reviews.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <Link to={`/items/${review.item}/reviews/${review.id}`} className="text-link">
                        {review.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              className="panel"
              style={{ marginTop: '24px', padding: '20px' }}
            >
              <h2 style={{ marginTop: 0 }}>등록한 아이템</h2>

              {createdItemsStatus === 'loading' && (
                <p className="state-text">불러오는 중...</p>
              )}

              {createdItemsStatus === 'error' && (
                <p className="feedback feedback-error">
                  등록한 아이템 목록을 불러오는 중 오류가 발생했습니다.
                </p>
              )}

              {createdItemsStatus === 'success' && createdItems.length === 0 && (
                <p className="state-text">아직 등록한 아이템이 없습니다.</p>
              )}

              {createdItemsStatus === 'success' && createdItems.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {createdItems.map((item) => (
                    <li
                      key={item.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <Link to={`/items/${item.id}`} className="text-link">
                        {item.name}
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