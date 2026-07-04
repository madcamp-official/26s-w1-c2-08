import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

function UserListPage() {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('loading') // loading | success | error

  useEffect(() => {
    let ignore = false

    const fetchUsers = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(`${API_BASE_URL}/api/user/`)

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
  }, [])

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