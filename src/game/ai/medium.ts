import type { Meld, Player, PlayerId, Tile } from '../types'
import { getTileKey } from '../engine/deck'
import { canMingGang, canPeng, countTilesByKey, isNumberSuit } from '../engine/rules'
import { getTingWaits } from '../engine/ting'

/**
 * 评估单张手牌对当前牌型的保留价值（分值越低越应该优先打出）
 */
function scoreTileKeepValue(
  tile: Tile,
  counts: Map<string, number>,
  discardedCounts: Map<string, number>
): number {
  const key = getTileKey(tile)
  const sameCount = counts.get(key) ?? 1
  let score = 0

  // 1. 刻子/对子高价值保留
  if (sameCount >= 3) {
    score += 120
  } else if (sameCount === 2) {
    score += 55
  }

  // 2. 数牌顺子与搭子连接度评估
  if (isNumberSuit(tile.suit)) {
    const v = tile.value
    const prev2 = counts.get(`${tile.suit}-${v - 2}`) ?? 0
    const prev1 = counts.get(`${tile.suit}-${v - 1}`) ?? 0
    const next1 = counts.get(`${tile.suit}-${v + 1}`) ?? 0
    const next2 = counts.get(`${tile.suit}-${v + 2}`) ?? 0

    // 已形成顺子的一部分
    if ((prev2 > 0 && prev1 > 0) || (prev1 > 0 && next1 > 0) || (next1 > 0 && next2 > 0)) {
      score += 85
    } else {
      // 两面搭子或嵌张搭子
      if (prev1 > 0) score += 32
      if (next1 > 0) score += 32
      if (prev2 > 0) score += 14
      if (next2 > 0) score += 14
    }

    // 中张（3~7）比边张（1,2,8,9）更容易靠张
    if (v >= 3 && v <= 7) {
      score += 10
    } else if (v === 2 || v === 8) {
      score += 4
    }
  } else {
    // 字牌（风、箭）单张孤张价值极低，应优先打出
    if (sameCount === 1) {
      score -= 20
    } else if (tile.suit === 'dragon') {
      // 三元牌对子/刻子有番数加成
      score += 12
    }
  }

  // 3. 简单危险度/安全度微调：桌面上已见较多的熟张更安全（分值略降使其在同等孤张时优先打出以避险）
  const seenInDiscards = discardedCounts.get(key) ?? 0
  if (sameCount === 1 && seenInDiscards >= 1) {
    score -= seenInDiscards * 3
  }

  return score
}

/**
 * 中等难度 AI 选择要打出的手牌
 * 1. 若打出某张牌后可直接听牌，优先选择听口最宽的打法
 * 2. 否则按面子/搭子/孤张启发式评分，打出价值最低的孤张或熟张
 */
export function chooseAIDiscard(
  aiPlayer: Player,
  allPlayers: Record<PlayerId, Player>
): Tile {
  const hand = aiPlayer.hand
  if (hand.length === 0) {
    throw new Error('AI 手牌为空，无法出牌')
  }

  // 1. 优先检查是否有可以打成听牌的选择
  let bestTingDiscard: Tile | null = null
  let maxWaitsCount = 0
  const checkedKeys = new Set<string>()

  for (let i = 0; i < hand.length; i++) {
    const candidate = hand[i]
    const k = getTileKey(candidate)
    if (checkedKeys.has(k)) continue
    checkedKeys.add(k)

    const remaining = [...hand.slice(0, i), ...hand.slice(i + 1)]
    const waits = getTingWaits(remaining, aiPlayer.melds)
    if (waits.length > maxWaitsCount) {
      maxWaitsCount = waits.length
      bestTingDiscard = candidate
    }
  }

  if (bestTingDiscard) {
    return bestTingDiscard
  }

  // 2. 统计全局弃牌与副露中的熟张数量
  const discardedCounts = new Map<string, number>()
  for (const p of Object.values(allPlayers)) {
    for (const d of p.discards) {
      const k = getTileKey(d)
      discardedCounts.set(k, (discardedCounts.get(k) ?? 0) + 1)
    }
  }

  // 3. 计算每张手牌的保留价值，选分值最低的牌打出
  const counts = countTilesByKey(hand)
  let lowestScore = Infinity
  let chosenTile = hand[0]

  for (const tile of hand) {
    const val = scoreTileKeepValue(tile, counts, discardedCounts)
    if (val < lowestScore) {
      lowestScore = val
      chosenTile = tile
    }
  }

  return chosenTile
}

/**
 * 中等难度 AI 决定是否碰/明杠别人打出的牌
 * 策略：
 * - 如果当前已经听牌，不轻易拆听去碰（除非明杠且不破坏基本结构）
 * - 三元牌（中发白）、或者手牌对子较多/孤张较多时积极碰牌
 */
export function shouldAIPengOrGang(
  aiPlayer: Player,
  targetTile: Tile
): { action: 'minggang' | 'peng' | null; tiles: Tile[] } {
  // 如果已经听牌，保持听牌不乱碰
  const currentWaits = getTingWaits(aiPlayer.hand, aiPlayer.melds)
  if (currentWaits.length > 0) {
    return { action: null, tiles: [] }
  }

  const gangTiles = canMingGang(aiPlayer.hand, targetTile)
  if (gangTiles && aiPlayer.hand.length >= 4) {
    return { action: 'minggang', tiles: gangTiles }
  }

  const pengTiles = canPeng(aiPlayer.hand, targetTile)
  if (!pengTiles) {
    return { action: null, tiles: [] }
  }

  // 评估碰牌前后的孤张改善情况或是否字牌对子
  if (targetTile.suit === 'dragon' || targetTile.suit === 'wind') {
    return { action: 'peng', tiles: pengTiles }
  }

  // 如果是数牌，检查该对子是否本来就在顺子中连接紧密
  const counts = countTilesByKey(aiPlayer.hand)
  const v = targetTile.value
  const prev1 = counts.get(`${targetTile.suit}-${v - 1}`) ?? 0
  const next1 = counts.get(`${targetTile.suit}-${v + 1}`) ?? 0

  // 若两边没有顺子散牌牵扯，碰出可加速做牌
  if (prev1 === 0 || next1 === 0) {
    return { action: 'peng', tiles: pengTiles }
  }

  return { action: null, tiles: [] }
}

/**
 * Helper to keep unused Meld import valid if needed
 */
export type AIMeldCheck = Meld
