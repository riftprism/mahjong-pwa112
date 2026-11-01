import { create } from 'zustand'
import type {
  ClaimAction,
  GameState,
  GameStats,
  Meld,
  PersistedRecords,
  Player,
  PlayerId,
  RoundResult,
  Tile,
} from '../types'
import { createFullDeck, shuffle, sortTiles } from '../engine/deck'
import {
  canHu,
  canMingGang,
  canPeng,
  evaluateFans,
  getChiOptions,
  getSelfGangActions,
} from '../engine/rules'
import { calculateGameTips } from '../engine/ting'
import { chooseAIDiscard, shouldAIPengOrGang } from '../ai/medium'

const TURN_ORDER: PlayerId[] = ['player', 'ai1', 'ai2', 'ai3']
const INITIAL_SCORE = 1000
const BASE_POINTS = 10
const STORAGE_KEY = 'mahjong-records-v1'

let aiTimer: ReturnType<typeof setTimeout> | null = null

function clearAITimer() {
  if (aiTimer) {
    clearTimeout(aiTimer)
    aiTimer = null
  }
}

function getNextPlayerId(current: PlayerId): PlayerId {
  const idx = TURN_ORDER.indexOf(current)
  return TURN_ORDER[(idx + 1) % TURN_ORDER.length]
}

function isUpperPlayer(discarder: PlayerId, receiver: PlayerId): boolean {
  return getNextPlayerId(discarder) === receiver
}

function createEmptyStats(): GameStats {
  return {
    totalRounds: 0,
    playerWins: 0,
    playerZimo: 0,
    draws: 0,
    highestFan: 0,
    history: [],
  }
}

function loadPersistedRecords(): {
  scores: Record<PlayerId, number>
  stats: GameStats
} {
  const defaultScores: Record<PlayerId, number> = {
    player: INITIAL_SCORE,
    ai1: INITIAL_SCORE,
    ai2: INITIAL_SCORE,
    ai3: INITIAL_SCORE,
  }
  if (typeof window === 'undefined') {
    return { scores: defaultScores, stats: createEmptyStats() }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { scores: defaultScores, stats: createEmptyStats() }
    const parsed = JSON.parse(raw) as Partial<PersistedRecords>
    if (!parsed || typeof parsed !== 'object') {
      return { scores: defaultScores, stats: createEmptyStats() }
    }
    const s = parsed.scores
    const st = parsed.stats
    const scores: Record<PlayerId, number> = {
      player: typeof s?.player === 'number' ? s.player : INITIAL_SCORE,
      ai1: typeof s?.ai1 === 'number' ? s.ai1 : INITIAL_SCORE,
      ai2: typeof s?.ai2 === 'number' ? s.ai2 : INITIAL_SCORE,
      ai3: typeof s?.ai3 === 'number' ? s.ai3 : INITIAL_SCORE,
    }
    const stats: GameStats = {
      totalRounds: typeof st?.totalRounds === 'number' ? st.totalRounds : 0,
      playerWins: typeof st?.playerWins === 'number' ? st.playerWins : 0,
      playerZimo: typeof st?.playerZimo === 'number' ? st.playerZimo : 0,
      draws: typeof st?.draws === 'number' ? st.draws : 0,
      highestFan: typeof st?.highestFan === 'number' ? st.highestFan : 0,
      history: Array.isArray(st?.history) ? st.history.slice(0, 50) : [],
    }
    return { scores, stats }
  } catch {
    return { scores: defaultScores, stats: createEmptyStats() }
  }
}

function savePersistedRecords(scores: Record<PlayerId, number>, stats: GameStats) {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistedRecords = {
      version: 1,
      exportedAt: new Date().toISOString(),
      scores,
      stats,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage quota errors
  }
}

