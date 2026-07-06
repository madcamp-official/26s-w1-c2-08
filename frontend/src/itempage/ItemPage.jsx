import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoginPopup from '../components/LoginPopup'
import ConfirmPopup from '../components/ConfirmPopup'
import '../rank/ranking.css'
import './itempage.css'
import '../reviewpage/reviewpage.css'
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

function getOriginalUrlLabel(url) {
  return url ? '원본 URL로 이동하기' : '링크 없음'
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
  const [loginPopupMessage, setLoginPopupMessage] = useState('')
  const [pendingTarget, setPendingTarget] = useState('')
  const [brokenImage, setBrokenImage] = useState(false)
  const [showRecommendConfirm, setShowRecommendConfirm] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editingReviewForm, setEditingReviewForm] = useState({ title: '', content: '' })
  const [reviewDeleteTarget, setReviewDeleteTarget] = useState(null)

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

  function handleRecommendClick() {
    if (!accessToken) {
      setLoginPopupMessage('아이템 추천은 로그인 후 사용할 수 있습니다.')
      return
    }

    setShowRecommendConfirm(true)
  }

  async function handleItemStarToggle() {
    setShowRecommendConfirm(false)
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
      setLoginPopupMessage('리뷰 좋아요와 싫어요는 로그인 후 사용할 수 있습니다.')
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

  function beginEditingReview(review) {
    setEditingReviewId(review.id)
    setEditingReviewForm({ title: review.title, content: review.content })
    setNotice('')
  }

  function cancelEditingReview() {
    setEditingReviewId(null)
    setEditingReviewForm({ title: '', content: '' })
  }

  async function handleUpdateReview(reviewId) {
    const title = editingReviewForm.title.trim()
    const content = editingReviewForm.content.trim()

    if (!accessToken || !userId) {
      setLoginPopupMessage('리뷰 수정은 로그인 후 사용할 수 있습니다.')
      return
    }

    if (!title || !content) {
      setNotice('리뷰 제목과 본문을 입력해 주세요.')
      return
    }

    setPendingTarget(`review-edit-${reviewId}`)
    setNotice('')

    try {
      const response = await apiFetch(`/reviews/${reviewId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title, content }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '리뷰를 수정하지 못했습니다.'))
      }

      const updatedReview = await response.json()
      setReviews((currentReviews) =>
        sortReviews(
          currentReviews.map((review) => (review.id === updatedReview.id ? updatedReview : review)),
        ),
      )
      cancelEditingReview()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '리뷰를 수정하지 못했습니다.')
    } finally {
      setPendingTarget('')
    }
  }

  function handleDeleteReviewClick(reviewId) {
    if (!accessToken || !userId) {
      setLoginPopupMessage('리뷰 삭제는 로그인 후 사용할 수 있습니다.')
      return
    }

    setReviewDeleteTarget(reviewId)
  }

  async function handleDeleteReview() {
    const reviewId = reviewDeleteTarget
    setReviewDeleteTarget(null)

    if (!reviewId) {
      return
    }

    setPendingTarget(`review-delete-${reviewId}`)
    setNotice('')

    try {
      const response = await apiFetch(`/reviews/${reviewId}/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '리뷰를 삭제하지 못했습니다.'))
      }

      setReviews((currentReviews) => currentReviews.filter((review) => review.id !== reviewId))

      if (editingReviewId === reviewId) {
        cancelEditingReview()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '리뷰를 삭제하지 못했습니다.')
    } finally {
      setPendingTarget('')
    }
  }

  const isItemOwner = Boolean(item && userId && String(item.created_by_id) === userId)
  const myReview = reviews.find((review) => String(review.author) === userId)
  const showReviewButton = Boolean(accessToken && userId && !isItemOwner)

  return (
    <main className="page-shell">
      {notice && <p className="notice">{notice}</p>}
      <LoginPopup message={loginPopupMessage} onClose={() => setLoginPopupMessage('')} />
      <ConfirmPopup
        message={
          showRecommendConfirm
            ? item?.isStarred
              ? '추천을 취소하시겠습니까?'
              : '이 아이템을 추천하겠습니까?'
            : ''
        }
        onConfirm={handleItemStarToggle}
        onCancel={() => setShowRecommendConfirm(false)}
      />
      <ConfirmPopup
        message={reviewDeleteTarget ? '리뷰를 삭제하시겠습니까?' : ''}
        onConfirm={handleDeleteReview}
        onCancel={() => setReviewDeleteTarget(null)}
      />

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
                  <div className="item-score-block">
                    <div className="item-score-panel">
                      <span className="star-icon">★</span>
                      <strong>{item.starCount ?? 0}</strong>
                    </div>
                    <button
                      className={
                        item.isStarred
                          ? 'reaction-button active-positive'
                          : 'reaction-button'
                      }
                      type="button"
                      disabled={pendingTarget === 'item-recommend'}
                      onClick={() => handleRecommendClick()}
                    >
                      추천하기
                    </button>
                  </div>
                </div>

                <div className="item-detail-box">
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

                  <div className="item-url-row">
                    {item.original_url ? (
                      <a
                        className="product-link"
                        href={item.original_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {getOriginalUrlLabel(item.original_url)}
                      </a>
                    ) : (
                      <span className="item-url-missing">{getOriginalUrlLabel(item.original_url)}</span>
                    )}
                  </div>
                </div>

                {item.description ? (
                  <div className="item-description-box">
                    <h3>상품 설명</h3>
                    <p className="item-description-text">{item.description}</p>
                  </div>
                ) : null}
              </div>
            </article>

            <section className="review-section">
              <div className="review-section-header">
                <div>
                  <h3>리뷰 목록 ({reviews.length})</h3>
                  <p>좋아요와 싫어요 반응을 기준으로 리뷰가 정렬됩니다.</p>
                </div>
                <div className="review-section-utility">
                  {showReviewButton && (
                    <Link
                      className="primary-button"
                      to={
                        myReview
                          ? `/items/${itemId}/reviews/${myReview.id}`
                          : `/items/${itemId}/reviews/new`
                      }
                    >
                      {myReview ? '리뷰 수정' : '리뷰 작성'}
                    </Link>
                  )}
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
                  {reviews.map((review) => {
                    const isReviewAuthor = String(review.author) === userId
                    const isEditingThis = editingReviewId === review.id

                    return (
                    <li className="review-card" key={review.id}>
                      <div className="review-card-header">
                        <div>
                          <p className="review-meta">
                            작성자 #{review.author} · {formatDate(review.created_at)}
                          </p>
                          {!isEditingThis && <h4>{review.title}</h4>}
                        </div>
                        {isReviewAuthor && (
                          <div className="comment-owner-actions">
                            <button
                              className="comment-text-button"
                              type="button"
                              onClick={() =>
                                isEditingThis ? cancelEditingReview() : beginEditingReview(review)
                              }
                            >
                              {isEditingThis ? '취소' : '수정'}
                            </button>
                            <button
                              className="comment-text-button danger"
                              type="button"
                              disabled={pendingTarget === `review-delete-${review.id}`}
                              onClick={() => handleDeleteReviewClick(review.id)}
                            >
                              삭제
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditingThis ? (
                        <div className="comment-edit-panel">
                          <input
                            type="text"
                            value={editingReviewForm.title}
                            onChange={(event) =>
                              setEditingReviewForm((current) => ({
                                ...current,
                                title: event.target.value,
                              }))
                            }
                          />
                          <textarea
                            value={editingReviewForm.content}
                            onChange={(event) =>
                              setEditingReviewForm((current) => ({
                                ...current,
                                content: event.target.value,
                              }))
                            }
                            rows={4}
                          />
                          <div className="comment-edit-actions">
                            <button
                              className="reaction-button"
                              type="button"
                              disabled={pendingTarget === `review-edit-${review.id}`}
                              onClick={() => handleUpdateReview(review.id)}
                            >
                              {pendingTarget === `review-edit-${review.id}` ? '저장 중...' : '수정 저장'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <Link
                          className="review-card-link"
                          to={`/items/${itemId}/reviews/${review.id}`}
                        >
                          <p className="review-content">{review.content}</p>
                        </Link>
                      )}

                      <div className="review-footer">
                        <div className="review-stats">
                          <button
                            className={
                              review.user_reaction === 'like'
                                ? 'like-button like-button-active'
                                : 'like-button'
                            }
                            type="button"
                            disabled={pendingTarget === `review-${review.id}-like`}
                            onClick={() => handleReviewReaction(review.id, 'like')}
                            aria-pressed={review.user_reaction === 'like'}
                          >
                            <span className="like-icon">♥︎</span>
                            {review.like_count}
                          </button>
                          <button
                            className={
                              review.user_reaction === 'dislike'
                                ? 'dislike-button dislike-button-active'
                                : 'dislike-button'
                            }
                            type="button"
                            disabled={pendingTarget === `review-${review.id}-dislike`}
                            onClick={() => handleReviewReaction(review.id, 'dislike')}
                            aria-pressed={review.user_reaction === 'dislike'}
                          >
                            <span className="dislike-icon">👎</span>
                            {review.dislike_count}
                          </button>
                          <Link
                            className="review-comment-link"
                            to={`/items/${itemId}/reviews/${review.id}`}
                          >
                            댓글 보기 {review.comments_count}
                          </Link>
                        </div>
                      </div>
                    </li>
                    )
                  })}
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
