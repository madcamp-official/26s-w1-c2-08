export const ITEM_CATEGORIES = [
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

export const FALLBACK_CATEGORIES = [{ value: 'all', label: '전체' }, ...ITEM_CATEGORIES]

export const CATEGORY_LABELS = Object.fromEntries(
  ITEM_CATEGORIES.map((category) => [category.value, category.label]),
)
