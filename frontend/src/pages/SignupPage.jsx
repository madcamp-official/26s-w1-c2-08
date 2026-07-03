import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import '../App.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const initialForm = {
  id: '',
  password: '',
}

function SignupPage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle')
  const [userId, setUserId] = useState('')

  // 이미 로그인되어 있으면 signup 페이지 접근 막기
  useEffect(() => {
    if (accessToken) {
      navigate('/', { replace: true })
    }
  }, [accessToken, navigate])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('loading')
    setMessage('')

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/accounts/signup/`,
        form,
      )

      setStatus('success')
      const signedUpId = response.data?.user?.id ?? form.id
      setUserId(signedUpId)
      setMessage(response.data?.message ?? 'signup success')
      setForm(initialForm)
      navigate('/login', {
        replace: true,
        state: {
          signedUpId,
        },
      })
    } catch (error) {
      setStatus('error')
      setMessage(
        error.response?.data?.detail ??
          '회원가입에 실패했습니다. backend 서버가 실행 중인지 확인해 주세요.',
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <form className="signup-card" onSubmit={handleSubmit}>
          <p className="page-link">
            이미 계정이 있나요? <Link to="/login">로그인</Link>
          </p>

          <label>
            <span>ID</span>
            <input
              name="id"
              value={form.id}
              onChange={handleChange}
              placeholder="example01"
              autoComplete="username"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="8자 이상"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Signing up...' : 'Sign up'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default SignupPage