function createInitialPlayers(existingScores?: Record<PlayerId, number>): Record<PlayerId, Player> {
  return {
    player: {
      id: 'player',
      name: '玩家',
      isAI: false,
      hand: [],
      discards: [],
      melds: [],
      score: existingScores?.player ?? INITIAL_SCORE,
      isDealer: true,
    },
    ai1: {
      id: 'ai1',
      name: '电脑1',
      isAI: true,
      hand: [],
      discards: [],
      melds: [],
      score: existingScores?.ai1 ?? INITIAL_SCORE,
      isDealer: false,
    },
    ai2: {
      id: 'ai2',
      name: '电脑2',
      isAI: true,
      hand: [],
      discards: [],
      melds: [],
      score: existingScores?.ai2 ?? INITIAL_SCORE,
      isDealer: false,
    },
    ai3: {
      id: 'ai3',
      name: '电脑3',
      isAI: true,
      hand: [],
      discards: [],
      melds: [],
      score: existingScores?.ai3 ?? INITIAL_SCORE,
      isDealer: false,
    },
  }
}

function loadInitialTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem('mahjong-theme')
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.classList.toggle('dark', saved === 'dark')
    return saved
  }
  document.documentElement.classList.add('dark')
  return 'dark'
}

export interface GameActions {
  initGame: () => void
  selectTile: (tileId: string) => void
  discardSelected: () => void
  discardTileById: (tileId: string) => void
  drawTile: (forPlayerId?: PlayerId) => void
  nextTurn: (fromPlayerId?: PlayerId) => void
  executeClaim: (action: ClaimAction) => void
  passClaim: () => void
  toggleTheme: () => void
  resetScores: () => void
  exportRecords: () => string
  importRecords: (jsonText: string) => { ok: boolean; message: string }
}

export type MahjongStore = GameState & GameActions

