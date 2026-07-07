import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

function FollowerListPage() {
  const { accessToken } = useAuth()
  const { userId } = useParams()

  const [followers, setFollowers] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let ignore = false

    const fetchFollowers = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/user/${userId}/followers/`),
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {},
          },
        )

        if (!ignore) {
          setFollowers(response.data?.results ?? response.data ?? [])
          setStatus('success')
        }
      } catch (error) {
        if (!ignore) {
          if (error.response?.status === 404) {
            setStatus('not-found')
          } else {
            setStatus('error')
          }
        }
      }
    }

    fetchFollowers()

    return () => {
      ignore = true
    }
  }, [userId, accessToken])

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        <h2>Follower</h2>

        {status === 'loading' && (
          <p className="state-text">불러오는 중...</p>
        )}

        {status === 'not-found' && (
          <div className="empty-state">
            <strong>사용자를 찾을 수 없습니다</strong>
            <p>'{userId}'에 해당하는 유저가 존재하지 않습니다.</p>
          </div>
        )}

        {status === 'error' && (
          <p className="feedback feedback-error">
            팔로워 목록을 불러오는 중 오류가 발생했습니다.
          </p>
        )}

        {status === 'success' && followers.length === 0 && (
          <p className="state-text">아직 팔로워가 없습니다.</p>
        )}

        {status === 'success' && followers.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {followers.map((item) => (
              <li
                key={item.user.id}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <Link
                  to={`/user/${item.user.id}`}
                  className="text-link"
                >
                  {item.user.username}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default FollowerListPage