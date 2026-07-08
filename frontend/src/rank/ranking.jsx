import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FALLBACK_CATEGORIES } from '../constants/categories'
import LoginPopup from '../components/LoginPopup'
import ConfirmPopup from '../components/ConfirmPopup'
import '../rank/ranking.css'
import { apiFetch, buildApiUrl } from '../lib/api'

const RANKING_PAGE_SIZE = 20

async function readErrorMessage(response) {
  try {
    const data = await response.json()
    return data.detail ?? '요청을 처리하지 못했습니다.'
  } catch {
    return '요청을 처리하지 못했습니다.'
  }
}

function RankingPage() {
  const { accessToken } = useAuth()
  const location = useLocation()
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [limit, setLimit] = useState(RANKING_PAGE_SIZE)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState(
    () => new URLSearchParams(location.search).get('category') ?? 'all',
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [brokenImages, setBrokenImages] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingStar, setPendingStar] = useState(null)
  const [loginPopupMessage, setLoginPopupMessage] = useState('')
  const [recommendConfirmItemId, setRecommendConfirmItemId] = useState(null)

  async function loadCategories() {
    try {
      const response = await apiFetch('/items/categories/')
      if (!response.ok) return

      const data = await response.json()
      if (Array.isArray(data.results) && data.results.length > 0) {
        setCategories(data.results)
      }
    } catch {
      setCategories(FALLBACK_CATEGORIES)
    }
  }

  async function loadRanking(category, currentLimit, { isLoadMore = false } = {}) {
    if (isLoadMore) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    setErrorMessage('')

    try {
      const params = new URLSearchParams()
      if (category && category !== 'all') {
        params.set('category', category)
      }
      params.set('limit', String(currentLimit))

      const itemsResponse = await apiFetch(`/items/ranking/?${params.toString()}`)

      if (!itemsResponse.ok) {
        throw new Error(await readErrorMessage(itemsResponse))
      }

      const itemsData = await itemsResponse.json()
      const rawItems = itemsData.results ?? []

      setItems(rawItems)
      setTotalCount(itemsData.count ?? rawItems.length)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '랭킹을 불러오지 못했습니다.',
      )
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadRanking(activeCategory, limit, { isLoadMore: limit > RANKING_PAGE_SIZE })
  }, [activeCategory, limit])

  useEffect(() => {
    const categoryFromUrl = new URLSearchParams(location.search).get('category')
    if (categoryFromUrl && categoryFromUrl !== activeCategory) {
      setActionMessage('')
      setActiveCategory(categoryFromUrl)
      setLimit(RANKING_PAGE_SIZE)
    }
  }, [location.search])

  function handleCategoryChange(category) {
    setActionMessage('')
    setActiveCategory(category)
    setLimit(RANKING_PAGE_SIZE)
  }

  function handleLoadMore() {
    setLimit((prev) => prev + RANKING_PAGE_SIZE)
  }

  function handleStarClick(itemId) {
    if (!accessToken) {
      setLoginPopupMessage('아이템 추천은 로그인 후 사용할 수 있습니다.')
      return
    }

    setRecommendConfirmItemId(itemId)
  }

  function handleRecommendConfirm() {
    const itemId = recommendConfirmItemId
    setRecommendConfirmItemId(null)

    if (itemId != null) {
      handleStarToggle(itemId)
    }
  }

  async function handleStarToggle(itemId) {
    if (!accessToken) return

    setPendingStar(itemId)
    setActionMessage('')

    try {
      const response = await apiFetch(`/items/${itemId}/star/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (response.status === 401 || response.status === 403) {
        throw new Error('로그인이 필요합니다.')
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const wasAdded = response.status === 201

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId
            ? {
                ...item,
                isStarred: wasAdded,
                starCount: wasAdded
                  ? (item.starCount ?? 0) + 1
                  : Math.max((item.starCount ?? 1) - 1, 0),
              }
            : item,
        ),
      )
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : '별표를 저장하지 못했습니다.',
      )
    } finally {
      setPendingStar(null)
    }
  }

  const normalizedSearchTerm = searchTerm.trim().toLowerCase()
  const visibleItems = normalizedSearchTerm
    ? items.filter((item) => item.name.toLowerCase().includes(normalizedSearchTerm))
    : items

  const recommendConfirmItem = items.find((item) => item.id === recommendConfirmItemId)

  return (
    <main className="page-shell ranking-page">
      <LoginPopup message={loginPopupMessage} onClose={() => setLoginPopupMessage('')} />
      <ConfirmPopup
        message={
          recommendConfirmItem
            ? recommendConfirmItem.isStarred
              ? '추천을 취소하시겠습니까?'
              : '이 아이템을 추천하시겠습니까?'
            : ''
        }
        onConfirm={handleRecommendConfirm}
        onCancel={() => setRecommendConfirmItemId(null)}
      />

      <div className="category-filter" aria-label="카테고리 필터">
        {categories.map((category) => (
          <button
            className={
              activeCategory === category.value
                ? 'category-button active-category'
                : 'category-button'
            }
            key={category.value}
            type="button"
            onClick={() => handleCategoryChange(category.value)}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="search-bar" style={{ margin: '16px 0' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="아이템 이름으로 검색"
          aria-label="아이템 이름 검색"
          style={{ width: '100%', padding: '10px 12px' }}
        />
      </div>

      {actionMessage && <p className="notice">{actionMessage}</p>}

      <section className="ranking-section">
        {isLoading && <p className="state-text">랭킹을 불러오는 중입니다.</p>}

        {!isLoading && errorMessage && (
          <div className="empty-state">
            <strong>연결 실패</strong>
            <p>{errorMessage}</p>
          </div>
        )}

        {!isLoading && !errorMessage && items.length === 0 && (
          <div className="empty-state">
            <strong>등록된 아이템이 없습니다.</strong>
            <p>아이템 데이터가 추가되면 이곳에 순위가 표시됩니다.</p>
          </div>
        )}

        {!isLoading && !errorMessage && items.length > 0 && visibleItems.length === 0 && (
          <div className="empty-state">
            <strong>검색 결과가 없습니다.</strong>
            <p>'{searchTerm}'에 해당하는 아이템을 찾을 수 없습니다.</p>
          </div>
        )}

        {!isLoading && !errorMessage && visibleItems.length > 0 && (
          <>
            <ol className="ranking-list">
              {visibleItems.map((item, index) => {
                const hasImage = item.imageUrl && !brokenImages[item.id]
                const hasMeta =
                  item.brandOrShopName ||
                  item.priceText ||
                  (item.externalReviewCount !== null &&
                    item.externalReviewCount !== undefined)

                const rank = index + 1
                const rankBadgeClass =
                  rank === 1
                    ? 'rank-badge rank-badge-gold'
                    : rank === 2
                      ? 'rank-badge rank-badge-silver'
                      : rank === 3
                        ? 'rank-badge rank-badge-bronze'
                        : 'rank-badge'

                return (
                  <li className="ranking-item" key={item.id}>
                    <div className={rankBadgeClass}>
                      {rank === 1 && <span className="rank-star" aria-hidden="true">★</span>}
                      {rank}
                    </div>

                    <Link className="item-image" to={`/items/${item.id}`} aria-label={item.name}>
                      {hasImage ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          onError={() =>
                            setBrokenImages((current) => ({
                              ...current,
                              [item.id]: true,
                            }))
                          }
                        />
                      ) : (
                        <span>{item.name.slice(0, 1)}</span>
                      )}
                    </Link>

                    <div className="item-body">
                      <div className="item-heading">
                        <h2 className="ranking-item-link">{item.name}</h2>

                        <div className="star-column">
                          <button
                            type="button"
                            className={item.isStarred ? 'star-button star-button-active' : 'star-button'}
                            onClick={() => handleStarClick(item.id)}
                            disabled={pendingStar === item.id}
                            aria-pressed={item.isStarred}
                          >
                            <span className="star-icon" aria-hidden="true">★</span>
                            {item.starCount ?? 0}
                          </button>
                          {item.createdByUsername && (
                            <span className="uploader-badge">{item.createdByUsername}</span>
                          )}
                        </div>
                      </div>

                      {hasMeta && (
                        <div className="item-meta">
                          {item.brandOrShopName && <span>{item.brandOrShopName}</span>}
                          {item.priceText && <span>{item.priceText}</span>}
                          {item.externalReviewCount !== null &&
                            item.externalReviewCount !== undefined && (
                              <span>리뷰 {item.externalReviewCount}</span>
                            )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>

            {!normalizedSearchTerm && items.length < totalCount && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="category-button"
                  style={{
                    padding: '10px 24px',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoadingMore ? '불러오는 중...' : `더 보기 (${items.length}/${totalCount})`}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  )
}

export default RankingPage