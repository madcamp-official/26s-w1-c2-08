import { Link, useParams } from 'react-router-dom'
import '../App.css'

function UserPage() {
  const { userId } = useParams()

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="signup-card user-card">
          <p className="user-id-label">user id</p>
          <p className="user-id-value">{userId}</p>
        </div>
      </section>
    </main>
  )
}

export default UserPage
