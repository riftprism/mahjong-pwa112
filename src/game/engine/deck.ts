import type { Tile, TileSuit } from '../types'

const WAN_NAMES = ['一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万']
const TONG_NAMES = ['一筒', '二筒', '三筒', '四筒', '五筒', '六筒', '七筒', '八筒', '九筒']
const TIAO_NAMES = ['一条', '二条', '三条', '四条', '五条', '六条', '七条', '八条', '九条']
const WIND_NAMES = ['东', '南', '西', '北']
const DRAGON_NAMES = ['中', '发', '白']

const SUIT_ORDER: Record<TileSuit, number> = {
  wan: 1,
  tong: 2,
  tiao: 3,
  wind: 4,
  dragon: 5,
}

export function getTileName(suit: TileSuit, value: number): string {
  switch (suit) {
    case 'wan':
      return WAN_NAMES[value - 1] ?? `${value}万`
    case 'tong':
      return TONG_NAMES[value - 1] ?? `${value}筒`
    case 'tiao':
      return TIAO_NAMES[value - 1] ?? `${value}条`
    case 'wind':
      return WIND_NAMES[value - 1] ?? '风'
    case 'dragon':
      return DRAGON_NAMES[value - 1] ?? '箭'
  }
}

export function getTileKey(tile: Pick<Tile, 'suit' | 'value'>): string {
  return `${tile.suit}-${tile.value}`
}

export function parseTileKey(key: string): { suit: TileSuit; value: number; name: string } {
  const [suitStr, valStr] = key.split('-')
  const suit = suitStr as TileSuit
  const value = Number(valStr)
  return {
    suit,
    value,
    name: getTileName(suit, value),
  }
}

/**
 * 生成标准 136 张麻将牌（万、筒、条、风、箭，每种 4 张）
 */
export function createFullDeck(): Tile[] {
  const deck: Tile[] = []

  const addTiles = (suit: TileSuit, maxVal: number) => {
    for (let value = 1; value <= maxVal; value++) {
      const name = getTileName(suit, value)
      for (let copy = 1; copy <= 4; copy++) {
        deck.push({
          id: `${suit}-${value}-${copy}`,
          suit,
          value,
          name,
        })
      }
    }
  }

  addTiles('wan', 9)
  addTiles('tong', 9)
  addTiles('tiao', 9)
  addTiles('wind', 4)
  addTiles('dragon', 3)

  return deck
}

/**
 * Fisher-Yates 洗牌算法（返回新数组，不修改原数组）
 */
export function shuffle(deck: readonly Tile[]): Tile[] {
  const copy = [...deck]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copy[i]
    copy[i] = copy[j]
    copy[j] = temp
  }
  return copy
}

/**
 * 理牌排序（按 万 -> 筒 -> 条 -> 风 -> 箭 及点数升序）
 */
export function sortTiles(tiles: readonly Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
    if (suitDiff !== 0) return suitDiff
    if (a.value !== b.value) return a.value - b.value
    return a.id.localeCompare(b.id)
  })
}
