import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function decodeTokenPayload(token) {
  if (!token) {
    return null
  }

  const [, payload] = token.split('.')
  if (!payload) {
    return null
  }

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = atob(normalizedPayload)
    return JSON.parse(decodedPayload)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const rawAccessToken = localStorage.getItem('access_token')
  const tokenPayload = decodeTokenPayload(rawAccessToken)
  const isTokenExpired =
    typeof tokenPayload?.exp === 'number' && tokenPayload.exp * 1000 <= Date.now()
  const storedAccessToken = isTokenExpired ? null : rawAccessToken
  const storedRefreshToken = isTokenExpired ? null : localStorage.getItem('refresh_token')
  const storedUserId =
    isTokenExpired ? null : localStorage.getItem('user_id') ?? (tokenPayload?.user_id ? String(tokenPayload.user_id) : null)

  if (isTokenExpired) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_id')
  }

  const [accessToken, setAccessToken] = useState(
    storedAccessToken,
  )
  const [refreshToken, setRefreshToken] = useState(
    storedRefreshToken,
  )
  const [userId, setUserId] = useState(storedUserId)

  // 코드 업데이트 이전에 로그인한 세션은 user_id가 저장되어 있지 않으므로 보충 조회한다.
  useEffect(() => {
    if (!accessToken || userId) return

    let ignore = false

    axios
      .get(`${API_BASE_URL}/api/accounts/me/`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((response) => {
        if (ignore) return
        const id = response.data?.id
        if (id !== undefined && id !== null) {
          localStorage.setItem('user_id', id)
          setUserId(id)
        }
      })
      .catch(() => {})

    return () => {
      ignore = true
    }
  }, [accessToken, userId])

  const login = (access, refresh, id) => {
    const nextUserId =
      id !== undefined && id !== null
        ? String(id)
        : decodeTokenPayload(access)?.user_id
          ? String(decodeTokenPayload(access).user_id)
          : null

    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    setAccessToken(access)
    setRefreshToken(refresh)

    if (nextUserId !== null) {
      localStorage.setItem('user_id', nextUserId)
      setUserId(nextUserId)
    } else {
      localStorage.removeItem('user_id')
      setUserId(null)
    }
  }

  const logout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user_id')
    setAccessToken(null)
    setRefreshToken(null)
    setUserId(null)
  }

  return (
    <AuthContext.Provider
      value={{ accessToken, refreshToken, userId, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
