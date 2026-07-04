import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './itemreg.css'
import { apiFetch, buildApiUrl } from '../lib/api'

const emptyMessage = {
  type: '',
  text: '',
}

const emptyAiFields = {
  name: '',
  imageUrl: '',
  price: '',
  shopOrBrandName: '',
  originalUrl: '',
}

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

function toCandidate(item) {
  return {
    id: String(item.id),
    itemId: item.id,
    name: item.name,
    brand: item.shop_or_brand_name,
    price: formatPrice(item.price),
    starCount: item.starCount ?? 0,
    reason: '현재 DB에 저장된 아이템입니다. 중복 여부를 직접 확인해 주세요.',
  }
}

function ItemRegPage() {
  const navigate = useNavigate()
  const { accessToken, userId, logout } = useAuth()
  const aiFileInputRef = useRef(null)
  const imageFileInputRef = useRef(null)
  const [selectedType, setSelectedType] = useState('new')
  const [selectedCandidate, setSelectedCandidate] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [selectedImagePreviewUrl, setSelectedImagePreviewUrl] = useState('')
  const [imageFileName, setImageFileName] = useState('')
  const [hasAiGeneratedImage, setHasAiGeneratedImage] = useState(false)
  const [aiFields, setAiFields] = useState(emptyAiFields)
  const [aiPreview, setAiPreview] = useState(null)
  const [review, setReview] = useState({
    title: '',
    content: '',
  })
  const [duplicateCandidates, setDuplicateCandidates] = useState([])
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true)
  const [isAiFilling, setIsAiFilling] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState(emptyMessage)
  const [createdItem, setCreatedItem] = useState(null)
  const [createdReview, setCreatedReview] = useState(null)
  const isExistingItemMode = selectedType === 'existing'
  const representativeImageSrc = selectedImagePreviewUrl || aiPreview?.imageUrl || ''

  const submitLabel = useMemo(() => {
    if (selectedType === 'existing') {
      return isSubmitting ? '등록 중...' : '기존 아이템에 리뷰 연결'
    }

    return isSubmitting ? '등록 중...' : '새 아이템 DB 등록'
  }, [isSubmitting, selectedType])

  useEffect(() => {
    let isMounted = true

    async function loadItems() {
      setIsLoadingCandidates(true)

      try {
        const response = await fetch(buildApiUrl('/items/'))

        if (!response.ok) {
          throw new Error('아이템 목록을 불러오지 못했습니다.')
        }

        const data = await response.json()

        if (!isMounted) {
          return
        }

        const candidates = data.map(toCandidate)
        setDuplicateCandidates(candidates)
        setSelectedCandidate(candidates[0]?.id ?? '')
      } catch (error) {
        if (!isMounted) {
          return
        }

        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : '아이템 목록을 불러오는 중 오류가 발생했습니다.',
        })
      } finally {
        if (isMounted) {
          setIsLoadingCandidates(false)
        }
      }
    }

    loadItems()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (selectedImagePreviewUrl) {
        URL.revokeObjectURL(selectedImagePreviewUrl)
      }
    }
  }, [selectedImagePreviewUrl])

  function applySelectedImageFile(file) {
    if (selectedImagePreviewUrl) {
      URL.revokeObjectURL(selectedImagePreviewUrl)
    }

    if (!file) {
      setSelectedImageFile(null)
      setSelectedImagePreviewUrl('')
      setImageFileName('')
      setHasAiGeneratedImage(false)
      return
    }

    setSelectedImageFile(file)
    setSelectedImagePreviewUrl(URL.createObjectURL(file))
    setImageFileName(file.name)
    setHasAiGeneratedImage(false)
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
        price: extractedPrice,
        shopOrBrandName: extractedBrand,
      }

      setAiFields(nextFields)
      setAiPreview({
        ...nextFields,
        imageUrl: data.cropped_image_url ?? '',
      })

      if (data.cropped_image_url) {
        try {
          const imageResponse = await fetch(data.cropped_image_url)
          if (imageResponse.ok) {
            const imageBlob = await imageResponse.blob()
            const extension = imageBlob.type === 'image/jpeg' ? 'jpg' : 'png'
            const croppedImageFile = new File([imageBlob], `ai-cropped-product.${extension}`, {
              type: imageBlob.type || `image/${extension}`,
            })
            applySelectedImageFile(croppedImageFile)
            setImageFileName('AI가 추출한 대표 이미지')
            setHasAiGeneratedImage(true)
          }
        } catch {
          setImageFileName('AI가 추출한 대표 이미지')
          setHasAiGeneratedImage(true)
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
  }

  function handleReviewChange(field, value) {
    setReview((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function refreshItems(selectedItemId) {
    const response = await fetch(buildApiUrl('/items/'))

    if (!response.ok) {
      throw new Error('등록 후 아이템 목록을 새로고침하지 못했습니다.')
    }

    const data = await response.json()
    const candidates = data.map(toCandidate)
    setDuplicateCandidates(candidates)
    setSelectedCandidate(selectedItemId ? String(selectedItemId) : candidates[0]?.id ?? '')
  }

  async function createReview(itemId) {
    if (!accessToken || !userId) {
      throw new Error('리뷰를 저장하려면 먼저 로그인해 주세요.')
    }

    if (!review.title.trim()) {
      throw new Error('리뷰 제목을 입력해 주세요.')
    }

    if (!review.content.trim()) {
      throw new Error('리뷰 본문을 입력해 주세요.')
    }

    const response = await fetch(buildApiUrl('/reviews/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        item: itemId,
        user_id: userId,
        title: review.title.trim(),
        content: review.content.trim(),
      }),
    })

    const data = await response.json().catch(() => null)

    if (response.status === 401 || response.status === 403) {
      logout()
      navigate('/login', { replace: true })
      throw new Error('로그인이 필요합니다.')
    }

    if (!response.ok) {
      throw new Error(normalizeError(data))
    }

    setCreatedReview(data)
    return data
  }

  async function handleSubmit() {
    setMessage(emptyMessage)
    setCreatedReview(null)

    setIsSubmitting(true)

    try {
      if (selectedType === 'existing') {
        if (!selectedCandidate) {
          throw new Error('리뷰를 연결할 기존 아이템을 선택해 주세요.')
        }

        const reviewData = await createReview(Number(selectedCandidate))
        const selectedItemName =
          duplicateCandidates.find((candidate) => candidate.id === selectedCandidate)?.name ??
          `아이템 #${selectedCandidate}`

        setMessage({
          type: 'success',
          text: `리뷰 #${reviewData.id} 이(가) ${selectedItemName}에 연결되어 저장되었습니다.`,
        })
        return
      }

      if (!aiFields.name.trim()) {
        throw new Error('상품명을 입력해 주세요.')
      }

      if (!aiFields.shopOrBrandName.trim()) {
        throw new Error('쇼핑몰명 또는 브랜드명을 입력해 주세요.')
      }

      if (!aiFields.originalUrl.trim()) {
        throw new Error('원본 URL을 입력해 주세요.')
      }

      const numericPrice = Number(aiFields.price.replaceAll(',', '').replaceAll('₩', '').trim())

      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error('가격은 0보다 큰 숫자로 입력해 주세요.')
      }

      const formData = new FormData()
      formData.append('name', aiFields.name.trim())
      formData.append('price', String(numericPrice))
      formData.append('shop_or_brand_name', aiFields.shopOrBrandName.trim())
      formData.append('original_url', aiFields.originalUrl.trim())

      if (selectedImageFile) {
        formData.append('image', selectedImageFile)
      } else if (aiPreview?.imageUrl) {
        formData.append('image_url', aiPreview.imageUrl)
      }

      const itemResponse = await fetch(buildApiUrl('/items/'), {
        method: 'POST',
        body: formData,
      })

      const itemData = await itemResponse.json().catch(() => null)

      if (!itemResponse.ok) {
        throw new Error(normalizeError(itemData))
      }

      setCreatedItem(itemData)
      await refreshItems(itemData.id)
      const reviewData = await createReview(itemData.id)

      setMessage({
        type: 'success',
        text: `아이템 #${itemData.id} "${itemData.name}" 및 리뷰 #${reviewData.id} 이(가) DB에 저장되었습니다.`,
      })
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

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <h3>아이템 등록 및 리뷰 작성</h3>
        </div>
      </header>

      {message.text ? (
        <p className={`feedback feedback-${message.type || 'info'}`}>{message.text}</p>
      ) : null}

      <section className="itemreg-stack">
        <article className="panel itemreg-panel">
          <div className="itemreg-panel-heading">
            <span>1</span>
            <div>
              <h2>상품 정보 입력</h2>
              <p>상품 기본 정보는 직접 입력할 수 있고, 스크린샷을 넣으면 같은 칸을 AI 예시값으로 채울 수 있습니다.</p>
            </div>
          </div>

          {isExistingItemMode ? (
            <p className="feedback feedback-info">
              기존 아이템에 리뷰를 연결하는 중입니다. 상품 정보 입력 없이 바로 리뷰만 저장할 수 있습니다.
            </p>
          ) : null}

          <fieldset className={isExistingItemMode ? 'itemreg-disabled-block' : 'itemreg-active-block'} disabled={isExistingItemMode}>
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
                  onChange={(event) =>
                    handleFieldChange('shopOrBrandName', event.target.value)
                  }
                />
              </label>
              <label className="form-field">
                <span>원본 URL</span>
                <input
                  type="url"
                  value={aiFields.originalUrl}
                  onChange={(event) => handleFieldChange('originalUrl', event.target.value)}
                  placeholder="https://..."
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
                    {representativeImageSrc ? (
                      <img src={representativeImageSrc} alt="대표 이미지 미리보기" />
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
                      {imageFileName ? '대표 이미지 변경' : '대표 이미지 직접 첨부'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="itemreg-ai-box">
              <div className="itemreg-ai-copy">
                <strong>AI 자동 입력</strong>
                <p>버튼을 누르면 구매 사이트 스크린샷을 선택할 수 있고, 그 이미지 기준으로 상품명, 쇼핑몰명 또는 브랜드명, 대표 이미지를 자동으로 채웁니다.</p>
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
          </fieldset>
        </article>

        <article className="panel itemreg-panel">
          <div className="itemreg-panel-heading">
            <span>2</span>
            <div>
              <h2>중복 아이템 후보 확인</h2>
              <p>현재는 DB의 아이템 목록을 불러와 중복 여부를 직접 확인하도록 연결했습니다.</p>
            </div>
          </div>

          <div className="itemreg-choice-row">
            <label className={selectedType === 'new' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="item-type"
                value="new"
                checked={selectedType === 'new'}
                onChange={(event) => setSelectedType(event.target.value)}
              />
              새 아이템으로 등록
            </label>
            <label className={selectedType === 'existing' ? 'is-selected' : ''}>
              <input
                type="radio"
                name="item-type"
                value="existing"
                checked={selectedType === 'existing'}
                onChange={(event) => setSelectedType(event.target.value)}
              />
              이미 비슷한 아이템이 DB에 존재하는 경우
            </label>
          </div>

          <div className="itemreg-candidate-list">
            {selectedType === 'new' ? (
              <p className="itemreg-muted">새 아이템으로 등록을 선택했으므로 기존 아이템 목록은 숨깁니다.</p>
            ) : isLoadingCandidates ? (
              <p className="itemreg-muted">DB의 아이템 목록을 불러오는 중입니다.</p>
            ) : duplicateCandidates.length === 0 ? (
              <p className="itemreg-muted">현재 등록된 아이템이 없습니다. 첫 아이템을 바로 등록할 수 있습니다.</p>
            ) : (
              duplicateCandidates.map((candidate) => (
                <label
                  key={candidate.id}
                  className={`itemreg-candidate ${
                    selectedCandidate === candidate.id ? 'is-selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="candidate"
                    value={candidate.id}
                    checked={selectedCandidate === candidate.id}
                    onChange={(event) => setSelectedCandidate(event.target.value)}
                  />
                  <div>
                    <strong>{candidate.name}</strong>
                    <p>
                      {candidate.brand} · {candidate.price}
                    </p>
                    <small>추천 {candidate.starCount}</small>
                    <small>{candidate.reason}</small>
                  </div>
                </label>
              ))
            )}
          </div>
        </article>

        <article className="panel itemreg-panel">
          <div className="itemreg-panel-heading">
            <span>3</span>
            <div>
              <h2>리뷰 작성</h2>
              <p>리뷰 제목과 본문을 입력하면 아이템 등록 또는 기존 아이템 연결 시 함께 저장됩니다.</p>
            </div>
          </div>

          <label className="form-field">
            <span>리뷰 제목</span>
            <input
              type="text"
              value={review.title}
              onChange={(event) => handleReviewChange('title', event.target.value)}
              placeholder="리뷰를 요약하는 제목"
            />
          </label>

          <label className="form-field">
            <span>리뷰 본문</span>
            <textarea
              rows="8"
              value={review.content}
              onChange={(event) => handleReviewChange('content', event.target.value)}
              placeholder="실사용 경험, 장단점, 추천 대상 등을 작성"
            />
          </label>

          {createdItem ? (
            <p className="itemreg-created">
              최근 등록: #{createdItem.id} {createdItem.name}
            </p>
          ) : null}
          {createdReview ? (
            <p className="itemreg-created">
              최근 리뷰 등록: #{createdReview.id} {createdReview.title}
            </p>
          ) : null}
        </article>
      </section>

      <div className="itemreg-action-row">
        <button
          type="button"
          className="primary-button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {submitLabel}
        </button>
      </div>
    </main>
  )
}

export default ItemRegPage
