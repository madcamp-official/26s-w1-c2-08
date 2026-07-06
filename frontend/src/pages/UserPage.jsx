import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import axios from 'axios'
import { buildApiUrl } from '../lib/api'
import { useAuth } from '../context/AuthContext'

function UserPage() {
  const { accessToken, userId } = useAuth()
  const { username } = useParams()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading') // loading | success | not-found | error

  const [starredItems, setStarredItems] = useState([])
  const [starStatus, setStarStatus] = useState('loading') // loading | success | error

  const [reviews, setReviews] = useState([])
  const [reviewStatus, setReviewStatus] = useState('loading') // loading | success | error

  const [createdItems, setCreatedItems] = useState([])
  const [createdItemsStatus, setCreatedItemsStatus] = useState('loading') // loading | success | error

  // 팔로우 상태
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followError, setFollowError] = useState('')

  // 팔로워/팔로잉 카운트
  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [countsStatus, setCountsStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false

    const fetchUser = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/user/${encodeURIComponent(username)}/`),
        )

        if (!ignore) {
          setUser(response.data)
          setStatus('success')

          fetchStarredItems(response.data.id)
          fetchUserReviews(response.data.id)
          fetchCreatedItems(response.data.id)
          fetchFollowCounts(response.data.id)
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

    const fetchStarredItems = async (userId) => {
      setStarStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/items/users/${userId}/stars/`),
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

    const fetchUserReviews = async (userId) => {
      setReviewStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl('/reviews/'),
          { params: { author_id: userId } },
        )

        if (!ignore) {
          setReviews(response.data?.results ?? response.data ?? [])
          setReviewStatus('success')
        }
      } catch (error) {
        if (!ignore) {
          setReviewStatus('error')
        }
      }
    }

    const fetchCreatedItems = async (userId) => {
      setCreatedItemsStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl('/items/'),
          { params: { created_by: userId } },
        )

        if (!ignore) {
          setCreatedItems(response.data?.results ?? response.data ?? [])
          setCreatedItemsStatus('success')
        }
      } catch (error) {
        if (!ignore) {
          setCreatedItemsStatus('error')
        }
      }
    }

    const fetchFollowCounts = async (targetUserId) => {
      setCountsStatus('loading')

      const headers = accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {}

      try {
        const [followersRes, followingRes] = await Promise.all([
          axios.get(buildApiUrl(`/user/${targetUserId}/followers/`), { headers }),
          axios.get(buildApiUrl(`/user/${targetUserId}/following/`), { headers }),
        ])

        if (!ignore) {
          const followersList =
            followersRes.data?.results ?? followersRes.data ?? []

          setFollowerCount(
            followersRes.data?.count ?? followersList.length ?? 0,
          )
          setFollowingCount(
            followingRes.data?.count ?? followingRes.data?.length ?? 0,
          )
          setCountsStatus('success')

          // 로그인 유저가 이 followers 목록에 있으면 이미 팔로우 중
          if (accessToken && userId !== null) {
            const alreadyFollowing = followersList.some(
              (item) => String(item.user?.id) === String(userId),
            )
            setIsFollowing(alreadyFollowing)
          }
        }
      } catch (error) {
        if (!ignore) {
          setCountsStatus('error')
        }
      }
    }

    fetchUser()

    return () => {
      ignore = true
    }
  }, [username, accessToken, userId])

  const handleFollowToggle = async () => {
    if (!user?.id || followLoading) return

    setFollowLoading(true)
    setFollowError('')

    const headers = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {}

    try {
      if (isFollowing) {
        await axios.delete(buildApiUrl(`/user/${user.id}/follow/`), { headers })
        setIsFollowing(false)
        setFollowerCount((prev) => (prev !== null ? prev - 1 : prev))
      } else {
        await axios.post(buildApiUrl(`/user/${user.id}/follow/`), {}, { headers })
        setIsFollowing(true)
        setFollowerCount((prev) => (prev !== null ? prev + 1 : prev))
      }
    } catch (error) {
      const status = error.response?.status

      if (status === 401) {
        setFollowError('로그인이 필요합니다.')
      } else if (status === 409) {
        setIsFollowing(true)
        setFollowError('이미 팔로우하고 있습니다.')
      } else if (status === 404) {
        setIsFollowing(false)
        setFollowError('팔로우 관계가 존재하지 않습니다.')
      } else {
        setFollowError('요청 중 오류가 발생했습니다.')
      }
    } finally {
      setFollowLoading(false)
    }
  }

  if (
    status === 'success' &&
    user &&
    userId !== null &&
    String(user.id) === String(userId)
  ) {
    return <Navigate to="/me" replace />
  }

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        {status === 'loading' && (
          <p className="state-text">불러오는 중...</p>
        )}

        {status === 'not-found' && (
          <div className="empty-state">
            <strong>사용자를 찾을 수 없습니다</strong>
            <p>'{username}'에 해당하는 유저가 존재하지 않습니다.</p>
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
              <p className="user-id-value">{username}</p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                {accessToken && (
                  <button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    style={{
                      backgroundColor: isFollowing ? '#9ca3af' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: followLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {followLoading
                      ? '처리 중...'
                      : isFollowing
                        ? '팔로잉'
                        : '팔로우'}
                  </button>
                )}

                {countsStatus === 'success' && (
                  <span className="state-text">
                    <Link to={`/user/${username}/follower`} className="text-link">
                      팔로워 {followerCount}
                    </Link>
                    {' · '}
                    <Link to={`/user/${username}/following`} className="text-link">
                      팔로잉 {followingCount}
                    </Link>
                  </span>
                )}

                {countsStatus === 'loading' && (
                  <span className="state-text">
                    팔로워/팔로잉 불러오는 중...
                  </span>
                )}

                {countsStatus === 'error' && (
                  <span className="feedback feedback-error">
                    팔로워/팔로잉 정보를 불러오지 못했습니다.
                  </span>
                )}
              </div>

              {followError && (
                <p className="feedback feedback-error" style={{ marginTop: '8px' }}>
                  {followError}
                </p>
              )}
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

            <div className="panel" style={{ marginTop: '24px', padding: '20px' }}>
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
                      <Link to={`/reviews/${review.id}`} className="text-link">
                        {review.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="panel" style={{ marginTop: '24px', padding: '20px' }}>
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