import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FALLBACK_CATEGORIES } from '../constants/categories'
import '../rank/ranking.css'
import { apiFetch, buildApiUrl } from '../lib/api'

function getRankingScore(item) {
  return item.rankingScore ?? item.starCount ?? 0
}

function sortRankingItems(items) {
  return [...items].sort((a, b) => {
    const scoreDiff = getRankingScore(b) - getRankingScore(a)
    if (scoreDiff !== 0) return scoreDiff

    return a.id - b.id
  })
}

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
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState(
    () => new URLSearchParams(location.search).get('category') ?? 'all',
  )
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [pendingStar, setPendingStar] = useState(null)
  const [brokenImages, setBrokenImages] = useState({})

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

  async function loadRanking(category) {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const categoryQuery =
        category && category !== 'all'
          ? `?category=${encodeURIComponent(category)}`
          : ''

      // 아이템 목록 + star 정보를 동시에 요청
      const [itemsResponse, starResponse] = await Promise.all([
        apiFetch(`/items/ranking/${categoryQuery}`),
        apiFetch('/items/star-summary/', {
          headers: accessToken
            ? { Authorization: `Bearer ${accessToken}` }
            : {},
        }),
      ])

      if (!itemsResponse.ok) {
        throw new Error(await readErrorMessage(itemsResponse))
      }

      const itemsData = await itemsResponse.json()
      const rawItems = itemsData.results ?? []

      // star API 실패해도 목록 자체는 보여줄 수 있게 별도 처리
      let starMap = {}
      if (starResponse.ok) {
        const starData = await starResponse.json()
        starMap = Object.fromEntries(
          (starData.results ?? []).map((s) => [s.id, s]),
        )
      }

      const merged = rawItems.map((item) => ({
        ...item,
        starCount: starMap[item.id]?.starCount ?? 0,
        isStarred: starMap[item.id]?.isStarred ?? false,
      }))

      setItems(sortRankingItems(merged))
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '랭킹을 불러오지 못했습니다.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadRanking(activeCategory)
  }, [activeCategory])

  useEffect(() => {
    const categoryFromUrl = new URLSearchParams(location.search).get('category')
    if (categoryFromUrl && categoryFromUrl !== activeCategory) {
      setActionMessage('')
      setActiveCategory(categoryFromUrl)
    }
  }, [location.search])

  function handleCategoryChange(category) {
    setActionMessage('')
    setActiveCategory(category)
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

      const wasAdded = response.status === 201 // 201: 추가됨, 200: 취소됨

      setItems((currentItems) =>
        sortRankingItems(
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

  return (
    <main className="page-shell ranking-page">
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

        {!isLoading && !errorMessage && items.length > 0 && (
          <ol className="ranking-list">
            {items.map((item, index) => {
              const hasImage = item.imageUrl && !brokenImages[item.id]
              const hasMeta =
                item.categoryLabel ||
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
                      <h2>
                        <Link className="ranking-item-link" to={`/items/${item.id}`}>
                          {item.name}
                        </Link>
                      </h2>
                    </div>

                    {hasMeta && (
                      <div className="item-meta">
                        {item.categoryLabel && <span>{item.categoryLabel}</span>}
                        {item.brandOrShopName && <span>{item.brandOrShopName}</span>}
                        {item.priceText && <span>{item.priceText}</span>}
                        {item.externalReviewCount !== null &&
                          item.externalReviewCount !== undefined && (
                            <span>리뷰 {item.externalReviewCount}</span>
                          )}
                      </div>
                    )}

                    <div className="item-actions">
                      {accessToken ? (
                        <button
                          className={
                            item.isStarred
                              ? 'star-button star-button-active'
                              : 'star-button'
                          }
                          type="button"
                          disabled={pendingStar === item.id}
                          onClick={() => handleStarToggle(item.id)}
                          aria-pressed={Boolean(item.isStarred)}
                          aria-label={item.isStarred ? '별표 취소' : '별표 추가'}
                        >
                          <span className="star-icon">★</span>
                          {item.starCount ?? 0}
                        </button>
                      ) : (
                        <span className="reaction-count-text">
                          <span className="star-icon">★</span>
                          {item.starCount ?? 0}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </main>
  )
}

export default RankingPage
