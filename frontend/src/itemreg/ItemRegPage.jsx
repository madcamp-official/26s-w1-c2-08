import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ConfirmPopup from '../components/ConfirmPopup'
import LoginPopup from '../components/LoginPopup'
import './itemreg.css'
import { apiFetch } from '../lib/api'
import { ITEM_CATEGORIES, CATEGORY_LABELS } from '../constants/categories'

const emptyMessage = {
  type: '',
  text: '',
}

const emptyAiFields = {
  name: '',
  category: 'etc',
  imageUrl: '',
  price: '',
  shopOrBrandName: '',
  originalUrl: '',
  description: '',
}

const fallbackLinkLabel = '연결 링크 없음'

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripLeadingBrandFromProductName(name, brand) {
  const trimmedName = name.trim()
  const trimmedBrand = brand.trim()

  if (!trimmedName || !trimmedBrand) {
    return trimmedName
  }

  const brandPrefixPattern = new RegExp(`^${escapeRegExp(trimmedBrand)}(?:\\s+|\\s*[-_/|]\\s*)?`, 'i')
  const normalizedName = trimmedName.replace(brandPrefixPattern, '').trim()

  return normalizedName || trimmedName
}

function formatPrice(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '가격 미입력'
  }

  return `₩${numeric.toLocaleString('ko-KR')}`
}

function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? '기타'
}

function normalizeError(error) {
  if (typeof error === 'string') {
    return error
  }

  if (Array.isArray(error)) {
    return error.join(' ')
  }

  if (error && typeof error === 'object') {
    return Object.entries(error)
      .map(([key, value]) => `${key}: ${normalizeError(value)}`)
      .join(' / ')
  }

  return '요청 처리 중 오류가 발생했습니다.'
}