export const useGameStore = create<MahjongStore>((set, get) => {
  const finishRound = (params: {
    winnerId: PlayerId | null
    fromPlayerId: PlayerId | null
    isZimo: boolean
    isDraw: boolean
    winningTile: Tile | null
  }) => {
    clearAITimer()
    const state = get()
    const { winnerId, fromPlayerId, isZimo, isDraw, winningTile } = params

    const scoreChanges: Record<PlayerId, number> = {
      player: 0,
      ai1: 0,
      ai2: 0,
      ai3: 0,
    }

    let fanNames: string[] = []
    let totalFan = 0
    let winningHand: Tile[] = []
    let winningMelds: Meld[] = []

    if (!isDraw && winnerId) {
      const winner = state.players[winnerId]
      winningHand =
        !isZimo && winningTile
          ? sortTiles([...winner.hand, winningTile])
          : sortTiles(winner.hand)
      winningMelds = [...winner.melds]

      const evalRes = evaluateFans(winningHand, winningMelds, isZimo)
      fanNames = evalRes.fanNames
      totalFan = evalRes.totalFan

      const points = totalFan * BASE_POINTS

      if (isZimo) {
        for (const pid of TURN_ORDER) {
          if (pid === winnerId) {
            scoreChanges[pid] = points * 3
          } else {
            scoreChanges[pid] = -points
          }
        }
      } else if (fromPlayerId) {
        const cannonPoints = points * 2
        scoreChanges[winnerId] = cannonPoints
        scoreChanges[fromPlayerId] = -cannonPoints
      }
    }

    const updatedPlayers: Record<PlayerId, Player> = { ...state.players }
    for (const pid of TURN_ORDER) {
      updatedPlayers[pid] = {
        ...updatedPlayers[pid],
        score: updatedPlayers[pid].score + scoreChanges[pid],
      }
    }

    const winnerName = winnerId ? state.players[winnerId].name : null
    const fromPlayerName = fromPlayerId ? state.players[fromPlayerId].name : null

    const result: RoundResult = {
      winnerId,
      winnerName,
      fromPlayerId,
      fromPlayerName,
      isZimo,
      isDraw,
      fanNames,
      totalFan,
      scoreChanges,
      winningHand,
      winningMelds,
      winningTile,
    }

    const newRoundNum = state.stats.totalRounds + 1
    const summary = isDraw
      ? '荒牌流局'
      : isZimo
        ? `${winnerName} 自摸（${totalFan}番）`
        : `${winnerName} 胡 ${fromPlayerName}（${totalFan}番）`

    const newHistory = [
      {
        roundNumber: newRoundNum,
        timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
        summary,
        winnerId,
        isDraw,
        fanText: isDraw ? '流局' : `${fanNames.join(' · ')} (${totalFan}番)`,
        scoreChanges,
      },
      ...state.stats.history,
    ].slice(0, 50)

    const updatedStats: GameStats = {
      totalRounds: newRoundNum,
      playerWins: state.stats.playerWins + (winnerId === 'player' ? 1 : 0),
      playerZimo: state.stats.playerZimo + (winnerId === 'player' && isZimo ? 1 : 0),
      draws: state.stats.draws + (isDraw ? 1 : 0),
      highestFan:
        winnerId === 'player'
          ? Math.max(state.stats.highestFan, totalFan)
          : state.stats.highestFan,
      history: newHistory,
    }

    // 持久化保存四家积分与战绩至浏览器 localStorage
    savePersistedRecords(
      {
        player: updatedPlayers.player.score,
        ai1: updatedPlayers.ai1.score,
        ai2: updatedPlayers.ai2.score,
        ai3: updatedPlayers.ai3.score,
      },
      updatedStats
    )

    set({
      phase: 'roundEnd',
      players: updatedPlayers,
      availableClaims: [],
      roundResult: result,
      actionBanner: winnerId
        ? {
            text: isZimo ? '自摸！' : '胡！',
            playerId: winnerId,
            timestamp: Date.now(),
          }
        : {
            text: '流局',
            playerId: 'player',
            timestamp: Date.now(),
          },
      stats: updatedStats,
    })
  }

  const checkPlayerSelfActions = () => {
    const state = get()
    const player = state.players.player
    const actions: ClaimAction[] = []

    if (canHu(player.hand, player.melds)) {
      actions.push({
        type: 'hu',
        tiles: [],
        label: '自摸',
      })
    }

    const gangActions = getSelfGangActions(player.hand, player.melds)
    actions.push(...gangActions)

    const tips = calculateGameTips(player.hand, player.melds, state.players)
    set({
      availableClaims: actions,
      tips,
    })
  }

  const scheduleAITurn = (aiId: PlayerId) => {
    clearAITimer()
    aiTimer = setTimeout(() => {
      const state = get()
      if (state.phase !== 'playing' || state.currentTurn !== aiId) return

      const aiPlayer = state.players[aiId]

      if (canHu(aiPlayer.hand, aiPlayer.melds)) {
        finishRound({
          winnerId: aiId,
          fromPlayerId: null,
          isZimo: true,
          isDraw: false,
          winningTile: aiPlayer.hand[aiPlayer.hand.length - 1] ?? null,
        })
        return
      }

      const selfGangs = getSelfGangActions(aiPlayer.hand, aiPlayer.melds)
      if (selfGangs.length > 0 && state.wall.length > 0) {
        const gangAct = selfGangs[0]
        if (gangAct.type === 'angang') {
          const removeIds = new Set(gangAct.tiles.map((t) => t.id))
          const newHand = sortTiles(aiPlayer.hand.filter((t) => !removeIds.has(t.id)))
          const newMeld: Meld = {
            type: 'angang',
            tiles: gangAct.tiles,
          }
          set({
            players: {
              ...state.players,
              [aiId]: {
                ...aiPlayer,
                hand: newHand,
                melds: [...aiPlayer.melds, newMeld],
              },
            },
            actionBanner: { text: '暗杠', playerId: aiId, timestamp: Date.now() },
          })
          get().drawTile(aiId)
          return
        }
      }

      const tileToDiscard = chooseAIDiscard(aiPlayer, state.players)
      performDiscard(aiId, tileToDiscard.id)
    }, 560)
  }

  const performDiscard = (playerId: PlayerId, tileId: string) => {
    clearAITimer()
    const state = get()
    const actor = state.players[playerId]
    const tileIndex = actor.hand.findIndex((t) => t.id === tileId)
    if (tileIndex === -1) return

    const discardedTile = actor.hand[tileIndex]
    const updatedHand = sortTiles([
      ...actor.hand.slice(0, tileIndex),
      ...actor.hand.slice(tileIndex + 1),
    ])

    const updatedPlayers: Record<PlayerId, Player> = {
      ...state.players,
      [playerId]: {
        ...actor,
        hand: updatedHand,
        discards: [...actor.discards, discardedTile],
      },
    }

    const updatedTips = calculateGameTips(
      updatedPlayers.player.hand,
      updatedPlayers.player.melds,
      updatedPlayers
    )

    set({
      players: updatedPlayers,
      selectedTileId: null,
      lastDrawnTileId: null,
      lastDiscardedTile: discardedTile,
      lastDiscardedBy: playerId,
      availableClaims: [],
      tips: updatedTips,
    })

    if (playerId !== 'player') {
      const human = updatedPlayers.player
      const claims: ClaimAction[] = []

      if (canHu(human.hand, human.melds, discardedTile)) {
        claims.push({
          type: 'hu',
          tiles: [],
          targetTile: discardedTile,
          label: '胡',
        })
      }

      const mingGangTiles = canMingGang(human.hand, discardedTile)
      if (mingGangTiles && state.wall.length > 0) {
        claims.push({
          type: 'minggang',
          tiles: mingGangTiles,
          targetTile: discardedTile,
          label: '杠',
        })
      }

      const pengTiles = canPeng(human.hand, discardedTile)
      if (pengTiles) {
        claims.push({
          type: 'peng',
          tiles: pengTiles,
          targetTile: discardedTile,
          label: '碰',
        })
      }

      if (isUpperPlayer(playerId, 'player')) {
        const chiCombos = getChiOptions(human.hand, discardedTile)
        for (const combo of chiCombos) {
          claims.push({
            type: 'chi',
            tiles: combo,
            targetTile: discardedTile,
            label:
              chiCombos.length > 1
                ? `吃${combo[0].value}${combo[1].value}`
                : '吃',
          })
        }
      }

      if (claims.length > 0) {
        set({
          phase: 'claiming',
          availableClaims: claims,
        })
        return
      }
    }

    if (handleAIClaimsOnDiscard(playerId, discardedTile)) {
      return
    }

    get().nextTurn(playerId)
  }

  const handleAIClaimsOnDiscard = (discarderId: PlayerId, discardedTile: Tile): boolean => {
    const state = get()

    let checkId = getNextPlayerId(discarderId)
    while (checkId !== discarderId) {
      if (checkId !== 'player') {
        const ai = state.players[checkId]
        if (canHu(ai.hand, ai.melds, discardedTile)) {
          finishRound({
            winnerId: checkId,
            fromPlayerId: discarderId,
            isZimo: false,
            isDraw: false,
            winningTile: discardedTile,
          })
          return true
        }
      }
      checkId = getNextPlayerId(checkId)
    }

    checkId = getNextPlayerId(discarderId)
    while (checkId !== discarderId) {
      if (checkId !== 'player') {
        const ai = state.players[checkId]
        const decision = shouldAIPengOrGang(ai, discardedTile)
        if (decision.action === 'minggang' && state.wall.length > 0) {
          executeAIClaim(checkId, discarderId, 'minggang', decision.tiles, discardedTile)
          return true
        }
        if (decision.action === 'peng') {
          executeAIClaim(checkId, discarderId, 'peng', decision.tiles, discardedTile)
          return true
        }
      }
      checkId = getNextPlayerId(checkId)
    }

    return false
  }

  const executeAIClaim = (
    aiId: PlayerId,
    fromId: PlayerId,
    type: 'peng' | 'minggang',
    handTiles: Tile[],
    targetTile: Tile
  ) => {
    clearAITimer()
    const state = get()
    const ai = state.players[aiId]
    const fromPlayer = state.players[fromId]

    const removeIds = new Set(handTiles.map((t) => t.id))
    const newHand = sortTiles(ai.hand.filter((t) => !removeIds.has(t.id)))
    const newFromDiscards = fromPlayer.discards.filter((t) => t.id !== targetTile.id)

    const newMeld: Meld = {
      type,
      tiles: sortTiles([...handTiles, targetTile]),
      fromPlayer: fromId,
    }

    const updatedPlayers: Record<PlayerId, Player> = {
      ...state.players,
      [fromId]: {
        ...fromPlayer,
        discards: newFromDiscards,
      },
      [aiId]: {
        ...ai,
        hand: newHand,
        melds: [...ai.melds, newMeld],
      },
    }

    set({
      phase: 'playing',
      currentTurn: aiId,
      players: updatedPlayers,
      lastDiscardedTile: null,
      lastDiscardedBy: null,
      actionBanner: {
        text: type === 'minggang' ? '杠！' : '碰！',
        playerId: aiId,
        timestamp: Date.now(),
      },
      tips: calculateGameTips(
        updatedPlayers.player.hand,
        updatedPlayers.player.melds,
        updatedPlayers
      ),
    })

    if (type === 'minggang') {
      get().drawTile(aiId)
    } else {
      scheduleAITurn(aiId)
    }
  }

  const persisted = loadPersistedRecords()
  const initialPlayers = createInitialPlayers(persisted.scores)

  return {
    phase: 'idle',
    roundNumber: persisted.stats.totalRounds,
    wall: [],
    players: initialPlayers,
    turnOrder: TURN_ORDER,
    currentTurn: 'player',
    selectedTileId: null,
    lastDrawnTileId: null,
    lastDiscardedTile: null,
    lastDiscardedBy: null,
    availableClaims: [],
    actionBanner: null,
    tips: {
      isTing: false,
      waits: [],
      discardHints: {},
      fanHints: [],
    },
    roundResult: null,
    stats: persisted.stats,
    theme: loadInitialTheme(),

    initGame: () => {
      clearAITimer()
      const state = get()
      const existingScores: Record<PlayerId, number> = {
        player: state.players.player.score,
        ai1: state.players.ai1.score,
        ai2: state.players.ai2.score,
        ai3: state.players.ai3.score,
      }

      const deck = shuffle(createFullDeck())
      const players = createInitialPlayers(existingScores)

      const playerTiles = sortTiles(deck.slice(0, 14))
      const ai1Tiles = sortTiles(deck.slice(14, 27))
      const ai2Tiles = sortTiles(deck.slice(27, 40))
      const ai3Tiles = sortTiles(deck.slice(40, 53))
      const remainingWall = deck.slice(53)

      players.player.hand = playerTiles
      players.ai1.hand = ai1Tiles
      players.ai2.hand = ai2Tiles
      players.ai3.hand = ai3Tiles

      const lastDealt = playerTiles[playerTiles.length - 1]
      const tips = calculateGameTips(players.player.hand, players.player.melds, players)

      set({
        phase: 'playing',
        roundNumber: state.stats.totalRounds + 1,
        wall: remainingWall,
        players,
        currentTurn: 'player',
        selectedTileId: null,
        lastDrawnTileId: lastDealt?.id ?? null,
        lastDiscardedTile: null,
        lastDiscardedBy: null,
        availableClaims: [],
        actionBanner: null,
        roundResult: null,
        tips,
      })

      checkPlayerSelfActions()
    },

    selectTile: (tileId: string) => {
      const state = get()
      if (state.phase !== 'playing') return
      const nextSelected = state.selectedTileId === tileId ? null : tileId
      set({ selectedTileId: nextSelected })
    },

    discardSelected: () => {
      const state = get()
      if (
        state.phase !== 'playing' ||
        state.currentTurn !== 'player' ||
        !state.selectedTileId
      ) {
        return
      }
      performDiscard('player', state.selectedTileId)
    },

    discardTileById: (tileId: string) => {
      const state = get()
      if (state.phase !== 'playing' || state.currentTurn !== 'player') return
      performDiscard('player', tileId)
    },

    drawTile: (forPlayerId?: PlayerId) => {
      const state = get()
      const targetId = forPlayerId ?? state.currentTurn

      if (state.wall.length === 0) {
        finishRound({
          winnerId: null,
          fromPlayerId: null,
          isZimo: false,
          isDraw: true,
          winningTile: null,
        })
        return
      }

      const [drawn, ...restWall] = state.wall
      const targetPlayer = state.players[targetId]

      const newHand =
        targetId === 'player'
          ? [...sortTiles(targetPlayer.hand), drawn]
          : sortTiles([...targetPlayer.hand, drawn])

      const updatedPlayers: Record<PlayerId, Player> = {
        ...state.players,
        [targetId]: {
          ...targetPlayer,
          hand: newHand,
        },
      }

      set({
        wall: restWall,
        currentTurn: targetId,
        players: updatedPlayers,
        lastDrawnTileId: targetId === 'player' ? drawn.id : null,
      })

      if (targetId === 'player') {
        checkPlayerSelfActions()
      } else {
        scheduleAITurn(targetId)
      }
    },

    nextTurn: (fromPlayerId?: PlayerId) => {
      const state = get()
      if (state.phase !== 'playing') return
      const baseId = fromPlayerId ?? state.currentTurn
      const nextId = getNextPlayerId(baseId)
      get().drawTile(nextId)
    },

    executeClaim: (action: ClaimAction) => {
      clearAITimer()
      const state = get()
      const player = state.players.player

      if (action.type === 'hu') {
        const isZimo = state.phase === 'playing' && state.currentTurn === 'player'
        finishRound({
          winnerId: 'player',
          fromPlayerId: isZimo ? null : state.lastDiscardedBy,
          isZimo,
          isDraw: false,
          winningTile: isZimo
            ? (player.hand.find((t) => t.id === state.lastDrawnTileId) ??
              player.hand[player.hand.length - 1] ??
              null)
            : state.lastDiscardedTile,
        })
        return
      }

      if (state.phase === 'playing' && state.currentTurn === 'player') {
        if (action.type === 'angang') {
          const removeIds = new Set(action.tiles.map((t) => t.id))
          const newHand = sortTiles(player.hand.filter((t) => !removeIds.has(t.id)))
          const newMeld: Meld = {
            type: 'angang',
            tiles: action.tiles,
          }
          const updatedPlayers: Record<PlayerId, Player> = {
            ...state.players,
            player: {
              ...player,
              hand: newHand,
              melds: [...player.melds, newMeld],
            },
          }
          set({
            players: updatedPlayers,
            availableClaims: [],
            selectedTileId: null,
            actionBanner: { text: '暗杠！', playerId: 'player', timestamp: Date.now() },
          })
          get().drawTile('player')
          return
        }

        if (action.type === 'minggang' && action.targetTile) {
          const addedTile = action.targetTile
          const newHand = sortTiles(player.hand.filter((t) => t.id !== addedTile.id))
          const newMelds = player.melds.map((m) => {
            if (
              m.type === 'peng' &&
              m.tiles[0]?.suit === addedTile.suit &&
              m.tiles[0]?.value === addedTile.value
            ) {
              return {
                ...m,
                type: 'minggang' as const,
                tiles: [...m.tiles, addedTile],
              }
            }
            return m
          })
          const updatedPlayers: Record<PlayerId, Player> = {
            ...state.players,
            player: {
              ...player,
              hand: newHand,
              melds: newMelds,
            },
          }
          set({
            players: updatedPlayers,
            availableClaims: [],
            selectedTileId: null,
            actionBanner: { text: '加杠！', playerId: 'player', timestamp: Date.now() },
          })
          get().drawTile('player')
          return
        }
      }

      const discardedTile = state.lastDiscardedTile
      const fromId = state.lastDiscardedBy
      if (!discardedTile || !fromId) return

      const fromPlayer = state.players[fromId]
      const removeIds = new Set(action.tiles.map((t) => t.id))
      const newHand = sortTiles(player.hand.filter((t) => !removeIds.has(t.id)))
      const newFromDiscards = fromPlayer.discards.filter((t) => t.id !== discardedTile.id)

      const meldType =
        action.type === 'chi'
          ? 'chi'
          : action.type === 'peng'
            ? 'peng'
            : 'minggang'

      const newMeld: Meld = {
        type: meldType,
        tiles: sortTiles([...action.tiles, discardedTile]),
        fromPlayer: fromId,
      }

      const updatedPlayers: Record<PlayerId, Player> = {
        ...state.players,
        [fromId]: {
          ...fromPlayer,
          discards: newFromDiscards,
        },
        player: {
          ...player,
          hand: newHand,
          melds: [...player.melds, newMeld],
        },
      }

      const bannerLabel =
        meldType === 'chi' ? '吃！' : meldType === 'peng' ? '碰！' : '杠！'

      const tips = calculateGameTips(
        updatedPlayers.player.hand,
        updatedPlayers.player.melds,
        updatedPlayers
      )

      set({
        phase: 'playing',
        currentTurn: 'player',
        players: updatedPlayers,
        selectedTileId: null,
        lastDrawnTileId: null,
        lastDiscardedTile: null,
        lastDiscardedBy: null,
        availableClaims: [],
        actionBanner: { text: bannerLabel, playerId: 'player', timestamp: Date.now() },
        tips,
      })

      if (meldType === 'minggang') {
        get().drawTile('player')
      }
    },

    passClaim: () => {
      const state = get()

      if (state.phase === 'playing' && state.currentTurn === 'player') {
        set({ availableClaims: [] })
        return
      }

      if (state.phase !== 'claiming') return

      const discarderId = state.lastDiscardedBy
      const discardedTile = state.lastDiscardedTile

      set({
        phase: 'playing',
        availableClaims: [],
      })

      if (discarderId && discardedTile) {
        if (handleAIClaimsOnDiscard(discarderId, discardedTile)) {
          return
        }
        get().nextTurn(discarderId)
      }
    },

    toggleTheme: () => {
      const state = get()
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark'
      if (typeof window !== 'undefined') {
        localStorage.setItem('mahjong-theme', nextTheme)
        document.documentElement.classList.toggle('dark', nextTheme === 'dark')
      }
      set({ theme: nextTheme })
    },

    resetScores: () => {
      const state = get()
      const resetScoresMap: Record<PlayerId, number> = {
        player: INITIAL_SCORE,
        ai1: INITIAL_SCORE,
        ai2: INITIAL_SCORE,
        ai3: INITIAL_SCORE,
      }
      const updated: Record<PlayerId, Player> = { ...state.players }
      for (const pid of TURN_ORDER) {
        updated[pid] = {
          ...updated[pid],
          score: INITIAL_SCORE,
        }
      }
      const emptyStats = createEmptyStats()
      savePersistedRecords(resetScoresMap, emptyStats)
      set({
        players: updated,
        roundNumber: 1,
        stats: emptyStats,
      })
    },

    exportRecords: () => {
      const state = get()
      const payload: PersistedRecords = {
        version: 1,
        exportedAt: new Date().toISOString(),
        scores: {
          player: state.players.player.score,
          ai1: state.players.ai1.score,
          ai2: state.players.ai2.score,
          ai3: state.players.ai3.score,
        },
        stats: state.stats,
      }
      return JSON.stringify(payload, null, 2)
    },

    importRecords: (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText) as Partial<PersistedRecords>
        if (!parsed || typeof parsed !== 'object' || !parsed.scores || !parsed.stats) {
          return { ok: false, message: '战绩文件格式无效，缺少 scores 或 stats 字段' }
        }
        const s = parsed.scores
        const st = parsed.stats
        const newScores: Record<PlayerId, number> = {
          player: typeof s.player === 'number' ? s.player : INITIAL_SCORE,
          ai1: typeof s.ai1 === 'number' ? s.ai1 : INITIAL_SCORE,
          ai2: typeof s.ai2 === 'number' ? s.ai2 : INITIAL_SCORE,
          ai3: typeof s.ai3 === 'number' ? s.ai3 : INITIAL_SCORE,
        }
        const newStats: GameStats = {
          totalRounds: typeof st.totalRounds === 'number' ? st.totalRounds : 0,
          playerWins: typeof st.playerWins === 'number' ? st.playerWins : 0,
          playerZimo: typeof st.playerZimo === 'number' ? st.playerZimo : 0,
          draws: typeof st.draws === 'number' ? st.draws : 0,
          highestFan: typeof st.highestFan === 'number' ? st.highestFan : 0,
          history: Array.isArray(st.history) ? st.history.slice(0, 50) : [],
        }

        savePersistedRecords(newScores, newStats)

        const state = get()
        const updatedPlayers: Record<PlayerId, Player> = { ...state.players }
        for (const pid of TURN_ORDER) {
          updatedPlayers[pid] = {
            ...updatedPlayers[pid],
            score: newScores[pid],
          }
        }

        set({
          players: updatedPlayers,
          stats: newStats,
          roundNumber: newStats.totalRounds + 1,
        })

        return {
          ok: true,
          message: `导入成功！已恢复 ${newStats.totalRounds} 局战绩记录。`,
        }
      } catch {
        return { ok: false, message: '解析 JSON 失败，请检查导入的文件内容' }
      }
    },
  }
})
