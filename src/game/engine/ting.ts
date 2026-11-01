import type { GameTips, Meld, Player, PlayerId, Tile, TileSuit, TingWait } from '../types'
import { getTileKey, getTileName } from './deck'
import { canHu, detectPotentialFans, evaluateFans } from './rules'

const ALL_TILE_SPECS: Array<{ suit: TileSuit; value: number }> = [
  ...Array.from({ length: 9 }, (_, i) => ({ suit: 'wan' as TileSuit, value: i + 1 })),
  ...Array.from({ length: 9 }, (_, i) => ({ suit: 'tong' as TileSuit, value: i + 1 })),
  ...Array.from({ length: 9 }, (_, i) => ({ suit: 'tiao' as TileSuit, value: i + 1 })),
  ...Array.from({ length: 4 }, (_, i) => ({ suit: 'wind' as TileSuit, value: i + 1 })),
  ...Array.from({ length: 3 }, (_, i) => ({ suit: 'dragon' as TileSuit, value: i + 1 })),
]

/**
 * 统计桌面上对玩家可见的各牌已出现张数（自身手牌 + 所有玩家弃牌 + 所有玩家副露）
 */
export function getVisibleTileCounts(
  hand: readonly Tile[],
  players: Record<PlayerId, Player>
): Map<string, number> {
  const counts = new Map<string, number>()
  const add = (t: Tile) => {
    const k = getTileKey(t)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  for (const t of hand) add(t)
  for (const p of Object.values(players)) {
    for (const d of p.discards) add(d)
    for (const m of p.melds) {
      for (const mt of m.tiles) add(mt)
    }
  }
  return counts
}

/**
 * 针对 3n+1 张手牌（如13张），计算所听的牌列表
 */
export function getTingWaits(
  hand: readonly Tile[],
  melds: readonly Meld[],
  visibleCounts?: Map<string, number>
): TingWait[] {
  if (hand.length % 3 !== 1) return []

  const ownHandCounts = new Map<string, number>()
  for (const t of hand) {
    const k = getTileKey(t)
    ownHandCounts.set(k, (ownHandCounts.get(k) ?? 0) + 1)
  }

  const waits: TingWait[] = []

  for (const spec of ALL_TILE_SPECS) {
    const key = `${spec.suit}-${spec.value}`
    // 如果自己手里已经有4张该牌，不可能再摸到第5张成胡
    if ((ownHandCounts.get(key) ?? 0) >= 4) continue

    const testTile: Tile = {
      id: `virtual-${key}`,
      suit: spec.suit,
      value: spec.value,
      name: getTileName(spec.suit, spec.value),
    }

    if (canHu(hand, melds, testTile)) {
      const fullHand = [...hand, testTile]
      const { fanNames, totalFan } = evaluateFans(fullHand, melds, false)
      const usedCount = visibleCounts ? (visibleCounts.get(key) ?? 0) : (ownHandCounts.get(key) ?? 0)
      const remaining = Math.max(0, 4 - usedCount)

      waits.push({
        key,
        suit: spec.suit,
        value: spec.value,
        name: testTile.name,
        remaining,
        fanNames,
        totalFan,
      })
    }
  }

  return waits
}

/**
 * 综合计算本家的听牌提示、打哪张可听提示以及潜在番型提示
 */
export function calculateGameTips(
  hand: readonly Tile[],
  melds: readonly Meld[],
  players: Record<PlayerId, Player>
): GameTips {
  const visibleCounts = getVisibleTileCounts(hand, players)
  const fanHints = detectPotentialFans(hand, melds)

  // 当玩家手牌为 3n+1（13张，等待摸牌或他人出牌）
  if (hand.length % 3 === 1) {
    const waits = getTingWaits(hand, melds, visibleCounts)
    return {
      isTing: waits.length > 0,
      waits,
      discardHints: {},
      fanHints,
    }
  }

  // 当玩家手牌为 3n+2（14张，轮到本家出牌）：计算打出哪张牌可以进入听牌
  if (hand.length % 3 === 2) {
    const discardHints: Record<string, TingWait[]> = {}
    const checkedKeys = new Set<string>()

    for (let i = 0; i < hand.length; i++) {
      const candidate = hand[i]
      const key = getTileKey(candidate)
      if (checkedKeys.has(key)) continue
      checkedKeys.add(key)

      const remainingHand = [...hand.slice(0, i), ...hand.slice(i + 1)]
      const waits = getTingWaits(remainingHand, melds, visibleCounts)
      if (waits.length > 0) {
        discardHints[key] = waits
      }
    }

    // 取最多剩余张数的听牌方案作为默认展示
    let bestWaits: TingWait[] = []
    let bestCount = -1
    for (const wList of Object.values(discardHints)) {
      const totalRem = wList.reduce((acc, w) => acc + w.remaining, 0)
      if (totalRem > bestCount) {
        bestCount = totalRem
        bestWaits = wList
      }
    }

    return {
      isTing: Object.keys(discardHints).length > 0,
      waits: bestWaits,
      discardHints,
      fanHints,
    }
  }

  return {
    isTing: false,
    waits: [],
    discardHints: {},
    fanHints,
  }
}
