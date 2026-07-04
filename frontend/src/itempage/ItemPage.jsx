import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import '../rank/ranking.css'
import './itempage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

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

function getStoredUserId() {
  if (typeof window === 'undefined') {
    return ''
  }

  // 추후 localStorage에 숫자형 user id가 저장되면 아래 구현으로 되돌립니다.
  // return window.localStorage.getItem('ggultem-user-id')?.trim() ?? ''
  return 1
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
  const [item, setItem] = useState(null)
  const [reviews, setReviews] = useState([])
  const [isItemRecommended, setIsItemRecommended] = useState(false)
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
        const userId = getStoredUserId()
        const [itemResponse, initialReviewsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/items/${itemId}/`),
          fetch(
            `${API_BASE_URL}/reviews/?item_id=${encodeURIComponent(itemId)}${
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
          reviewsResponse = await fetch(`${API_BASE_URL}/reviews/?item_id=${encodeURIComponent(itemId)}`)
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

        if (userId) {
          try {
            const itemReactionResponse = await fetch(
              `${API_BASE_URL}/items/${itemId}/reactions/${encodeURIComponent(userId)}/`,
            )

            if (!isMounted) {
              return
            }

            if (itemReactionResponse.ok) {
              const reactionData = await itemReactionResponse.json()
              setIsItemRecommended(Boolean(reactionData.is_recommended))
            } else if (itemReactionResponse.status === 404) {
              setIsItemRecommended(false)
            } else {
              setNotice('내 아이템 반응 상태를 불러오지 못했습니다.')
            }
          } catch {
            if (isMounted) {
              setNotice('내 아이템 반응 상태를 불러오지 못했습니다.')
            }
          }
        } else {
          setIsItemRecommended(false)
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
  }, [itemId])

  async function refreshItemAndReaction() {
    const userId = getStoredUserId()
    const [itemResponse, reactionResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/items/${itemId}/`),
      userId
        ? fetch(`${API_BASE_URL}/items/${itemId}/reactions/${encodeURIComponent(userId)}/`)
        : Promise.resolve(null),
    ])

    if (!itemResponse.ok) {
      throw new Error('아이템 정보를 새로고침하지 못했습니다.')
    }

    const itemData = await itemResponse.json()
    let recommended = false

    if (reactionResponse) {
      if (reactionResponse.ok) {
        const reactionData = await reactionResponse.json()
        recommended = Boolean(reactionData.is_recommended)
      } else if (reactionResponse.status !== 404) {
        throw new Error('내 아이템 반응 상태를 새로고침하지 못했습니다.')
      }
    }

    setItem(itemData)
    setIsItemRecommended(recommended)
  }

  async function handleItemReaction() {
    const userId = getStoredUserId()

    if (!userId) {
      setNotice('아이템 추천은 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget('item-recommend')
    setNotice('')

    try {
      let response

      if (isItemRecommended) {
        response = await fetch(
          `${API_BASE_URL}/items/${itemId}/reactions/${encodeURIComponent(userId)}/`,
          { method: 'DELETE' },
        )
      } else {
        response = await fetch(`${API_BASE_URL}/items/${itemId}/reactions/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, is_recommended: true }),
        })
      }

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '아이템 반응을 저장하지 못했습니다.'))
      }

      await refreshItemAndReaction()
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '아이템 반응을 저장하지 못했습니다.',
      )
    } finally {
      setPendingTarget('')
    }
  }

  async function handleReviewReaction(reviewId, reaction) {
    const userId = getStoredUserId()

    if (!userId) {
      setNotice('리뷰 좋아요와 싫어요는 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget(`review-${reviewId}-${reaction}`)
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/reaction/`, {
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

  return (
    <main className="page-shell">
      <header className="page-header item-page-header">
        <div>
          <h2>아이템 상세</h2>
        </div>
      </header>

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
                  <button
                    type="button"
                    className={
                      isItemRecommended
                        ? 'item-score-panel is-recommended'
                        : 'item-score-panel'
                    }
                    disabled={pendingTarget === 'item-recommend'}
                    onClick={() => {
                      if (window.confirm('이 아이템을 추천하시겠습니까?')) {
                        handleItemReaction()
                      }
                    }}
                    aria-pressed={isItemRecommended}
                  >
                    <strong>{item.recommend_count}</strong>
                    <span>추천</span>
                  </button>
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
                </dl>

                <div className="item-hero-actions">
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
                <h3>리뷰 목록 ({reviews.length})</h3>
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
                          <div className="review-score">
                            <strong>{getReviewScore(review)}</strong>
                            <span>점수</span>
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
                            className="review-detail-link"
                            to={`/items/${itemId}/reviews/${review.id}`}
                          >
                            댓글 보기
                          </Link>
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
