import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../rank/ranking.css'
import './itempage.css'
import { apiFetch, buildApiUrl } from '../lib/api'

const CATEGORY_LABELS = {
  fashion: '의류/패션',
  food: '식품',
  beauty: '뷰티',
  electronics: '전자제품',
  appliances: '가전제품',
  living: '생활용품',
  health: '건강',
  sports: '스포츠/레저',
  books_hobby: '도서/취미',
  kids_pets: '유아/반려동물',
  etc: '기타',
}

function formatPrice(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '가격 정보 없음'
  }

  return `${numeric.toLocaleString('ko-KR')}원`
}

function getReviewScore(review) {
  return review.like_count - review.dislike_count
}

function sortReviews(reviews) {
  return [...reviews].sort((left, right) => {
    const scoreDiff = getReviewScore(right) - getReviewScore(left)
    if (scoreDiff !== 0) return scoreDiff

    const likeDiff = right.like_count - left.like_count
    if (likeDiff !== 0) return likeDiff

    const dislikeDiff = left.dislike_count - right.dislike_count
    if (dislikeDiff !== 0) return dislikeDiff

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

async function readJson(response) {
  return response.json().catch(() => null)
}

function normalizeReviewListPayload(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.results)) {
    return payload.results
  }

  return []
}

async function readErrorMessage(response) {
  try {
    const data = await response.json()
    return data.detail ?? '요청을 처리하지 못했습니다.'
  } catch {
    return '요청을 처리하지 못했습니다.'
  }
}

function normalizeError(data, fallbackMessage) {
  if (!data) {
    return fallbackMessage
  }

  if (typeof data.detail === 'string') {
    return data.detail
  }

  if (typeof data === 'string') {
    return data
  }

  if (Array.isArray(data)) {
    return data.join(' ')
  }

  if (typeof data === 'object') {
    return Object.values(data)
      .flat()
      .map((value) => (typeof value === 'string' ? value : String(value)))
      .join(' ')
  }

  return fallbackMessage
}

function formatDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category ?? '기타'
}

