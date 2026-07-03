import { useState } from 'react'
import axios from 'axios'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../App.css'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

const initialForm = {
  id: '',
  password: '',
}

function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle')
  const signedUpId = location.state?.signedUpId

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
      const response = await axios.post(`${API_BASE_URL}/api/accounts/login/`, form)
      const userId = response.data?.user?.id ?? form.id

      window.localStorage.setItem('ggultem-user-id', userId)
      setStatus('success')
      navigate(`/${encodeURIComponent(userId)}`)
    } catch (error) {
      setStatus('error')
      setMessage(
        error.response?.data?.detail ??
          '로그인에 실패했습니다. id와 password를 다시 확인해 주세요.',
      )
    }
  }

  return (
    <main className="app-shell">
      <section className="login-card">
        <form className="signup-card" onSubmit={handleSubmit}>
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
              autoComplete="current-password"
              required
            />
          </label>

          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Logging in...' : 'Log in'}
          </button>
          {signedUpId ? (
            <p className="page-link">회원가입이 완료됐어요. 이제 로그인해 주세요.</p>
          ) : null}
          <p className="page-link">
            아직 계정이 없나요? <Link to="/signup">회원가입</Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
