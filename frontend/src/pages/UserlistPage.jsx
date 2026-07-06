import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

function UserListPage() {
  const { accessToken } = useAuth()

  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false

    const fetchUsers = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(buildApiUrl('/user/'), {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
        })

        if (!ignore) {
          setUsers(response.data?.users ?? [])
          setStatus('success')
        }
      } catch (error) {
        if (!ignore) {
          setStatus('error')
        }
      }
    }

    fetchUsers()

    return () => {
      ignore = true
    }
  }, [accessToken])

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        <h2>유저 목록</h2>

        {status === 'loading' && (
          <p className="state-text">불러오는 중...</p>
        )}

        {status === 'error' && (
          <p className="feedback feedback-error">
            유저 목록을 불러오는 중 오류가 발생했습니다.
          </p>
        )}

        {status === 'success' && users.length === 0 && (
          <p className="state-text">표시할 유저가 없습니다.</p>
        )}

        {status === 'success' && users.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {users.map((user) => (
              <li
                key={user.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Link to={`/user/${user.username}`} className="text-link">
                  {user.username}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default UserListPage
