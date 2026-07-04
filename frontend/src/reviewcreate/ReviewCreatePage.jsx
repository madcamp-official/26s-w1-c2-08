import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import '../rank/ranking.css'
import '../itempage/itempage.css'
import '../reviewpage/reviewpage.css'
import './reviewcreate.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

const initialReviewForm = {
  title: '',
  content: '',
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

function getStoredUserId() {
  if (typeof window === 'undefined') {
    return ''
  }

  // 추후 localStorage에 숫자형 user id가 저장되면 아래 구현으로 되돌립니다.
  // return window.localStorage.getItem('ggultem-user-id')?.trim() ?? ''
  return 1
}

function ReviewCreatePage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [reviewForm, setReviewForm] = useState(initialReviewForm)
  const [notice, setNotice] = useState('')
  const [pendingTarget, setPendingTarget] = useState('')

  function handleReviewFormChange(field, value) {
    setReviewForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleCreateReview(event) {
    event.preventDefault()

    const userId = getStoredUserId()
    if (!userId) {
      setNotice('리뷰 작성은 로그인 후 사용할 수 있습니다.')
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
      const response = await fetch(`${API_BASE_URL}/reviews/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item: Number(itemId),
          user_id: userId,
          title,
          content,
        }),
      })

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
      <header className="app-header review-page-header">
        <div>
          <p className="eyebrow">리뷰 작성</p>
          <h1>아이템 리뷰 등록</h1>
        </div>
        <Link className="review-back-link" to={`/items/${itemId}`}>
          아이템으로 돌아가기
        </Link>
      </header>

      {notice && <p className="notice">{notice}</p>}

      <section className="item-page-section">
        <article className="review-create-card">
          <div className="review-create-header">
            <div>
              <p className="review-context-label">대상 아이템</p>
              <strong>아이템 #{itemId}</strong>
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
      </section>
    </main>
  )
}

export default ReviewCreatePage
