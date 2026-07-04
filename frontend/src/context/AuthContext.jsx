import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

function decodeTokenPayload(token) {
  if (!token) {
    return null
  }

  try {
    const [, payload] = token.split('.')
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(window.atob(normalized))
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

  const login = (access, refresh, nextUserId) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
    localStorage.setItem('user_id', nextUserId)
    setAccessToken(access)
    setRefreshToken(refresh)
    setUserId(nextUserId)
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
