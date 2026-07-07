import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'
import { buildApiUrl } from '../lib/api'

const AuthContext = createContext(null)

function readStorage(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

function removeStorage(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {}
}

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
  const rawAccessToken = readStorage('access_token')
  const tokenPayload = decodeTokenPayload(rawAccessToken)
  const isTokenExpired =
    typeof tokenPayload?.exp === 'number' && tokenPayload.exp * 1000 <= Date.now()
  const storedAccessToken = isTokenExpired ? null : rawAccessToken
  const storedRefreshToken = isTokenExpired ? null : readStorage('refresh_token')
  const storedUserId =
    isTokenExpired ? null : readStorage('user_id') ?? (tokenPayload?.user_id ? String(tokenPayload.user_id) : null)

  if (isTokenExpired) {
    removeStorage('access_token')
    removeStorage('refresh_token')
    removeStorage('user_id')
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
      .get(buildApiUrl('/accounts/me/'), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      .then((response) => {
        if (ignore) return
        const id = response.data?.id
        if (id !== undefined && id !== null) {
          writeStorage('user_id', String(id))
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

    writeStorage('access_token', access)
    writeStorage('refresh_token', refresh)
    setAccessToken(access)
    setRefreshToken(refresh)

    if (nextUserId !== null) {
      writeStorage('user_id', nextUserId)
      setUserId(nextUserId)
    } else {
      removeStorage('user_id')
      setUserId(null)
    }
  }

  const logout = () => {
    removeStorage('access_token')
    removeStorage('refresh_token')
    removeStorage('user_id')
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
