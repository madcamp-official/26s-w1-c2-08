import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import axios from 'axios'
import { buildApiUrl } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { FALLBACK_CATEGORIES } from '../constants/categories'

function UserPage() {
  const { accessToken, userId: authUserId } = useAuth()
  const { userId } = useParams()

  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const [starredItems, setStarredItems] = useState([])
  const [starStatus, setStarStatus] = useState('loading')

  const [reviews, setReviews] = useState([])
  const [reviewStatus, setReviewStatus] = useState('loading')

  const [createdItems, setCreatedItems] = useState([])
  const [createdItemsStatus, setCreatedItemsStatus] = useState('loading')

  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followError, setFollowError] = useState('')

  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [countsStatus, setCountsStatus] = useState('loading')

  const [starCategory, setStarCategory] = useState('all')
  const [createdCategory, setCreatedCategory] = useState('all')
  const [isStarFilterOpen, setIsStarFilterOpen] = useState(false)
  const [isCreatedFilterOpen, setIsCreatedFilterOpen] = useState(false)

  useEffect(() => {
    let ignore = false

    const fetchUser = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/user/${userId}/`)
        )

        if (!ignore) {
          setUser(response.data)
          setStatus('success')

          fetchStarredItems(userId)
          fetchUserReviews(userId)
          fetchCreatedItems(userId)
          fetchFollowCounts(userId)
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

    const fetchStarredItems = async (id) => {
      setStarStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/items/users/${id}/stars/`)
        )

        if (!ignore) {
          setStarredItems(response.data?.results ?? [])
          setStarStatus('success')
        }
      } catch {
        if (!ignore) setStarStatus('error')
      }
    }

    const fetchUserReviews = async (id) => {
      setReviewStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl('/reviews/'),
          { params: { author_id: id } }
        )

        if (!ignore) {
          setReviews(response.data?.results ?? response.data ?? [])
          setReviewStatus('success')
        }
      } catch {
        if (!ignore) setReviewStatus('error')
      }
    }

    const fetchCreatedItems = async (id) => {
      setCreatedItemsStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl('/items/'),
          { params: { created_by: id } }
        )

        if (!ignore) {
          setCreatedItems(response.data?.results ?? response.data ?? [])
          setCreatedItemsStatus('success')
        }
      } catch {
        if (!ignore) setCreatedItemsStatus('error')
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

          if (accessToken && authUserId !== null) {
            const alreadyFollowing = followersList.some(
              (item) => String(item.user?.id) === String(authUserId)
            )
            setIsFollowing(alreadyFollowing)
          }
        }
      } catch {
        if (!ignore) setCountsStatus('error')
      }
    }

    fetchUser()

    return () => {
      ignore = true
    }
  }, [userId, accessToken, authUserId])

  const handleFollowToggle = async () => {
    if (!user?.id || followLoading) return

    setFollowLoading(true)
    setFollowError('')

    const headers = accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : {}

    try {
      if (isFollowing) {
        await axios.delete(buildApiUrl(`/user/${user.id}/follow/`), {
          headers,
        })

        setIsFollowing(false)
        setFollowerCount((prev) => (prev !== null ? prev - 1 : prev))
      } else {
        await axios.post(
          buildApiUrl(`/user/${user.id}/follow/`),
          {},
          { headers }
        )

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

  const visibleStarredItems =
    starCategory === 'all'
      ? starredItems
      : starredItems.filter((item) => item.category === starCategory)

  const visibleCreatedItems =
    createdCategory === 'all'
      ? createdItems
      : createdItems.filter((item) => item.category === createdCategory)

  const starCategoryLabel =
    FALLBACK_CATEGORIES.find((c) => c.value === starCategory)?.label ?? '전체'

  const createdCategoryLabel =
    FALLBACK_CATEGORIES.find((c) => c.value === createdCategory)?.label ?? '전체'

  if (
    status === 'success' &&
    user &&
    authUserId !== null &&
    String(user.id) === String(authUserId)
  ) {
    return <Navigate to="/me" replace />
  }

  return (
    <main className="page-shell">
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
            <div className="panel user-profile-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <p className="user-profile-name">{user.username}</p>

                {accessToken && (
                  <button
                    type="button"
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    style={{
                      backgroundColor: isFollowing ? '#9ca3af' : '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '13px',
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
              </div>

              <p className="user-profile-name">
                {countsStatus === 'success' && (
                  <>
                    <Link to={`/user/${userId}/follower`} className="text-link">
                      팔로워 {followerCount}
                    </Link>
                    {' · '}
                    <Link to={`/user/${userId}/following`} className="text-link">
                      팔로잉 {followingCount}
                    </Link>
                  </>
                )}

                {countsStatus === 'loading' && '팔로워/팔로잉 불러오는 중...'}

                {countsStatus === 'error' && (
                  <span className="feedback feedback-error">
                    팔로워/팔로잉 정보를 불러오지 못했습니다.
                  </span>
                )}
              </p>

              {followError && (
                <p className="feedback feedback-error" style={{ marginTop: '8px' }}>
                  {followError}
                </p>
              )}
            </div>

            <div className="user-profile-sections">
              <div className="panel user-profile-section">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <h2 style={{ margin: 0 }}>별표한 아이템</h2>

                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsStarFilterOpen((prev) => !prev)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                        color: 'var(--text-strong)',
                        font: 'inherit',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {starCategoryLabel}
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          transition: 'transform 0.2s ease',
                          transform: isStarFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        ▾
                      </span>
                    </button>

                    {isStarFilterOpen && (
                      <div
                        className="category-filter"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          zIndex: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          flexWrap: 'nowrap',
                          alignItems: 'flex-start',
                          gap: '4px',
                          width: 'max-content',
                          minWidth: '140px',
                          margin: 0,
                          padding: '12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                      >
                        {FALLBACK_CATEGORIES.map((category) => (
                          <button
                            key={category.value}
                            type="button"
                            className={
                              starCategory === category.value
                                ? 'category-button active-category'
                                : 'category-button'
                            }
                            onClick={() => {
                              setStarCategory(category.value)
                              setIsStarFilterOpen(false)
                            }}
                            style={{ width: '100%', textAlign: 'left' }}
                          >
                            {category.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

                {starStatus === 'success' &&
                  starredItems.length > 0 &&
                  visibleStarredItems.length === 0 && (
                    <p className="state-text">해당 카테고리의 아이템이 없습니다.</p>
                  )}

                {starStatus === 'success' && visibleStarredItems.length > 0 && (
                  <ul className="user-profile-list">
                    {visibleStarredItems.map((item) => (
                      <li key={item.itemId}>
                        <Link
                          to={`/items/${item.itemId}`}
                          className="text-link"
                          style={{ fontWeight: 'normal' }}
                        >
                          {item.itemName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel user-profile-section">
                <h2>작성한 리뷰</h2>

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
                  <ul className="user-profile-list">
                    {reviews.map((review) => (
                      <li key={review.id}>
                        <Link to={`/items/${review.item}/reviews/${review.id}`} className="text-link" style={{ fontWeight: 'normal' }}>
                          {review.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel user-profile-section">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <h2 style={{ margin: 0 }}>등록한 아이템</h2>

                  <div style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setIsCreatedFilterOpen((prev) => !prev)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'var(--surface)',
                        color: 'var(--text-strong)',
                        font: 'inherit',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {createdCategoryLabel}
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          transition: 'transform 0.2s ease',
                          transform: isCreatedFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        }}
                      >
                        ▾
                      </span>
                    </button>

                    {isCreatedFilterOpen && (
                      <div
                        className="category-filter"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          zIndex: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          flexWrap: 'nowrap',
                          alignItems: 'flex-start',
                          gap: '4px',
                          width: 'max-content',
                          minWidth: '140px',
                          margin: 0,
                          padding: '12px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                      >
                        {FALLBACK_CATEGORIES.map((category) => (
                          <button
                            key={category.value}
                            type="button"
                            className={
                              createdCategory === category.value
                                ? 'category-button active-category'
                                : 'category-button'
                            }
                            onClick={() => {
                              setCreatedCategory(category.value)
                              setIsCreatedFilterOpen(false)
                            }}
                            style={{ width: '100%', textAlign: 'left' }}
                          >
                            {category.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

                {createdItemsStatus === 'success' &&
                  createdItems.length > 0 &&
                  visibleCreatedItems.length === 0 && (
                    <p className="state-text">해당 카테고리의 아이템이 없습니다.</p>
                  )}

                {createdItemsStatus === 'success' && visibleCreatedItems.length > 0 && (
                  <ul className="user-profile-list">
                    {visibleCreatedItems.map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/items/${item.id}`}
                          className="text-link"
                          style={{ fontWeight: 'normal' }}
                        >
                          {item.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default UserPage