import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import './ranking.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

const FALLBACK_CATEGORIES = [
  { value: 'all', label: '전체' },
  { value: 'fashion', label: '의류/패션' },
  { value: 'food', label: '식품' },
  { value: 'beauty', label: '뷰티' },
  { value: 'electronics', label: '전자제품' },
  { value: 'appliances', label: '가전제품' },
  { value: 'living', label: '생활용품' },
  { value: 'health', label: '건강' },
  { value: 'sports', label: '스포츠/레저' },
  { value: 'books_hobby', label: '도서/취미' },
  { value: 'kids_pets', label: '유아/반려동물' },
  { value: 'etc', label: '기타' },
]

function getRankingScore(item) {
  return item.rankingScore ?? item.recommendCount - item.disrecommendCount
}

function sortRankingItems(items) {
  return [...items].sort((a, b) => {
    const scoreDiff = getRankingScore(b) - getRankingScore(a)
    if (scoreDiff !== 0) return scoreDiff

    const recommendDiff = b.recommendCount - a.recommendCount
    if (recommendDiff !== 0) return recommendDiff

    const disrecommendDiff = a.disrecommendCount - b.disrecommendCount
    if (disrecommendDiff !== 0) return disrecommendDiff

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
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES)
  const [activeCategory, setActiveCategory] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [pendingReaction, setPendingReaction] = useState(null)
  const [brokenImages, setBrokenImages] = useState({})

  async function loadCategories() {
    try {
      const response = await fetch(`${API_BASE_URL}/items/categories/`)
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
      const response = await fetch(`${API_BASE_URL}/items/ranking/${categoryQuery}`)
      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const data = await response.json()
      setItems(sortRankingItems(data.results ?? []))
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

  function handleCategoryChange(category) {
    setActionMessage('')
    setActiveCategory(category)
  }

  async function handleReaction(itemId, reaction) {
    setPendingReaction(`${itemId}-${reaction}`)
    setActionMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/items/${itemId}/reaction/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reaction }),
      })

      if (response.status === 401 || response.status === 403) {
        throw new Error('로그인 기능이 연결되면 추천과 비추천을 사용할 수 있습니다.')
      }

      if (!response.ok) {
        throw new Error(await readErrorMessage(response))
      }

      const updatedItem = await response.json()
      setItems((currentItems) =>
        sortRankingItems(
          currentItems.map((item) =>
            item.id === updatedItem.id ? updatedItem : item,
          ),
        ),
      )
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : '반응을 저장하지 못했습니다.',
      )
    } finally {
      setPendingReaction(null)
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">랭킹</p>
          <h1>추천 아이템</h1>
        </div>
      </header>

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

              return (
                <li className="ranking-item" key={item.id}>
                  <div className="rank-badge">{index + 1}</div>

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
                      <button
                        className={
                          item.userReaction === 'recommend'
                            ? 'reaction-button active-positive'
                            : 'reaction-button'
                        }
                        type="button"
                        disabled={pendingReaction === `${item.id}-recommend`}
                        onClick={() => handleReaction(item.id, 'recommend')}
                      >
                        <span>+</span>
                        추천 {item.recommendCount}
                      </button>

                      <button
                        className={
                          item.userReaction === 'disrecommend'
                            ? 'reaction-button active-negative'
                            : 'reaction-button'
                        }
                        type="button"
                        disabled={pendingReaction === `${item.id}-disrecommend`}
                        onClick={() => handleReaction(item.id, 'disrecommend')}
                      >
                        <span>-</span>
                        비추천 {item.disrecommendCount}
                      </button>

                      {item.productUrl && (
                        <a
                          className="product-link"
                          href={item.productUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          원본 보기
                        </a>
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

function RankingPageApp() {
  return (
    <>
      <nav className="top-nav">
        <Link className="brand-link" to="/">
          꿀템
        </Link>
        <div className="nav-links">
          <NavLink to="/">홈</NavLink>
          <NavLink to="/ranking">랭킹</NavLink>
        </div>
      </nav>
      <RankingPage />
    </>
  )
}

export default RankingPageApp
