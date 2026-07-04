import './LoginPopup.css'

function ConfirmPopup({
  message,
  onConfirm,
  onCancel,
  confirmLabel = '확인',
  cancelLabel = '취소',
}) {
  if (!message) {
    return null
  }

  return (
    <div className="login-popup-overlay" role="presentation" onClick={onCancel ?? onConfirm}>
      <div
        className="login-popup-card"
        role="alertdialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="login-popup-message">{message}</p>
        <div className="login-popup-actions">
          {onCancel && (
            <button type="button" className="secondary-button" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button type="button" className="primary-button" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmPopup
