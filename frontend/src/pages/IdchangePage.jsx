import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

function IdChangePage() {
  const { accessToken, userId } = useAuth()
  const { username: targetUsername } = useParams()
  const navigate = useNavigate()

  const [currentUsername, setCurrentUsername] = useState(null)
  const [status, setStatus] = useState('loading') // loading | success | error

  const [newUsername, setNewUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    let ignore = false

    const fetchMe = async () => {
      if (!accessToken) {
        setStatus('error')
        return
      }

      try {
        const response = await axios.get(buildApiUrl('/accounts/me/'), {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!ignore) {
          setCurrentUsername(response.data.username)
          setNewUsername(response.data.username)
          setStatus('success')
        }
      } catch {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

    fetchMe()

    return () => {
      ignore = true
    }
  }, [accessToken])

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!userId) {
      setErrorMessage('로그인이 필요합니다.')
      return
    }

    const trimmed = newUsername.trim()

    if (!trimmed) {
      setErrorMessage('username을 입력해주세요.')
      return
    }

    if (trimmed === currentUsername) {
      setErrorMessage('현재 username과 동일합니다.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await axios.patch(
        buildApiUrl(`/user/${userId}/transname/`),
        { username: trimmed },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      )

      setSuccessMessage('username이 변경되었습니다.')
      setCurrentUsername(response.data.username)

      setTimeout(() => {
        navigate(`/user/${response.data.username}`, { replace: true })
      }, 1000)
    } catch (error) {
      const status = error.response?.status
      const data = error.response?.data

      if (status === 403) {
        setErrorMessage('본인의 username만 변경할 수 있습니다.')
      } else if (status === 400 && data?.username) {
        setErrorMessage(data.username[0])
      } else if (status === 401) {
        setErrorMessage('로그인이 필요합니다.')
      } else {
        setErrorMessage('요청 중 오류가 발생했습니다.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // 로그인이 안 되어 있으면 로그인 페이지로
  if (!accessToken || !userId) {
    return <Navigate to="/login" replace />
  }

  if (status === 'loading') {
    return (
      <main className="page-shell page-shell-narrow">
        <section className="page-content">
          <p className="state-text">확인 중...</p>
        </section>
      </main>
    )
  }

  // 본인 정보 조회 실패 시
  if (status === 'error') {
    return <Navigate to="/login" replace />
  }

  // 로그인한 유저의 username과 URL의 username이 다르면 접근 차단
  if (currentUsername !== targetUsername) {
    return <Navigate to="/me" replace />
  }

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        <h2>username 변경</h2>

        <form onSubmit={handleSubmit} className="panel" style={{ padding: '16px' }}>
          <label htmlFor="username-input" style={{ display: 'block', marginBottom: '8px' }}>
            새 username
          </label>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="username-input"
              type="text"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              placeholder="새 username"
              disabled={isSubmitting}
              style={{ flex: 1, padding: '8px 12px' }}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? '변경 중...' : '변경하기'}
            </button>
          </div>

          {errorMessage && (
            <p className="feedback feedback-error" style={{ marginTop: '8px' }}>
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="state-text" style={{ marginTop: '8px', color: '#16a34a' }}>
              {successMessage}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}

export default IdChangePage