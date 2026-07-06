import { Link } from 'react-router-dom'
import './LoginPopup.css'

function LoginPopup({ message, onClose }) {
  if (!message) {
    return null
  }

  return (
    <div className="login-popup-overlay" role="presentation" onClick={onClose}>
      <div
        className="login-popup-card"
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="login-popup-message">{message}</p>
        <div className="login-popup-actions">
          <Link className="primary-button" to="/login" onClick={onClose}>
            로그인하기
          </Link>
          <button type="button" className="secondary-button" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoginPopup
