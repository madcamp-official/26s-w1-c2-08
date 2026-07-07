import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

const initialForm = {
  username: '',
  password: '',
  passwordConfirm: '',
}

function SignupPage() {
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('idle')

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

  if (form.password !== form.passwordConfirm) {
    setStatus('error')
    setMessage('비밀번호가 일치하지 않습니다.')
    return
  }

  try {
    const response = await axios.post(
      buildApiUrl('/accounts/signup/'),
      {
        username: form.username,
        password: form.password,
      },
    )

    setStatus('success')
    const signedUpUsername = response.data?.user?.username ?? form.username
    setMessage(response.data?.message ?? 'signup success')
    setForm(initialForm)

    navigate('/login', {
      replace: true,
      state: {
        signedUpUsername,
      },
    })
  } catch (error) {
    setStatus('error')

    if (error.response?.data?.username) {
      setMessage(error.response.data.username[0])
    } else {
      setMessage(
        error.response?.data?.detail ??
          '회원가입에 실패했습니다. backend 서버가 실행 중인지 확인해 주세요.',
      )
    }
  }
}

  return (
    <main className="page-shell page-shell-narrow auth-page">
      <header className="page-header">
        <div>
          <h1>계정 만들기</h1>
        </div>
      </header>

      <section className="page-content">
        <form className="auth-card panel" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>ID</span>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="example01"
              autoComplete="username"
              required
            />
          </label>

          <label className="form-field">
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

          <label className="form-field">
            <span>Password 확인</span>
            <input
              name="passwordConfirm"
              type="password"
              value={form.passwordConfirm}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력하세요"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          {message ? (
            <p className={`feedback ${status === 'error' ? 'feedback-error' : 'feedback-success'}`}>
              {message}
            </p>
          ) : null}

          <button className="primary-button" type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'Signing up...' : 'Sign up'}
          </button>
          <p className="auth-link">
            이미 계정이 있나요? <Link className="text-link" to="/login">로그인</Link>
          </p>
        </form>
      </section>
    </main>
  )
}

export default SignupPage
