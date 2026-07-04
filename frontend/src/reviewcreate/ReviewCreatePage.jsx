import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LoginPopup from '../components/LoginPopup'
import '../rank/ranking.css'
import '../itempage/itempage.css'
import '../reviewpage/reviewpage.css'
import './reviewcreate.css'
import { apiFetch, buildApiUrl } from '../lib/api'

const initialReviewForm = {
  title: '',
  content: '',
}

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

function readJson(response) {
  return response.json().catch(() => null)
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

function formatPrice(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '가격 정보 없음'
  }

  return `${numeric.toLocaleString('ko-KR')}원`
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category ?? '기타'
}

function ReviewCreatePage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const { accessToken, userId, logout } = useAuth()
  const [item, setItem] = useState(null)
  const [reviewForm, setReviewForm] = useState(initialReviewForm)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [loginPopupMessage, setLoginPopupMessage] = useState('')
  const [pendingTarget, setPendingTarget] = useState('')
  const [brokenImage, setBrokenImage] = useState(false)

  useEffect(() => {
    if (!accessToken || !userId) {
      navigate('/login', { replace: true })
      return
    }

    let isMounted = true

    async function loadItem() {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const response = await apiFetch(`/items/${itemId}/`)

        if (!response.ok) {
          const errorData = await readJson(response)
          throw new Error(normalizeError(errorData, '아이템 정보를 불러오지 못했습니다.'))
        }

        const itemData = await response.json()

        if (!isMounted) {
          return
        }

        setItem(itemData)
        setBrokenImage(false)
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(
          error instanceof Error ? error.message : '아이템 정보를 불러오지 못했습니다.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadItem()

    return () => {
      isMounted = false
    }
  }, [accessToken, itemId, navigate, userId])

  function handleReviewFormChange(field, value) {
    setReviewForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateReview(event) {
    event.preventDefault()

    if (!accessToken || !userId) {
      setLoginPopupMessage('리뷰 작성은 로그인 후 사용할 수 있습니다.')
      return
    }

    const title = reviewForm.title.trim()
    const content = reviewForm.content.trim()

    if (!title) {
      setNotice('리뷰 제목을 입력해 주세요.')
      return
    }

    if (!content) {
      setNotice('리뷰 내용을 입력해 주세요.')
      return
    }

    setPendingTarget('review-create')
    setNotice('')

    try {
      const response = await apiFetch('/reviews/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          item: Number(itemId),
          user_id: userId,
          title,
          content,
        }),
      })

      if (response.status === 401 || response.status === 403) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '리뷰를 저장하지 못했습니다.'))
      }

      const createdReview = await response.json()
      navigate(`/items/${itemId}/reviews/${createdReview.id}`, { replace: true })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '리뷰를 저장하지 못했습니다.')
    } finally {
      setPendingTarget('')
    }
  }

  return (
    <main className="app-shell">
      <div className="review-page-topbar">
        <Link className="review-back-link" to={`/items/${itemId}`}>
          아이템으로 돌아가기
        </Link>
      </div>

      {notice && <p className="notice">{notice}</p>}
      <LoginPopup message={loginPopupMessage} onClose={() => setLoginPopupMessage('')} />

      <section className="item-page-section">
        {isLoading && <p className="state-text">아이템 정보를 불러오는 중입니다.</p>}

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
                    <dt>추천</dt>
                    <dd>{item.starCount ?? 0}</dd>
                  </div>
                  <div>
                    <dt>아이템 ID</dt>
                    <dd>#{item.id}</dd>
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

            <article className="review-create-card">
              <div className="review-create-header">
                <div>
                  <p className="review-context-label">대상 아이템</p>
                  <strong>{item.name}</strong>
                </div>
                <p className="review-create-copy">
                  구매 이유, 사용 경험, 장단점을 정리해서 별도 리뷰로 등록합니다.
                </p>
              </div>

              <form className="review-create-form" onSubmit={handleCreateReview}>
                <label className="review-create-field">
                  <span>리뷰 제목</span>
                  <input
                    type="text"
                    value={reviewForm.title}
                    onChange={(event) => handleReviewFormChange('title', event.target.value)}
                    placeholder="한 줄로 핵심 경험을 적어보세요."
                    maxLength={255}
                  />
                </label>

                <label className="review-create-field">
                  <span>리뷰 내용</span>
                  <textarea
                    value={reviewForm.content}
                    onChange={(event) => handleReviewFormChange('content', event.target.value)}
                    placeholder="구매 이유, 사용 경험, 장단점을 구체적으로 남겨보세요."
                    rows={8}
                  />
                </label>

                <div className="review-create-actions">
                  <Link className="secondary-button" to={`/items/${itemId}`}>
                    취소
                  </Link>
                  <button
                    className="primary-button review-create-submit"
                    type="submit"
                    disabled={pendingTarget === 'review-create'}
                  >
                    {pendingTarget === 'review-create' ? '등록 중...' : '리뷰 등록'}
                  </button>
                </div>
              </form>
            </article>
          </>
        )}
      </section>
    </main>
  )
}

export default ReviewCreatePage
