import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

function IdChangePage() {
  const { accessToken, userId } = useAuth()
  const navigate = useNavigate()

  const [currentUsername, setCurrentUsername] = useState('')
  const [status, setStatus] = useState('loading')

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
        const response = await axios.get(
          buildApiUrl('/accounts/me/'),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        )

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

      setCurrentUsername(response.data.username)
      setNewUsername(response.data.username)
      setSuccessMessage('username이 변경되었습니다.')

      setTimeout(() => {
        navigate('/me', { replace: true })
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

  if (status === 'error') {
    return <Navigate to="/login" replace />
  }

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        <h2>ID 변경</h2>

        <form
          onSubmit={handleSubmit}
          className="panel"
          style={{ padding: '16px' }}
        >
          <label
            htmlFor="username-input"
            style={{ display: 'block', marginBottom: '8px' }}
          >
            새 ID
          </label>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              id="username-input"
              type="text"
              value={newUsername}
              onChange={(event) => setNewUsername(event.target.value)}
              disabled={isSubmitting}
              style={{ flex: 1, padding: '8px 12px' }}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="primary-button"
            >
              {isSubmitting ? '변경 중...' : '변경하기'}
            </button>
          </div>

          {errorMessage && (
            <p className="feedback feedback-error">
              {errorMessage}
            </p>
          )}

          {successMessage && (
            <p className="feedback feedback-success">
              {successMessage}
            </p>
          )}
        </form>
      </section>
    </main>
  )
}

export default IdChangePage