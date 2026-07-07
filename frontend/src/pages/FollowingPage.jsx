import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../context/AuthContext'
import { buildApiUrl } from '../lib/api'

function FollowingListPage() {
  const { accessToken } = useAuth()
  const { userId } = useParams()

  const [following, setFollowing] = useState([])
  const [status, setStatus] = useState('loading') // loading | success | not-found | error

  useEffect(() => {
    let ignore = false

    const fetchFollowing = async () => {
      setStatus('loading')

      try {
        const response = await axios.get(
          buildApiUrl(`/user/${userId}/following/`),
          {
            headers: accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {},
          },
        )

        if (!ignore) {
          setFollowing(response.data?.results ?? response.data ?? [])
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

    fetchFollowing()

    return () => {
      ignore = true
    }
  }, [userId, accessToken])

  return (
    <main className="page-shell page-shell-narrow">
      <section className="page-content">
        <h2>Following</h2>

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
            팔로잉 목록을 불러오는 중 오류가 발생했습니다.
          </p>
        )}

        {status === 'success' && following.length === 0 && (
          <p className="state-text">아직 팔로잉한 사용자가 없습니다.</p>
        )}

        {status === 'success' && following.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {following.map((item) => (
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

export default FollowingListPage