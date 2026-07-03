import { useEffect, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import '../rank/ranking.css'
import '../itempage/itempage.css'
import './reviewpage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

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

  return window.localStorage.getItem('ggultem-user-id')?.trim() ?? ''
}

function isNumericId(value) {
  return /^\d+$/.test(value)
}

function formatDateTime(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getReviewScore(review) {
  return review.like_count - review.dislike_count
}

function sortComments(comments) {
  return [...comments].sort(
    (left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
  )
}

const initialCommentForm = {
  content: '',
}

function ReviewPageContent() {
  const { itemId, reviewId } = useParams()
  const currentUserId = getStoredUserId()
  const [item, setItem] = useState(null)
  const [review, setReview] = useState(null)
  const [comments, setComments] = useState([])
  const [commentForm, setCommentForm] = useState(initialCommentForm)
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingContent, setEditingContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [pendingTarget, setPendingTarget] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadPage() {
      setIsLoading(true)
      setErrorMessage('')
      setNotice('')

      const userId = getStoredUserId()
      const userQuery = userId && isNumericId(userId) ? `?user_id=${encodeURIComponent(userId)}` : ''
      const initialNotice =
        userId && !isNumericId(userId)
          ? '로그인 사용자 반응 정보는 제외하고 리뷰와 댓글을 먼저 표시합니다.'
          : ''

      try {
        const itemResponse = await fetch(`${API_BASE_URL}/items/${itemId}/`)

        if (!itemResponse.ok) {
          const errorData = await readJson(itemResponse)
          throw new Error(normalizeError(errorData, '아이템 정보를 불러오지 못했습니다.'))
        }

        let reviewResponse = await fetch(`${API_BASE_URL}/reviews/${reviewId}/${userQuery}`)
        let commentsResponse = await fetch(`${API_BASE_URL}/reviews/${reviewId}/comments/${userQuery}`)
        let fallbackUsed = Boolean(initialNotice)

        if ((!reviewResponse.ok || !commentsResponse.ok) && userQuery) {
          const [fallbackReviewResponse, fallbackCommentsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/reviews/${reviewId}/`),
            fetch(`${API_BASE_URL}/reviews/${reviewId}/comments/`),
          ])

          if (fallbackReviewResponse.ok && fallbackCommentsResponse.ok) {
            reviewResponse = fallbackReviewResponse
            commentsResponse = fallbackCommentsResponse
            fallbackUsed = true
          }
        }

        if (!reviewResponse.ok) {
          const errorData = await readJson(reviewResponse)
          throw new Error(normalizeError(errorData, '리뷰 정보를 불러오지 못했습니다.'))
        }

        if (!commentsResponse.ok) {
          const errorData = await readJson(commentsResponse)
          throw new Error(normalizeError(errorData, '댓글 목록을 불러오지 못했습니다.'))
        }

        const [itemData, reviewData, commentsData] = await Promise.all([
          itemResponse.json(),
          reviewResponse.json(),
          commentsResponse.json(),
        ])

        if (!isMounted) {
          return
        }

        setItem(itemData)
        setReview(reviewData)
        setComments(sortComments(Array.isArray(commentsData) ? commentsData : []))
        if (String(reviewData.item) !== String(itemId)) {
          setNotice('선택한 아이템에 속하지 않는 리뷰입니다.')
          return
        }

        if (fallbackUsed) {
          setNotice(
            initialNotice || '내 반응 상태를 제외한 리뷰와 댓글만 먼저 표시합니다.',
          )
          return
        }

        setNotice('')
      } catch (error) {
        if (!isMounted) {
          return
        }

        setErrorMessage(
          error instanceof Error ? error.message : '리뷰 페이지를 불러오지 못했습니다.',
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
  }, [itemId, reviewId])

  function handleCommentFormChange(event) {
    const { value } = event.target
    setCommentForm({ content: value })
  }

  function beginEditing(comment) {
    setEditingCommentId(comment.id)
    setEditingContent(comment.content)
    setNotice('')
  }

  function cancelEditing() {
    setEditingCommentId(null)
    setEditingContent('')
  }

  async function handleReviewReaction(reaction) {
    const userId = getStoredUserId()

    if (!userId) {
      setNotice('리뷰 좋아요와 싫어요는 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget(`review-${reaction}`)
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/reaction/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, reaction }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '리뷰 반응을 저장하지 못했습니다.'))
      }

      const updatedReview = await response.json()
      setReview(updatedReview)
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '리뷰 반응을 저장하지 못했습니다.',
      )
    } finally {
      setPendingTarget('')
    }
  }

  async function handleCreateComment(event) {
    event.preventDefault()

    const userId = getStoredUserId()
    if (!userId) {
      setNotice('댓글 작성은 로그인 후 사용할 수 있습니다.')
      return
    }

    const content = commentForm.content.trim()
    if (!content) {
      setNotice('댓글 내용을 입력해 주세요.')
      return
    }

    setPendingTarget('comment-create')
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/comments/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, content }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '댓글을 저장하지 못했습니다.'))
      }

      const createdComment = await response.json()
      setComments((currentComments) => sortComments([...currentComments, createdComment]))
      setReview((currentReview) =>
        currentReview
          ? {
              ...currentReview,
              comments_count: (currentReview.comments_count ?? 0) + 1,
            }
          : currentReview,
      )
      setCommentForm(initialCommentForm)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '댓글을 저장하지 못했습니다.')
    } finally {
      setPendingTarget('')
    }
  }

  async function handleUpdateComment(commentId) {
    const userId = getStoredUserId()
    const content = editingContent.trim()

    if (!userId) {
      setNotice('댓글 수정은 로그인 후 사용할 수 있습니다.')
      return
    }

    if (!content) {
      setNotice('댓글 내용을 입력해 주세요.')
      return
    }

    setPendingTarget(`comment-edit-${commentId}`)
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/comments/${commentId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, content }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '댓글을 수정하지 못했습니다.'))
      }

      const updatedComment = await response.json()
      setComments((currentComments) =>
        sortComments(
          currentComments.map((comment) =>
            comment.id === updatedComment.id ? updatedComment : comment,
          ),
        ),
      )
      cancelEditing()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '댓글을 수정하지 못했습니다.')
    } finally {
      setPendingTarget('')
    }
  }

  async function handleDeleteComment(commentId) {
    const userId = getStoredUserId()

    if (!userId) {
      setNotice('댓글 삭제는 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget(`comment-delete-${commentId}`)
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/comments/${commentId}/`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '댓글을 삭제하지 못했습니다.'))
      }

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId),
      )
      setReview((currentReview) =>
        currentReview
          ? {
              ...currentReview,
              comments_count: Math.max((currentReview.comments_count ?? 1) - 1, 0),
            }
          : currentReview,
      )

      if (editingCommentId === commentId) {
        cancelEditing()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '댓글을 삭제하지 못했습니다.')
    } finally {
      setPendingTarget('')
    }
  }

  async function handleCommentReaction(commentId, reaction) {
    const userId = getStoredUserId()

    if (!userId) {
      setNotice('댓글 좋아요와 싫어요는 로그인 후 사용할 수 있습니다.')
      return
    }

    setPendingTarget(`comment-reaction-${commentId}-${reaction}`)
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/reviews/comments/${commentId}/reaction/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, reaction }),
      })

      if (!response.ok) {
        const errorData = await readJson(response)
        throw new Error(normalizeError(errorData, '댓글 반응을 저장하지 못했습니다.'))
      }

      const updatedComment = await response.json()
      setComments((currentComments) =>
        sortComments(
          currentComments.map((comment) =>
            comment.id === updatedComment.id ? updatedComment : comment,
          ),
        ),
      )
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '댓글 반응을 저장하지 못했습니다.',
      )
    } finally {
      setPendingTarget('')
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header review-page-header">
        <div>
          <p className="eyebrow">리뷰 댓글</p>
          <h1>리뷰 상세 및 댓글</h1>
        </div>
        <Link className="review-back-link" to={`/items/${itemId}`}>
          아이템으로 돌아가기
        </Link>
      </header>

      {notice && <p className="notice">{notice}</p>}

      <section className="item-page-section">
        {isLoading && <p className="state-text">리뷰와 댓글을 불러오는 중입니다.</p>}

        {!isLoading && errorMessage && (
          <div className="empty-state">
            <strong>연결 실패</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && review && (
          <>
            <section className="review-context-bar">
              <div>
                <p className="review-context-label">대상 아이템</p>
                <strong>{item?.name ?? `아이템 #${itemId}`}</strong>
              </div>
              <div className="review-context-meta">
                <span>리뷰 #{review.id}</span>
                <span>댓글 {review.comments_count}</span>
              </div>
            </section>

            <article className="review-card review-detail-card">
              <div className="review-card-header">
                <div>
                  <p className="review-meta">
                    작성자 #{review.author} · {formatDateTime(review.created_at)}
                  </p>
                  <h4>{review.title}</h4>
                </div>
                <div className="review-score">
                  <strong>{getReviewScore(review)}</strong>
                  <span>점수</span>
                </div>
              </div>

              <p className="review-content">{review.content}</p>

              <div className="review-footer">
                <div className="review-stats">
                  <span>좋아요 {review.like_count}</span>
                  <span>싫어요 {review.dislike_count}</span>
                  <span>댓글 {review.comments_count}</span>
                </div>

                <div className="review-actions">
                  <button
                    className={
                      review.user_reaction === 'like'
                        ? 'reaction-button active-positive'
                        : 'reaction-button'
                    }
                    type="button"
                    disabled={pendingTarget === 'review-like'}
                    onClick={() => handleReviewReaction('like')}
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
                    disabled={pendingTarget === 'review-dislike'}
                    onClick={() => handleReviewReaction('dislike')}
                  >
                    싫어요
                  </button>
                </div>
              </div>
            </article>

            <section className="comment-section">
              <div className="review-section-header">
                <div>
                  <h3>댓글</h3>
                  <p>리뷰에 대한 의견, 추가 경험, 반박을 남길 수 있습니다.</p>
                </div>
                <span className="review-count-chip">{comments.length}개 댓글</span>
              </div>

              <form className="comment-composer" onSubmit={handleCreateComment}>
                <label className="comment-composer-field">
                  <span>댓글 작성</span>
                  <textarea
                    value={commentForm.content}
                    onChange={handleCommentFormChange}
                    placeholder="이 리뷰에 대한 의견을 남겨보세요."
                    rows={4}
                  />
                </label>
                <div className="comment-composer-actions">
                  <button
                    className="reaction-button comment-submit-button"
                    type="submit"
                    disabled={pendingTarget === 'comment-create'}
                  >
                    {pendingTarget === 'comment-create' ? '등록 중...' : '댓글 등록'}
                  </button>
                </div>
              </form>

              {comments.length === 0 ? (
                <div className="empty-state">
                  <strong>아직 댓글이 없습니다.</strong>
                  <p>첫 댓글이 등록되면 이곳에 표시됩니다.</p>
                </div>
              ) : (
                <ol className="comment-list">
                  {comments.map((comment) => {
                    const isAuthor = String(comment.author) === currentUserId
                    const isEditing = editingCommentId === comment.id

                    return (
                      <li className="comment-card" key={comment.id}>
                        <div className="comment-card-top">
                          <div>
                            <p className="review-meta">
                              작성자 #{comment.author} · {formatDateTime(comment.created_at)}
                            </p>
                            {comment.updated_at !== comment.created_at && (
                              <p className="comment-edited-label">수정됨</p>
                            )}
                          </div>
                          {isAuthor && (
                            <div className="comment-owner-actions">
                              <button
                                className="comment-text-button"
                                type="button"
                                onClick={() =>
                                  isEditing ? cancelEditing() : beginEditing(comment)
                                }
                              >
                                {isEditing ? '취소' : '수정'}
                              </button>
                              <button
                                className="comment-text-button danger"
                                type="button"
                                disabled={pendingTarget === `comment-delete-${comment.id}`}
                                onClick={() => handleDeleteComment(comment.id)}
                              >
                                삭제
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="comment-edit-panel">
                            <textarea
                              value={editingContent}
                              onChange={(event) => setEditingContent(event.target.value)}
                              rows={4}
                            />
                            <div className="comment-edit-actions">
                              <button
                                className="reaction-button"
                                type="button"
                                disabled={pendingTarget === `comment-edit-${comment.id}`}
                                onClick={() => handleUpdateComment(comment.id)}
                              >
                                {pendingTarget === `comment-edit-${comment.id}`
                                  ? '저장 중...'
                                  : '수정 저장'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="comment-content">{comment.content}</p>
                        )}

                        <div className="review-footer comment-footer">
                          <div className="review-stats">
                            <span>좋아요 {comment.like_count}</span>
                            <span>싫어요 {comment.dislike_count}</span>
                          </div>

                          <div className="review-actions">
                            <button
                              className={
                                comment.user_reaction === 'like'
                                  ? 'reaction-button active-positive'
                                  : 'reaction-button'
                              }
                              type="button"
                              disabled={
                                pendingTarget === `comment-reaction-${comment.id}-like`
                              }
                              onClick={() => handleCommentReaction(comment.id, 'like')}
                            >
                              좋아요
                            </button>
                            <button
                              className={
                                comment.user_reaction === 'dislike'
                                  ? 'reaction-button active-negative'
                                  : 'reaction-button'
                              }
                              type="button"
                              disabled={
                                pendingTarget === `comment-reaction-${comment.id}-dislike`
                              }
                              onClick={() => handleCommentReaction(comment.id, 'dislike')}
                            >
                              싫어요
                            </button>
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

function ReviewPage() {
  return (
    <>
      <nav className="top-nav">
        <Link className="brand-link" to="/">
          꿀템
        </Link>
        <div className="nav-links">
          <NavLink to="/">홈</NavLink>
          <NavLink to="/ranking">랭킹</NavLink>
          <NavLink to="/itemreg">등록</NavLink>
        </div>
      </nav>
      <ReviewPageContent />
    </>
  )
}

export default ReviewPage
