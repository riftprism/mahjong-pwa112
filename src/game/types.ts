export type TileSuit = 'wan' | 'tong' | 'tiao' | 'wind' | 'dragon'

export interface Tile {
  id: string
  suit: TileSuit
  value: number // wan/tong/tiao: 1-9, wind: 1(东),2(南),3(西),4(北), dragon: 1(中),2(发),3(白)
  name: string  // 一万~九万, 一筒~九筒, 一条~九条, 东/南/西/北, 中/发/白
}

export type MeldType = 'chi' | 'peng' | 'minggang' | 'angang'

export interface Meld {
  type: MeldType
  tiles: Tile[]
  fromPlayer?: PlayerId
}

export type PlayerId = 'player' | 'ai1' | 'ai2' | 'ai3'

export interface Player {
  id: PlayerId
  name: string
  isAI: boolean
  hand: Tile[]
  discards: Tile[]
  melds: Meld[]
  score: number
  isDealer: boolean
}

export type GamePhase = 'idle' | 'playing' | 'claiming' | 'roundEnd'

export interface ClaimAction {
  type: 'hu' | 'minggang' | 'angang' | 'peng' | 'chi'
  tiles: Tile[]
  targetTile?: Tile
  label: string
}

export interface TingWait {
  key: string
  suit: TileSuit
  value: number
  name: string
  remaining: number
  fanNames: string[]
  totalFan: number
}

export interface GameTips {
  isTing: boolean
  waits: TingWait[]
  /** When player has 14 tiles (turn to discard), maps tileKey -> waits after discarding that tile */
  discardHints: Record<string, TingWait[]>
  fanHints: string[]
}

export interface RoundResult {
  winnerId: PlayerId | null
  winnerName: string | null
  fromPlayerId: PlayerId | null
  fromPlayerName: string | null
  isZimo: boolean
  isDraw: boolean
  fanNames: string[]
  totalFan: number
  scoreChanges: Record<PlayerId, number>
  winningHand: Tile[]
  winningMelds: Meld[]
  winningTile: Tile | null
}

export interface RoundHistoryItem {
  roundNumber: number
  timestamp?: string
  summary: string
  winnerId: PlayerId | null
  isDraw: boolean
  fanText: string
  scoreChanges: Record<PlayerId, number>
}

export interface GameStats {
  totalRounds: number
  playerWins: number
  playerZimo: number
  draws: number
  highestFan: number
  history: RoundHistoryItem[]
}

export interface PersistedRecords {
  version: 1
  exportedAt: string
  scores: Record<PlayerId, number>
  stats: GameStats
}

export interface AndroidNativeBridge {
  saveRecords: (json: string) => void
  loadRecords: () => string
  exportRecordsFile: (json: string, suggestedName: string) => void
  openImportPicker: () => void
  vibrate: (type: string) => void
}

declare global {
  interface Window {
    AndroidBridge?: AndroidNativeBridge
    __onAndroidImportRecords?: (jsonText: string) => void
    __onAndroidExportSuccess?: (msg: string) => void
  }
}

export interface GameState {
  phase: GamePhase
  roundNumber: number
  wall: Tile[]
  players: Record<PlayerId, Player>
  turnOrder: PlayerId[]
  currentTurn: PlayerId
  selectedTileId: string | null
  lastDrawnTileId: string | null
  lastDiscardedTile: Tile | null
  lastDiscardedBy: PlayerId | null
  availableClaims: ClaimAction[]
  actionBanner: { text: string; playerId: PlayerId; timestamp: number } | null
  tips: GameTips
  roundResult: RoundResult | null
  stats: GameStats
  theme: 'dark' | 'light'
}
