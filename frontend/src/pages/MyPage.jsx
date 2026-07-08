import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'
import { FALLBACK_CATEGORIES } from '../constants/categories'

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

  const [followerCount, setFollowerCount] = useState(null)
  const [followingCount, setFollowingCount] = useState(null)
  const [countsStatus, setCountsStatus] = useState('loading')

  const [starCategory, setStarCategory] = useState('all')
  const [createdCategory, setCreatedCategory] = useState('all')

  const [isStarFilterOpen, setIsStarFilterOpen] = useState(false)
  const [isCreatedFilterOpen, setIsCreatedFilterOpen] = useState(false)

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

    const fetchUserReviews = async (userId) => {
      setReviewStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl('/reviews/'),
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
          buildApiUrl('/items/'),
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
        fetchUserReviews(response.data.id)
        fetchCreatedItems(response.data.id)
        fetchFollowCounts(response.data.id)
      } catch {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

    const fetchFollowCounts = async (userId) => {
      setCountsStatus('loading')

      try {
        const [followersRes, followingRes] = await Promise.all([
          axios.get(buildApiUrl(`/user/${userId}/followers/`)),
          axios.get(buildApiUrl(`/user/${userId}/following/`)),
        ])

        if (ignore) return

        setFollowerCount(
          followersRes.data?.count ?? followersRes.data?.length ?? 0,
        )
        setFollowingCount(
          followingRes.data?.count ?? followingRes.data?.length ?? 0,
        )
        setCountsStatus('success')
      } catch {
        if (!ignore) {
          setCountsStatus('error')
        }
      }
    }

    fetchUser()

    return () => {
      ignore = true
    }
  }, [accessToken])

  const visibleStarredItems =
    starCategory === 'all'
      ? starredItems
      : starredItems.filter((item) => item.category === starCategory)

  const visibleCreatedItems =
    createdCategory === 'all'
      ? createdItems
      : createdItems.filter((item) => item.category === createdCategory)

  const starCategoryLabel =
    starCategory === 'all'
      ? '전체'
      : FALLBACK_CATEGORIES.find((c) => c.value === starCategory)?.label ?? '전체'

  const createdCategoryLabel =
    createdCategory === 'all'
      ? '전체'
      : FALLBACK_CATEGORIES.find((c) => c.value === createdCategory)?.label ?? '전체'

  return (
    <main className="page-shell">
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
            <div
              className="panel user-profile-header"
              style={{
                display: 'flex',
                flexWrap: 'nowrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div>
                <p className="user-profile-name">{user.username}</p>
                <p className="user-profile-name">
                  <Link to={`/user/${user.id}/follower`} className="text-link">
                    팔로워 {followerCount}
                  </Link>
                  {' · '}
                  <Link to={`/user/${user.id}/following`} className="text-link">
                    팔로잉 {followingCount}
                  </Link>
                </p>
              </div>

              <Link
                to={`/me/change-username`}
                className="text-link"
                style={{
                  flexShrink: 0,
                  marginLeft: 'auto',
                  padding: '6px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                ID 변경
              </Link>
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
                        <Link
                          to={`/items/${review.item}/reviews/${review.id}`}
                          className="text-link"
                          style={{ fontWeight: 'normal' }}
                        >
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