import { useParams } from 'react-router-dom'

function UserPage() {
  const { userId } = useParams()

  return (
    <main className="page-shell page-shell-narrow">
      <header className="page-header">
        <div>
          <h1>환영합니다</h1>
        </div>
      </header>

      <section className="page-content">
        <div className="panel user-card">
          <p className="user-id-label">user id</p>
          <p className="user-id-value">{userId}</p>
        </div>
      </section>
    </main>
  )
}

export default UserPage