function ItemRegPage() {
  const navigate = useNavigate()
  const { accessToken, userId, logout } = useAuth()
  const aiFileInputRef = useRef(null)
  const imageFileInputRef = useRef(null)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')
  const [imageFileName, setImageFileName] = useState('')
  const [hasAiGeneratedImage, setHasAiGeneratedImage] = useState(false)
  const [isRepresentativeImageBroken, setIsRepresentativeImageBroken] = useState(false)
  const [aiFields, setAiFields] = useState(emptyAiFields)
  const [aiPreview, setAiPreview] = useState(null)
  const [duplicateCheckResult, setDuplicateCheckResult] = useState(null)
  const [isAiFilling, setIsAiFilling] = useState(false)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasPassedDuplicateCheck, setHasPassedDuplicateCheck] = useState(false)
  const [message, setMessage] = useState(emptyMessage)
  const [loginPopupMessage, setLoginPopupMessage] = useState('')
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)
  const [showCreatedConfirm, setShowCreatedConfirm] = useState(false)
  const representativeImageSrc = selectedImagePreviewUrl || aiPreview?.imageUrl || ''
  const isAuthenticated = Boolean(accessToken && userId)

  const nextLabel = useMemo(() => {
    if (isCheckingDuplicates) {
      return '유사 아이템 확인 중...'
    }

    return '다음'
  }, [isCheckingDuplicates])

  const submitLabel = useMemo(() => {
    if (isSubmitting) {
      return '아이템 등록 중...'
    }

    return '아이템 등록'
  }, [isSubmitting])

  useEffect(() => {
    if (isAuthenticated) {
      setLoginPopupMessage('')
      return
    }

    setLoginPopupMessage('아이템 등록은 로그인 후 사용할 수 있습니다.')
  }, [isAuthenticated])

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl)
      }
    }
  }, [selectedImagePreviewUrl])

  function resetDuplicateCheckState() {
    setDuplicateCheckResult(null)
    setHasPassedDuplicateCheck(false)
  }

  function applySelectedImageFile(file) {
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl)
    }

    setIsRepresentativeImageBroken(false)

    if (!file) {
      setSelectedImageFile(null)
      setSelectedImagePreviewUrl('')
      setImageFileName('')
      setHasAiGeneratedImage(false)
      resetDuplicateCheckState()
      return
    }

    setSelectedImageFile(file)
    setSelectedImagePreviewUrl(URL.createObjectURL(file))
    setImageFileName(file.name)
    setHasAiGeneratedImage(false)
    resetDuplicateCheckState()
  }

  function handleImageFileChange(event) {
    const file = event.target.files?.[0]
    applySelectedImageFile(file ?? null)
  }

  function handleImageUploadClick() {
    imageFileInputRef.current?.click()
  }

  async function runAiFill(sourceFile) {
    setIsAiFilling(true)
    setMessage(emptyMessage)

    try {
      const formData = new FormData()
      formData.append('screenshot', sourceFile)

      const response = await apiFetch('/items/extract-from-screenshot/', {
        method: 'POST',
        body: formData,
        timeoutMs: 120000,
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(normalizeError(data))
      }

      const extractedBrand = data.shop_or_brand_name?.trim() || aiFields.shopOrBrandName
      const extractedName = stripLeadingBrandFromProductName(data.name?.trim() || '', extractedBrand)
      const extractedPrice =
        typeof data.price === 'number' && Number.isFinite(data.price) && data.price > 0
          ? String(data.price)
          : aiFields.price

      const nextFields = {
        ...aiFields,
        name: extractedName || aiFields.name,
        category:
          ITEM_CATEGORIES.some((category) => category.value === data.category) ? data.category : aiFields.category,
        price: extractedPrice,
        shopOrBrandName: extractedBrand,
      }

      setAiFields(nextFields)
      setAiPreview({
        ...nextFields,
        imageUrl: data.cropped_image_url ?? '',
      })
      setIsRepresentativeImageBroken(false)
      resetDuplicateCheckState()

      if (data.cropped_image_url) {
        try {
          const imageResponse = await fetch(data.cropped_image_url)
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob()
            const isImageBlob =
              imageBlob.size > 0 && (!imageBlob.type || imageBlob.type.startsWith('image/'))

            if (isImageBlob) {
              const extension = imageBlob.type === 'image/jpeg' ? 'jpg' : 'png'
              const croppedImageFile = new File([imageBlob], `ai-cropped-product.${extension}`, {
                type: imageBlob.type || `image/${extension}`,
              })
              applySelectedImageFile(croppedImageFile)
              setImageFileName('AI가 추출한 대표 이미지')
              setHasAiGeneratedImage(true)
            } else {
              setHasAiGeneratedImage(false)
              setImageFileName('')
              setMessage({
                type: 'info',
                text: '상품 정보는 채웠지만 대표 이미지는 자동 첨부하지 않았습니다. 이미지를 확인하거나 직접 첨부해 주세요.',
              })
            }
          } else {
            setHasAiGeneratedImage(false)
            setImageFileName('')
            setMessage({
              type: 'info',
              text: '상품 정보는 채웠지만 대표 이미지는 자동 첨부하지 않았습니다. 이미지를 확인하거나 직접 첨부해 주세요.',
            })
          }
        } catch {
          setHasAiGeneratedImage(false)
          setImageFileName('')
          setMessage({
            type: 'info',
            text: '상품 정보는 채웠지만 대표 이미지는 자동 첨부하지 않았습니다. 이미지를 확인하거나 직접 첨부해 주세요.',
          })
        }
      } else {
        setHasAiGeneratedImage(false)
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : '스크린샷 기반 상품 정보 추출 중 오류가 발생했습니다.',
      })
    } finally {
      setIsAiFilling(false)
    }
  }

  function handleAiFillClick() {
    if (isAiFilling) {
      return
    }

    aiFileInputRef.current?.click()
  }

  function handleAiSourceFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    runAiFill(file)
  }

  function handleFieldChange(field, value) {
    setAiFields((current) => ({
      ...current,
      [field]: value,
    }))

    if (field !== 'description') {
      resetDuplicateCheckState()
    }
  }

  async function createItem() {
    if (!accessToken) {
      setLoginPopupMessage('아이템 등록은 로그인 후 사용할 수 있습니다.')
      return
    }

    const numericPrice = Number(aiFields.price.replaceAll(',', '').replaceAll('₩', '').trim())
    const formData = new FormData()
    formData.append('name', aiFields.name.trim())
    formData.append('description', aiFields.description.trim())
    formData.append('category', aiFields.category)
    formData.append('price', String(numericPrice))
    formData.append('shop_or_brand_name', aiFields.shopOrBrandName.trim())
    formData.append('original_url', aiFields.originalUrl.trim())

    if (selectedImageFile) {
      formData.append('image', selectedImageFile)
    }

    setIsSubmitting(true)

    try {
      const itemResponse = await apiFetch('/items/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      const itemData = await itemResponse.json().catch(() => null)

      if (itemResponse.status === 401 || itemResponse.status === 403) {
        logout()
        navigate('/login', { replace: true })
        return
      }

      if (!itemResponse.ok) {
        throw new Error(normalizeError(itemData))
      }

      setDuplicateCheckResult({
        has_duplicates: false,
        message: '',
        candidates: [],
      })
      setShowCreatedConfirm(true)
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : '아이템 등록 중 오류가 발생했습니다.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function runDuplicateCheckAndContinue() {
    setMessage(emptyMessage)

    if (!accessToken || !userId) {
      setLoginPopupMessage('아이템 등록은 로그인 후 사용할 수 있습니다.')
      return
    }

    if (!aiFields.name.trim()) {
      setMessage({ type: 'error', text: '상품명을 입력해 주세요.' })
      return
    }

    if (!aiFields.shopOrBrandName.trim()) {
      setMessage({ type: 'error', text: '쇼핑몰명 또는 브랜드명을 입력해 주세요.' })
      return
    }

    const numericPrice = Number(aiFields.price.replaceAll(',', '').replaceAll('₩', '').trim())
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setMessage({ type: 'error', text: '가격은 0보다 큰 숫자로 입력해 주세요.' })
      return
    }

    setIsCheckingDuplicates(true)

    try {
      const response = await apiFetch('/items/duplicate-candidates/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: aiFields.name.trim(),
          shop_or_brand_name: aiFields.shopOrBrandName.trim(),
          original_url: aiFields.originalUrl.trim(),
          price: numericPrice,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(normalizeError(data))
      }

      if (data.has_duplicates) {
        setDuplicateCheckResult(data)
        setMessage({
          type: 'info',
          text: data.message,
        })
        return
      }

      setDuplicateCheckResult(null)
      setHasPassedDuplicateCheck(true)
      navigate('/itemreg/description')
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error instanceof Error
            ? error.message
            : '유사 아이템 탐색 중 오류가 발생했습니다.',
      })
    } finally {
      setIsCheckingDuplicates(false)
    }
  }

  async function runSubmit() {
    setMessage(emptyMessage)

    if (!hasPassedDuplicateCheck) {
      setMessage({ type: 'error', text: '상품 정보 확인을 먼저 완료해 주세요.' })
      navigate('/itemreg')
      return
    }

    if (!aiFields.description.trim()) {
      setMessage({ type: 'error', text: '상품 설명을 입력해 주세요.' })
      return
    }

    await createItem()
  }

  function handleFinalSubmitClick() {
    setShowSubmitConfirm(true)
  }

  function handleCandidateClick(itemId) {
    navigate(`/items/${itemId}/reviews/new`)
  }

  function closeDuplicatePopup() {
    setDuplicateCheckResult(null)
    setMessage(emptyMessage)
  }

  function proceedDespiteDuplicates() {
    setDuplicateCheckResult(null)
    setMessage(emptyMessage)
    setHasPassedDuplicateCheck(true)
    navigate('/itemreg/description')
  }

  function renderItemInfoStep() {
    return (
      <>
        <section className="itemreg-stack">
          <article className="panel itemreg-panel">
            <div className="itemreg-panel-heading">
              <div>
                <h2>상품 정보 입력</h2>
                <p>상품 기본 정보 입력 후 다음 버튼을 누르면 유사 아이템 중복 검사를 진행합니다.</p>
              </div>
            </div>

            <div className="itemreg-ai-box">
              <div className="itemreg-ai-copy">
                <strong>AI 자동 입력</strong>
                <p>구매 사이트 스크린샷으로 상품명, 브랜드명, 대표 이미지를 자동으로 채웁니다.</p>
              </div>
              <input
                ref={aiFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAiSourceFileChange}
                hidden
              />
              <button
                type="button"
                className="secondary-button"
                onClick={handleAiFillClick}
                disabled={isAiFilling}
              >
                {isAiFilling ? 'AI 분석 중...' : 'AI로 정보 채우기'}
              </button>
            </div>

            <div className="itemreg-field-grid">
              <label className="form-field">
                <span>상품명</span>
                <input
                  type="text"
                  value={aiFields.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>쇼핑몰명 또는 브랜드명</span>
                <input
                  type="text"
                  value={aiFields.shopOrBrandName}
                  onChange={(event) => handleFieldChange('shopOrBrandName', event.target.value)}
                />
              </label>
              <label className="form-field">
                <span>카테고리</span>
                <select
                  value={aiFields.category}
                  onChange={(event) => handleFieldChange('category', event.target.value)}
                >
                  {ITEM_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>원본 URL</span>
                <input
                  type="url"
                  value={aiFields.originalUrl}
                  onChange={(event) => handleFieldChange('originalUrl', event.target.value)}
                  placeholder={fallbackLinkLabel}
                />
              </label>
              <label className="form-field">
                <span>가격</span>
                <input
                  type="text"
                  value={aiFields.price}
                  onChange={(event) => handleFieldChange('price', event.target.value)}
                  placeholder="28000"
                />
              </label>
              <div className="form-field itemreg-image-field">
                <span>대표 이미지 첨부</span>
                <input
                  ref={imageFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  hidden
                />
                <div className="itemreg-image-panel">
                  <div className="itemreg-image-preview-shell">
                    {representativeImageSrc && !isRepresentativeImageBroken ? (
                      <img
                        src={representativeImageSrc}
                        alt="대표 이미지 미리보기"
                        onError={() => setIsRepresentativeImageBroken(true)}
                      />
                    ) : (
                      <div className="itemreg-image-placeholder">No Image</div>
                    )}
                  </div>
                  <div className="itemreg-image-meta">
                    <strong>
                      {imageFileName
                        ? hasAiGeneratedImage
                          ? 'AI가 추출한 대표 이미지'
                          : imageFileName
                        : '아직 대표 이미지가 없습니다'}
                    </strong>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={handleImageUploadClick}
                    >
                      {imageFileName ? '대표 이미지 변경' : '대표 이미지 직접 첨부하기'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>

        <div className="itemreg-action-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate(-1)}
          >
            뒤로가기
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={runDuplicateCheckAndContinue}
            disabled={isCheckingDuplicates || isSubmitting}
          >
            {nextLabel}
          </button>
        </div>
      </>
    )
  }

  function renderDescriptionStep() {
    if (!hasPassedDuplicateCheck) {
      return <Navigate to="/itemreg" replace />
    }

    return (
      <>
        <section className="itemreg-stack">
          <article className="panel itemreg-panel">
            <div className="itemreg-panel-heading">
              <div>
                <h2>상품 설명 작성</h2>
              </div>
            </div>

            <div className="itemreg-summary">
              <strong>{aiFields.name || '상품명 미입력'}</strong>
              <p>{aiFields.shopOrBrandName || '브랜드/쇼핑몰명 미입력'}</p>
              <p>{getCategoryLabel(aiFields.category)}</p>
              <p>{formatPrice(aiFields.price)}</p>
            </div>

            <label className="form-field">
              <span>상품 설명</span>
              <textarea
                rows="8"
                value={aiFields.description}
                onChange={(event) => handleFieldChange('description', event.target.value)}
                placeholder="실사용 경험, 장단점, 추천 대상 등을 작성"
              />
            </label>
          </article>
        </section>

        <div className="itemreg-action-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate('/itemreg')}
          >
            상품 정보 수정
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleFinalSubmitClick}
            disabled={isSubmitting}
          >
            {submitLabel}
          </button>
        </div>
      </>
    )
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h3>추천템 등록하기</h3>
        </div>
      </header>

      {message.text ? (
        <p className={`feedback feedback-${message.type || 'info'}`}>{message.text}</p>
      ) : null}

      <LoginPopup
        message={loginPopupMessage}
        onClose={() => {
          setLoginPopupMessage('')
          navigate('/login', { replace: true })
        }}
      />
      <ConfirmPopup
        message={showSubmitConfirm ? '입력한 정보로 아이템을 등록하시겠습니까?' : ''}
        onConfirm={() => {
          setShowSubmitConfirm(false)
          runSubmit()
        }}
        onCancel={() => setShowSubmitConfirm(false)}
      />
      <ConfirmPopup
        message={showCreatedConfirm ? '등록 완료되었습니다.' : ''}
        onConfirm={() => {
          setShowCreatedConfirm(false)
          navigate('/', { replace: true })
        }}
      />

      {duplicateCheckResult?.has_duplicates ? (
        <div
          className="login-popup-overlay"
          role="presentation"
          onClick={closeDuplicatePopup}
        >
          <div
            className="login-popup-card itemreg-duplicate-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="duplicate-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p id="duplicate-popup-title" className="login-popup-message">
              {duplicateCheckResult.message}
            </p>
            <div className="itemreg-candidate-list itemreg-duplicate-popup-list">
              {duplicateCheckResult.candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="itemreg-candidate"
                  onClick={() => handleCandidateClick(candidate.id)}
                >
                  <div>
                    <strong>{candidate.name}</strong>
                    <p>
                      {candidate.shop_or_brand_name} · {formatPrice(candidate.price)}
                    </p>
                    <small>추천 {candidate.starCount ?? 0}</small>
                    <small>{candidate.reason}</small>
                  </div>
                </button>
              ))}
            </div>
            <div className="login-popup-actions">
              <button type="button" className="secondary-button" onClick={closeDuplicatePopup}>
                다시 입력하기
              </button>
              <button type="button" className="primary-button" onClick={proceedDespiteDuplicates}>
                그대로 등록 진행
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isAuthenticated ? (
        <section className="itemreg-stack">
          <article className="panel itemreg-panel">
            <div className="empty-state">
              <strong>로그인이 필요합니다</strong>
              <p>아이템 등록과 AI 자동 입력은 로그인 후 사용할 수 있습니다.</p>
            </div>
          </article>
        </section>
      ) : (
        <Routes>
          <Route index element={renderItemInfoStep()} />
          <Route path="description" element={renderDescriptionStep()} />
          <Route path="*" element={<Navigate to="/itemreg" replace />} />
        </Routes>
      )}
    </main>
  )
}

export default ItemRegPage