function ItemPage() {
  const { itemId } = useParams()
  const { accessToken, userId } = useAuth()
  const [item, setItem] = useState(null)
  const [reviews, setReviews] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [reviewsError, setReviewsError] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingTarget, setPendingTarget] = useState('')
  const [brokenImage, setBrokenImage] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadPage() {
      setIsLoading(true)
      setErrorMessage('')
      setReviewsError('')
      setNotice('')

      try {
        const [itemResponse, initialReviewsResponse] = await Promise.all([
          apiFetch(`/items/${itemId}/`, {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {},
          }),
          apiFetch(
            `${buildApiUrl('/reviews/')}?item_id=${encodeURIComponent(itemId)}${
              userId ? `&user_id=${encodeURIComponent(userId)}` : ''
            }`,
          ),
        ])

        if (!itemResponse.ok) {
          throw new Error('아이템 정보를 불러오지 못했습니다.')
        }
        const itemData = await itemResponse.json()

        if (!isMounted) {
          return
        }

        setBrokenImage(false)
        setItem(itemData)

        let reviewsResponse = initialReviewsResponse
        let reviewsFallbackUsed = false

        if (!reviewsResponse.ok && userId) {
          reviewsResponse = await apiFetch(`${buildApiUrl('/reviews/')}?item_id=${encodeURIComponent(itemId)}`)
          reviewsFallbackUsed = reviewsResponse.ok
        }

        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json()
          if (!isMounted) {
            return
          }
          setReviews(sortReviews(normalizeReviewListPayload(reviewsData)))
          if (reviewsFallbackUsed) {
            setNotice('내 반응 상태를 제외한 리뷰 목록만 먼저 표시합니다.')
          }
        } else {
          setReviews([])
          setReviewsError('리뷰 목록을 불러오지 못했습니다.')
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : '아이템 상세 화면을 불러오지 못했습니다.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadPage()

    return () => {
      isMounted = false
    }
  }, [itemId, accessToken, userId])

  async function refreshItem() {
    const itemResponse = await apiFetch(`/items/${itemId}/`, {
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : {},
    })

    if (!itemResponse.ok) {
      throw new Error('아이템 정보를 새로고침하지 못했습니다.')
    }

    const itemData = await itemResponse.json()
    setItem(itemData)
  }

  async function handleItemStarToggle() {
    if (!accessToken) {
      setNotice('아이템 추천은 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget('item-recommend')
    setNotice('')

    try {
      const response = await apiFetch(`/items/${itemId}/star/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        throw new Error('로그인이 필요합니다.')
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const wasAdded = response.status === 201
      setItem((currentItem) =>
        currentItem
          ? {
              ...currentItem,
              starCount: wasAdded
                ? (currentItem.starCount ?? 0) + 1
                : Math.max((currentItem.starCount ?? 1) - 1, 0),
              isStarred: wasAdded,
            }
          : currentItem,
      )
      await refreshItem()
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '별표를 저장하지 못했습니다.',
      )
    } finally {
      setPendingTarget('')
    }
  }

  async function handleReviewReaction(reviewId, reaction) {
    if (!accessToken || !userId) {
      setNotice('리뷰 좋아요와 싫어요는 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget(`review-${reviewId}-${reaction}`)
    setNotice('')

    try {
      const response = await apiFetch(`/reviews/${reviewId}/reaction/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          reaction,
        }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '리뷰 반응을 저장하지 못했습니다.'))
      }

      const updatedReview = await response.json()
      setReviews((currentReviews) =>
        sortReviews(
          currentReviews.map((review) =>
            review.id === updatedReview.id ? updatedReview : review,
          ),
        ),
      )
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '리뷰 반응을 저장하지 못했습니다.',
      )
    } finally {
      setPendingTarget('')
    }
  }

  const showReviewCreateButton = Boolean(accessToken && userId)

  return (
    <main className="page-shell">
      {notice && <p className="notice">{notice}</p>}

      <section className="item-page-section">
        {isLoading && <p className="state-text">상세 정보를 불러오는 중입니다.</p>}

        {!isLoading && errorMessage && (
          <div className="empty-state">
            <strong>연결 실패</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && item && (
          <>
            <article className="item-hero-card">
              <div className="item-hero-image" aria-hidden="true">
                {item.image_url && !brokenImage ? (
                  <img src={item.image_url} alt="" onError={() => setBrokenImage(true)} />
                ) : (
                  <span>{item.name.slice(0, 1)}</span>
                )}
              </div>

                <div className="item-hero-body">
                  <div className="item-hero-heading">
                    <div>
                      <p className="item-category-badge">{getCategoryLabel(item.category)}</p>
                      <h2>{item.name}</h2>
                    </div>
                  <div className="item-score-panel">
                    <strong>{item.starCount ?? 0}</strong>
                    <span>추천 수</span>
                  </div>
                </div>

                <dl className="item-detail-grid">
                  <div>
                    <dt>브랜드/쇼핑몰</dt>
                    <dd>{item.shop_or_brand_name}</dd>
                  </div>
                  <div>
                    <dt>가격</dt>
                    <dd>{formatPrice(item.price)}</dd>
                  </div>
                  <div>
                    <dt>리뷰 수</dt>
                    <dd>{reviews.length}</dd>
                  </div>
                </dl>

                <div className="item-hero-actions">
                  <button
                    className={
                      item.isStarred
                        ? 'reaction-button active-positive'
                        : 'reaction-button'
                    }
                    type="button"
                    disabled={pendingTarget === 'item-recommend'}
                    onClick={() => handleItemStarToggle()}
                  >
                    추천 {item.starCount ?? 0}
                  </button>
                  {item.original_url && (
                    <a
                      className="product-link"
                      href={item.original_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      원본 URL 이동
                    </a>
                  )}
                </div>
              </div>
            </article>

            <section className="review-section">
              <div className="review-section-header">
                <div>
                  <h3>리뷰 목록</h3>
                  <p>좋아요와 싫어요 반응을 기준으로 리뷰가 정렬됩니다.</p>
                </div>
                <div className="review-section-utility">
                  {showReviewCreateButton && (
                    <Link className="primary-button" to={`/items/${itemId}/reviews/new`}>
                      리뷰 작성
                    </Link>
                  )}
                  <span className="review-count-chip">{reviews.length}개 리뷰</span>
                </div>
              </div>

              {reviewsError ? (
                <div className="empty-state">
                  <strong>리뷰 연결 실패</strong>
                  <p>{reviewsError}</p>
                </div>
              ) : reviews.length === 0 ? (
                <div className="empty-state">
                  <strong>아직 리뷰가 없습니다.</strong>
                  <p>첫 리뷰가 등록되면 이곳에 표시됩니다.</p>
                </div>
              ) : (
                <ol className="review-list">
                  {reviews.map((review, index) => (
                    <li className="review-card" key={review.id}>
                      <div className="review-rank-badge">{index + 1}</div>
                      <Link
                        className="review-card-link"
                        to={`/items/${itemId}/reviews/${review.id}`}
                      >
                        <div className="review-card-header">
                          <div>
                            <p className="review-meta">
                              작성자 #{review.author} · {formatDate(review.created_at)}
                            </p>
                            <h4>{review.title}</h4>
                          </div>
                        </div>

                        <p className="review-content">{review.content}</p>
                      </Link>

                      <div className="review-footer">
                        <div className="review-stats">
                          <span>좋아요 {review.like_count}</span>
                          <span>싫어요 {review.dislike_count}</span>
                          <span>댓글 {review.comments_count}</span>
                        </div>

                        <div className="review-actions">
                          <Link
                            className="review-comment-link"
                            to={`/items/${itemId}/reviews/${review.id}`}
                          >
                            <span>댓글 보기</span>
                            <strong>{review.comments_count}</strong>
                          </Link>
                          <div className="review-reaction-group">
                            <button
                              className={
                                review.user_reaction === 'like'
                                  ? 'reaction-button active-positive'
                                  : 'reaction-button'
                              }
                              type="button"
                              disabled={pendingTarget === `review-${review.id}-like`}
                              onClick={() => handleReviewReaction(review.id, 'like')}
                            >
                              좋아요
                            </button>
                            <button
                              className={
                                review.user_reaction === 'dislike'
                                  ? 'reaction-button active-negative'
                                  : 'reaction-button'
                              }
                              type="button"
                              disabled={pendingTarget === `review-${review.id}-dislike`}
                              onClick={() => handleReviewReaction(review.id, 'dislike')}
                            >
                              싫어요
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export default ItemPage
