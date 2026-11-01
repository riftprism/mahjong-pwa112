import type { ClaimAction, Meld, Tile, TileSuit } from '../types'
import { getTileKey, sortTiles } from './deck'

const NUMBER_SUITS: TileSuit[] = ['wan', 'tong', 'tiao']

export function isNumberSuit(suit: TileSuit): boolean {
  return NUMBER_SUITS.includes(suit)
}

/**
 * 统计手牌每种牌（suit-value）的数量
 */
export function countTilesByKey(tiles: readonly Tile[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of tiles) {
    const k = getTileKey(t)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return map
}

/**
 * 判断是否构成七对（必须无副露，且手牌共14张，7个对子；包含四张相同算两对）
 */
export function isSevenPairs(tiles: readonly Tile[], meldsCount = 0): boolean {
  if (meldsCount > 0 || tiles.length !== 14) return false
  const counts = countTilesByKey(tiles)
  let pairs = 0
  for (const c of counts.values()) {
    if (c === 2) pairs += 1
    else if (c === 4) pairs += 2
    else return false
  }
  return pairs === 7
}

/**
 * 递归检查剩余牌是否能完全拆分为刻子或顺子（3n 张牌）
 */
function canFormMeldsFromCounts(counts: Map<string, number>, remaining: number): boolean {
  if (remaining === 0) return true

  // 找到第一个数量 > 0 的牌（按固定顺序保证确定性）
  let firstKey: string | null = null
  const sortedKeys = Array.from(counts.keys()).sort()
  for (const k of sortedKeys) {
    if ((counts.get(k) ?? 0) > 0) {
      firstKey = k
      break
    }
  }
  if (!firstKey) return false

  const currentCount = counts.get(firstKey) ?? 0

  // 1. 尝试作为刻子（3张相同）
  if (currentCount >= 3) {
    counts.set(firstKey, currentCount - 3)
    if (canFormMeldsFromCounts(counts, remaining - 3)) {
      counts.set(firstKey, currentCount)
      return true
    }
    counts.set(firstKey, currentCount)
  }

  // 2. 如果是数牌（万、筒、条），尝试作为顺子（v, v+1, v+2）
  const [suitStr, valStr] = firstKey.split('-')
  const suit = suitStr as TileSuit
  const val = Number(valStr)
  if (isNumberSuit(suit) && val <= 7) {
    const key2 = `${suit}-${val + 1}`
    const key3 = `${suit}-${val + 2}`
    const c2 = counts.get(key2) ?? 0
    const c3 = counts.get(key3) ?? 0
    if (c2 > 0 && c3 > 0) {
      counts.set(firstKey, currentCount - 1)
      counts.set(key2, c2 - 1)
      counts.set(key3, c3 - 1)
      if (canFormMeldsFromCounts(counts, remaining - 3)) {
        counts.set(firstKey, currentCount)
        counts.set(key2, c2)
        counts.set(key3, c3)
        return true
      }
      counts.set(firstKey, currentCount)
      counts.set(key2, c2)
      counts.set(key3, c3)
    }
  }

  return false
}

/**
 * 判断手牌是否满足标准胡牌型（3n + 2：n个面子 + 1个将牌）
 */
export function isStandardHu(tiles: readonly Tile[]): boolean {
  if (tiles.length % 3 !== 2) return false
  const counts = countTilesByKey(tiles)
  const keys = Array.from(counts.keys())

  for (const pairKey of keys) {
    const c = counts.get(pairKey) ?? 0
    if (c >= 2) {
      counts.set(pairKey, c - 2)
      if (canFormMeldsFromCounts(counts, tiles.length - 2)) {
        counts.set(pairKey, c)
        return true
      }
      counts.set(pairKey, c)
    }
  }
  return false
}

/**
 * 判断是否全部为刻子 + 1将（对对胡手牌部分）
 */
function isAllTripletsHand(tiles: readonly Tile[]): boolean {
  if (tiles.length % 3 !== 2) return false
  const counts = countTilesByKey(tiles)
  let pairCount = 0
  for (const c of counts.values()) {
    if (c === 2) {
      pairCount++
    } else if (c !== 3) {
      return false
    }
  }
  return pairCount === 1
}

/**
 * 综合判断是否可胡牌（标准型 或 七对）
 */
export function canHu(hand: readonly Tile[], melds: readonly Meld[] = [], extraTile?: Tile): boolean {
  const allHand = extraTile ? [...hand, extraTile] : [...hand]
  if (allHand.length % 3 !== 2) return false
  if (isSevenPairs(allHand, melds.length)) return true
  return isStandardHu(allHand)
}

/**
 * 检查是否可以碰目标牌，返回用于碰的2张手牌或 null
 */
export function canPeng(hand: readonly Tile[], targetTile: Tile): Tile[] | null {
  const same = hand.filter((t) => t.suit === targetTile.suit && t.value === targetTile.value)
  if (same.length >= 2) {
    return same.slice(0, 2)
  }
  return null
}

/**
 * 检查是否可以明杠（点杠）目标牌，返回用于杠的3张手牌或 null
 */
export function canMingGang(hand: readonly Tile[], targetTile: Tile): Tile[] | null {
  const same = hand.filter((t) => t.suit === targetTile.suit && t.value === targetTile.value)
  if (same.length >= 3) {
    return same.slice(0, 3)
  }
  return null
}

/**
 * 检查本家摸牌后可进行的暗杠（手牌4张相同）或加杠（已碰牌+手牌第4张）
 */
export function getSelfGangActions(hand: readonly Tile[], melds: readonly Meld[]): ClaimAction[] {
  const actions: ClaimAction[] = []
  const byKey = new Map<string, Tile[]>()
  for (const t of hand) {
    const k = getTileKey(t)
    const list = byKey.get(k) ?? []
    list.push(t)
    byKey.set(k, list)
  }

  // 1. 暗杠：手牌中有4张相同
  for (const [, group] of byKey.entries()) {
    if (group.length === 4) {
      actions.push({
        type: 'angang',
        tiles: group,
        label: `暗杠 ${group[0].name}`,
      })
    }
  }

  // 2. 补杠/加杠：已碰的牌在手牌中有第4张
  for (const meld of melds) {
    if (meld.type === 'peng' && meld.tiles.length > 0) {
      const mTile = meld.tiles[0]
      const fourth = hand.find((t) => t.suit === mTile.suit && t.value === mTile.value)
      if (fourth) {
        actions.push({
          type: 'minggang',
          tiles: [fourth],
          targetTile: fourth,
          label: `加杠 ${fourth.name}`,
        })
      }
    }
  }

  return actions
}

/**
 * 检查是否可以吃上家打出的牌，返回所有可吃的2张手牌组合
 */
export function getChiOptions(hand: readonly Tile[], targetTile: Tile): Tile[][] {
  if (!isNumberSuit(targetTile.suit)) return []
  const suit = targetTile.suit
  const v = targetTile.value

  const findTile = (val: number) => hand.find((t) => t.suit === suit && t.value === val)

  const combos: Array<[number, number]> = [
    [v - 2, v - 1],
    [v - 1, v + 1],
    [v + 1, v + 2],
  ]

  const results: Tile[][] = []
  for (const [v1, v2] of combos) {
    if (v1 >= 1 && v2 <= 9) {
      const t1 = findTile(v1)
      const t2 = findTile(v2)
      if (t1 && t2) {
        results.push([t1, t2])
      }
    }
  }
  return results
}

/**
 * 计算胡牌番型与总番数
 */
export function evaluateFans(
  hand: readonly Tile[],
  melds: readonly Meld[],
  isZimo: boolean
): { fanNames: string[]; totalFan: number } {
  const fanNames: string[] = []
  let totalFan = 0

  const allTiles: Tile[] = [...hand]
  for (const m of melds) {
    // 杠牌算作同一花色点数参与整体花色判断
    allTiles.push(...m.tiles)
  }

  const suits = new Set(allTiles.map((t) => t.suit))
  const numberSuitsPresent = Array.from(suits).filter((s) => isNumberSuit(s))
  const hasHonors = suits.has('wind') || suits.has('dragon')

  // 1. 字一色 / 清一色 / 混一色
  if (numberSuitsPresent.length === 0 && hasHonors) {
    fanNames.push('字一色')
    totalFan += 8
  } else if (numberSuitsPresent.length === 1 && !hasHonors) {
    fanNames.push('清一色')
    totalFan += 6
  } else if (numberSuitsPresent.length === 1 && hasHonors) {
    fanNames.push('混一色')
    totalFan += 3
  }

  // 2. 七对 / 豪华七对 / 对对胡
  const sevenPairs = isSevenPairs(hand, melds.length)
  if (sevenPairs) {
    const counts = countTilesByKey(hand)
    const hasFour = Array.from(counts.values()).some((c) => c === 4)
    if (hasFour) {
      fanNames.push('豪华七对')
      totalFan += 6
    } else {
      fanNames.push('七对')
      totalFan += 4
    }
  } else {
    const noChiMelds = melds.every((m) => m.type !== 'chi')
    if (noChiMelds && isAllTripletsHand(hand)) {
      fanNames.push('对对胡')
      totalFan += 3
    }
  }

  // 3. 断幺九（全部为 2~8 的数牌）
  const isTanyao = allTiles.every((t) => isNumberSuit(t.suit) && t.value >= 2 && t.value <= 8)
  if (isTanyao) {
    fanNames.push('断幺九')
    totalFan += 1
  }

  // 4. 箭刻（中、发、白刻子或杠）
  const dragonCounts = new Map<number, number>()
  for (const t of allTiles) {
    if (t.suit === 'dragon') {
      dragonCounts.set(t.value, (dragonCounts.get(t.value) ?? 0) + 1)
    }
  }
  const dragonLabels: Record<number, string> = { 1: '红中刻', 2: '发财刻', 3: '白板刻' }
  for (const [val, cnt] of dragonCounts.entries()) {
    if (cnt >= 3) {
      fanNames.push(dragonLabels[val] ?? '箭刻')
      totalFan += 1
    }
  }

  // 5. 门前清（无吃、碰、明杠，允许暗杠）
  const isMenqing = melds.every((m) => m.type === 'angang')
  if (isMenqing && !sevenPairs) {
    fanNames.push('门前清')
    totalFan += 1
  }

  // 6. 自摸
  if (isZimo) {
    fanNames.push('自摸')
    totalFan += 1
  }

  // 7. 杠牌加番
  const gangCount = melds.filter((m) => m.type === 'minggang' || m.type === 'angang').length
  if (gangCount > 0) {
    fanNames.push(`杠牌×${gangCount}`)
    totalFan += gangCount
  }

  // 8. 基础平胡保底
  if (fanNames.length === 0) {
    fanNames.push('平胡')
    totalFan = 1
  }

  return { fanNames, totalFan }
}

/**
 * 评估当前未胡手牌的潜在番型方向提示（用于游戏中的简单番型提示）
 */
export function detectPotentialFans(hand: readonly Tile[], melds: readonly Meld[]): string[] {
  const hints: string[] = []
  const allTiles: Tile[] = [...hand, ...melds.flatMap((m) => m.tiles)]
  if (allTiles.length === 0) return hints

  // 统计各花色占比
  const suitCounts: Record<TileSuit, number> = {
    wan: 0,
    tong: 0,
    tiao: 0,
    wind: 0,
    dragon: 0,
  }
  for (const t of allTiles) {
    suitCounts[t.suit]++
  }

  const honors = suitCounts.wind + suitCounts.dragon
  for (const s of NUMBER_SUITS) {
    const suitLabel = s === 'wan' ? '万字' : s === 'tong' ? '筒子' : '条子'
    if (suitCounts[s] === allTiles.length) {
      hints.push(`清一色（${suitLabel}）`)
    } else if (suitCounts[s] + honors === allTiles.length && suitCounts[s] >= 8) {
      hints.push(`混一色（${suitLabel}）`)
    } else if (suitCounts[s] >= 10 && melds.every((m) => m.tiles[0]?.suit === s)) {
      hints.push(`可做${suitLabel}清/混一色`)
    }
  }

  // 检查七对潜力（无副露且对子数 >= 5）
  if (melds.length === 0) {
    const counts = countTilesByKey(hand)
    let pairs = 0
    for (const c of counts.values()) {
      if (c >= 2) pairs += Math.floor(c / 2)
    }
    if (pairs >= 5) {
      hints.push(`七对听口（已有${pairs}对）`)
    }
  }

  // 检查对对胡潜力
  const noChi = melds.every((m) => m.type !== 'chi')
  if (noChi) {
    const counts = countTilesByKey(hand)
    let setsOrPairs = melds.length
    for (const c of counts.values()) {
      if (c >= 2) setsOrPairs++
    }
    if (setsOrPairs >= 5) {
      hints.push('对对胡牌势')
    }
  }

  // 检查三元牌刻子
  const handCounts = countTilesByKey(allTiles)
  if ((handCounts.get('dragon-1') ?? 0) >= 3) hints.push('红中刻（+1番）')
  if ((handCounts.get('dragon-2') ?? 0) >= 3) hints.push('发财刻（+1番）')
  if ((handCounts.get('dragon-3') ?? 0) >= 3) hints.push('白板刻（+1番）')

  return hints
}

export { sortTiles }
