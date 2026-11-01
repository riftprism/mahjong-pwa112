import { useEffect, useState } from 'react'
import { ResultModal } from './components/ResultModal'
import { ScoreModal } from './components/ScoreModal'
import { TileView } from './components/TileView'
import { getTileKey, parseTileKey } from './game/engine/deck'
import { useGameStore } from './game/state/store'
import type { Meld, PlayerId } from './game/types'

function MeldGroup({
  meld,
  selectedKey,
}: {
  meld: Meld
  selectedKey: string | null
}) {
  return (
    <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-white/5 border border-amber-400/30 shadow-md">
      {meld.tiles.map((tile, idx) => (
        <TileView
          key={tile.id}
          tile={tile}
          size="xs"
          faceDown={meld.type === 'angang' && idx > 0 && idx < 3}
          isSameAsSelected={
            Boolean(selectedKey) &&
            !(meld.type === 'angang' && idx > 0 && idx < 3) &&
            getTileKey(tile) === selectedKey
          }
        />
      ))}
    </div>
  )
}

const SEAT_META: Record<
  PlayerId,
  { wind: string; title: string; avatar: string; badgeBg: string }
> = {
  player: {
    wind: '东',
    title: '本家',
    avatar: '🀄',
    badgeBg: 'from-amber-400 to-orange-600',
  },
  ai1: {
    wind: '南',
    title: '下家',
    avatar: '🦊',
    badgeBg: 'from-sky-400 to-blue-600',
  },
  ai2: {
    wind: '西',
    title: '对家',
    avatar: '🐼',
    badgeBg: 'from-purple-400 to-indigo-600',
  },
  ai3: {
    wind: '北',
    title: '上家',
    avatar: '🐯',
    badgeBg: 'from-emerald-400 to-teal-600',
  },
}

export default function App() {
  const phase = useGameStore((s) => s.phase)
  const roundNumber = useGameStore((s) => s.roundNumber)
  const wall = useGameStore((s) => s.wall)
  const players = useGameStore((s) => s.players)
  const currentTurn = useGameStore((s) => s.currentTurn)
  const selectedTileId = useGameStore((s) => s.selectedTileId)
  const lastDrawnTileId = useGameStore((s) => s.lastDrawnTileId)
  const lastDiscardedTile = useGameStore((s) => s.lastDiscardedTile)
  const lastDiscardedBy = useGameStore((s) => s.lastDiscardedBy)
  const availableClaims = useGameStore((s) => s.availableClaims)
  const actionBanner = useGameStore((s) => s.actionBanner)
  const tips = useGameStore((s) => s.tips)
  const theme = useGameStore((s) => s.theme)

  const initGame = useGameStore((s) => s.initGame)
  const selectTile = useGameStore((s) => s.selectTile)
  const discardSelected = useGameStore((s) => s.discardSelected)
  const discardTileById = useGameStore((s) => s.discardTileById)
  const executeClaim = useGameStore((s) => s.executeClaim)
  const passClaim = useGameStore((s) => s.passClaim)
  const toggleTheme = useGameStore((s) => s.toggleTheme)

  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [dismissPortraitTip, setDismissPortraitTip] = useState(false)
  const [isPortrait, setIsPortrait] = useState(false)
  const [countdown, setCountdown] = useState(15)
  const [tingExpanded, setTingExpanded] = useState(true)

  useEffect(() => {
    if (phase === 'idle') {
      initGame()
    }
  }, [phase, initGame])

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 640)
    }
    checkOrientation()
    window.addEventListener('resize', checkOrientation)
    return () => window.removeEventListener('resize', checkOrientation)
  }, [])

  // 中央罗盘15秒倒计时器
  useEffect(() => {
    setCountdown(15)
    if (phase !== 'playing' && phase !== 'claiming') return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [currentTurn, phase, lastDiscardedTile?.id])

  const human = players.player
  const aiRight = players.ai1 // 下家 (南)
  const aiTop = players.ai2 // 对家 (西)
  const aiLeft = players.ai3 // 上家 (北)

  const isPlayerTurn = phase === 'playing' && currentTurn === 'player'
  const canDiscard = isPlayerTurn && Boolean(selectedTileId)

  const selectedTileObj = human.hand.find((t) => t.id === selectedTileId) ?? null
  const selectedTileKey = selectedTileObj ? getTileKey(selectedTileObj) : null

  const activeWaits =
    selectedTileKey && tips.discardHints[selectedTileKey]
      ? tips.discardHints[selectedTileKey]
      : tips.waits

  const flyPositionMap: Record<
    PlayerId,
    { posClass: string; animClass: string }
  > = {
    player: {
      posClass: 'bottom-24 left-1/2 -translate-x-1/2',
      animClass: 'animate-fly-bottom',
    },
    ai2: {
      posClass: 'top-14 left-1/2 -translate-x-1/2',
      animClass: 'animate-fly-top',
    },
    ai3: {
      posClass: 'left-24 top-1/2 -translate-y-1/2',
      animClass: 'animate-fly-left',
    },
    ai1: {
      posClass: 'right-24 top-1/2 -translate-y-1/2',
      animClass: 'animate-fly-right',
    },
  }

  const stampPositionMap: Record<PlayerId, string> = {
    player: 'bottom-24 left-1/2 -translate-x-1/2',
    ai2: 'top-14 left-1/2 -translate-x-1/2',
    ai3: 'left-24 top-1/2 -translate-y-1/2',
    ai1: 'right-24 top-1/2 -translate-y-1/2',
  }

  return (
    <div className="mahjong-table-felt safe-area-table relative w-full h-full flex flex-col justify-between overflow-hidden select-none text-slate-100">
      {/* 竖屏旋转提示层 */}
      {isPortrait && !dismissPortraitTip && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 text-white p-6 text-center backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-3xl mb-3 shadow-lg">
            📱↻
          </div>
          <h2 className="text-lg font-black text-amber-300 mb-1">建议横屏游玩</h2>
          <p className="text-xs text-slate-300 max-w-xs mb-5 leading-relaxed">
            本牌桌针对 iPhone 12 mini 横屏视野专门调校，旋转手机至横屏可获得最佳出牌体验。
          </p>
          <button
            type="button"
            onClick={() => setDismissPortraitTip(true)}
            className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 text-xs font-black shadow-lg cursor-pointer"
          >
            继续在当前方向体验
          </button>
        </div>
      )}

      {/* ==================== 顶部栏：左上房间胶囊 + 中央对家立牌席 + 右上战绩/新局胶囊 ==================== */}
      <header className="mini-compact-header relative z-20 flex items-center justify-between px-2 pt-0.5 pb-0.5 shrink-0">
        {/* 左上角：房间局数胶囊 */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/8 border border-white/15 text-[11px]">
          <span className="font-calligraphy font-black text-amber-300 text-xs">
            欢乐国粹场
          </span>
          <span className="text-white/30">|</span>
          <span className="text-emerald-300 font-bold">第{roundNumber || 1}局</span>
        </div>

        {/* 顶部正中：对家（西·电脑2）头像 + 13张立体翠绿暗立牌 + 副露 */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all ${
              currentTurn === 'ai2'
                ? 'bg-amber-500/25 border-amber-400 animate-pulse-glow'
                : 'bg-white/8 border-white/15'
            }`}
          >
            <div className="relative">
              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center text-[11px] shadow">
                {SEAT_META.ai2.avatar}
              </span>
              <span className="absolute -bottom-0.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black leading-tight">
                西
              </span>
            </div>
            <div className="flex items-center gap-1.5 pr-0.5">
              <span className="text-[11px] font-bold text-white">{aiTop.name}</span>
              <span className="text-[10px] font-mono font-extrabold text-amber-300">
                🫘{aiTop.score}
              </span>
            </div>
          </div>

          {/* 对家成排 3D 翠玉暗立牌 */}
          <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg bg-white/5">
            {Array.from({ length: aiTop.hand.length }).map((_, i) => (
              <div
                key={i}
                className="tile-3d-back w-2.5 h-4.5 rounded-[2px] border border-emerald-200/40"
              />
            ))}
          </div>

          {/* 对家副露 */}
          {aiTop.melds.length > 0 && (
            <div className="flex items-center gap-1">
              {aiTop.melds.map((m, i) => (
                <MeldGroup key={i} meld={m} selectedKey={selectedTileKey} />
              ))}
            </div>
          )}
        </div>

        {/* 右上角：战绩榜（含导入导出）、深浅色、新局 */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScoreModalOpen(true)}
            className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-400/35 cursor-pointer transition"
          >
            🏆 战绩/存取
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title="切换主题"
            className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/15 cursor-pointer transition"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            onClick={initGame}
            className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-slate-950 shadow cursor-pointer active:scale-95 transition"
          >
            🔄 新局
          </button>
        </div>
      </header>

      {/* ==================== 中部全屏环绕主牌桌（左席 + 中央天元罗盘与四方牌河 + 右席） ==================== */}
      <main className="relative z-10 flex-1 min-h-0 flex items-center justify-between px-1 sm:px-3 overflow-hidden">
        {/* 左侧席位：上家（北·电脑3） */}
        <aside className="flex items-center gap-1 shrink-0 z-10">
          <div
            className={`flex flex-col items-center p-1 sm:p-1.5 rounded-2xl border transition-all w-13 sm:w-15 ${
              currentTurn === 'ai3'
                ? 'bg-amber-500/25 border-amber-400 animate-pulse-glow'
                : 'bg-white/8 border-white/15'
            }`}
          >
            <div className="relative mb-0.5">
              <span className="w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs shadow-md">
                {SEAT_META.ai3.avatar}
              </span>
              <span className="absolute -bottom-0.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black">
                北
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-white truncate max-w-full">
              {aiLeft.name}
            </span>
            <span className="text-[10px] font-mono font-extrabold text-amber-300">
              🫘{aiLeft.score}
            </span>
            <span className="text-[9px] text-emerald-300 font-bold">
              {aiLeft.hand.length}张
            </span>
          </div>

          {/* 上家纵向立体侧面牌墙 */}
          <div className="flex flex-col gap-0.5 py-1 px-0.5 rounded-lg bg-white/5">
            {Array.from({ length: Math.min(aiLeft.hand.length, 13) }).map((_, i) => (
              <div
                key={i}
                className="tile-3d-side w-3 h-1.5 sm:w-3.5 sm:h-2 rounded-[2px] border border-white/30"
              />
            ))}
          </div>

          {aiLeft.melds.length > 0 && (
            <div className="flex flex-col gap-1">
              {aiLeft.melds.map((m, idx) => (
                <MeldGroup key={idx} meld={m} selectedKey={selectedTileKey} />
              ))}
            </div>
          )}
        </aside>

        {/* ==================== 牌桌正中心：四方环绕牌河 + 发光电控罗盘 ==================== */}
        <section className="relative flex-1 h-full flex items-center justify-center overflow-hidden">
          <div className="relative grid grid-cols-[minmax(80px,1fr)_auto_minmax(80px,1fr)] grid-rows-[minmax(34px,auto)_auto_minmax(34px,auto)] items-center justify-items-center gap-1 sm:gap-2 max-w-2xl w-full">
            {/* 【上方牌河】对家（西·电脑2）弃牌 */}
            <div className="col-start-2 row-start-1 flex flex-wrap justify-center gap-0.5 max-w-[165px] sm:max-w-[215px] min-h-[32px] p-0.5 rounded-lg bg-white/5 border border-white/10">
              {aiTop.discards.map((t) => (
                <TileView
                  key={t.id}
                  tile={t}
                  size="river"
                  isLastDiscard={lastDiscardedTile?.id === t.id}
                  isSameAsSelected={
                    Boolean(selectedTileKey) && getTileKey(t) === selectedTileKey
                  }
                />
              ))}
            </div>

            {/* 【左侧牌河】上家（北·电脑3）弃牌 */}
            <div className="col-start-1 row-start-2 justify-self-end flex flex-wrap justify-end content-center gap-0.5 max-w-[130px] sm:max-w-[165px] min-h-[44px] p-0.5 rounded-lg bg-white/5 border border-white/10">
              {aiLeft.discards.map((t) => (
                <TileView
                  key={t.id}
                  tile={t}
                  size="river"
                  isLastDiscard={lastDiscardedTile?.id === t.id}
                  isSameAsSelected={
                    Boolean(selectedTileKey) && getTileKey(t) === selectedTileKey
                  }
                />
              ))}
            </div>

            {/* 【正中心】腾讯《欢乐麻将》风格电控天元风向计时盘 */}
            <div className="mini-compact-compass col-start-2 row-start-2 relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-500/65 shadow-[0_0_24px_rgba(245,158,11,0.22),inset_0_0_14px_rgba(245,158,11,0.18)] flex flex-col items-center justify-center">
              {/* 上方（对家·西） */}
              <div
                className={`absolute top-0.5 left-1/2 -translate-x-1/2 px-2 py-0 rounded-b text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'ai2'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                西
              </div>
              {/* 下方（本家·东） */}
              <div
                className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 px-2 py-0 rounded-t text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'player'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                东
              </div>
              {/* 左方（上家·北） */}
              <div
                className={`absolute left-0.5 top-1/2 -translate-y-1/2 px-0.5 py-1 rounded-r text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'ai3'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                北
              </div>
              {/* 右方（下家·南） */}
              <div
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 px-0.5 py-1 rounded-l text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'ai1'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                南
              </div>

              {/* 中心数显倒计时 + 剩余牌数 */}
              <div className="flex flex-col items-center justify-center leading-none">
                <span className="text-base sm:text-xl font-mono font-black text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                  {String(countdown).padStart(2, '0')}
                </span>
                <span className="mt-0.5 px-1.5 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/30 text-[9px] font-bold text-emerald-300">
                  余{wall.length}
                </span>
              </div>
            </div>

            {/* 【右侧牌河】下家（南·电脑1）弃牌 */}
            <div className="col-start-3 row-start-2 justify-self-start flex flex-wrap justify-start content-center gap-0.5 max-w-[130px] sm:max-w-[165px] min-h-[44px] p-0.5 rounded-lg bg-white/5 border border-white/10">
              {aiRight.discards.map((t) => (
                <TileView
                  key={t.id}
                  tile={t}
                  size="river"
                  isLastDiscard={lastDiscardedTile?.id === t.id}
                  isSameAsSelected={
                    Boolean(selectedTileKey) && getTileKey(t) === selectedTileKey
                  }
                />
              ))}
            </div>

            {/* 【下方牌河】本家（东·玩家）弃牌 */}
            <div className="col-start-2 row-start-3 flex flex-wrap justify-center gap-0.5 max-w-[165px] sm:max-w-[215px] min-h-[32px] p-0.5 rounded-lg bg-white/8 border border-amber-400/25">
              {human.discards.map((t) => (
                <TileView
                  key={t.id}
                  tile={t}
                  size="river"
                  isLastDiscard={lastDiscardedTile?.id === t.id}
                  isSameAsSelected={
                    Boolean(selectedTileKey) && getTileKey(t) === selectedTileKey
                  }
                />
              ))}
            </div>
          </div>
        </section>

        {/* 右侧席位：下家（南·电脑1） */}
        <aside className="flex items-center gap-1 shrink-0 z-10">
          {aiRight.melds.length > 0 && (
            <div className="flex flex-col gap-1">
              {aiRight.melds.map((m, idx) => (
                <MeldGroup key={idx} meld={m} selectedKey={selectedTileKey} />
              ))}
            </div>
          )}

          {/* 下家纵向立体侧面牌墙 */}
          <div className="flex flex-col gap-0.5 py-1 px-0.5 rounded-lg bg-white/5">
            {Array.from({ length: Math.min(aiRight.hand.length, 13) }).map((_, i) => (
              <div
                key={i}
                className="tile-3d-side w-3 h-1.5 sm:w-3.5 sm:h-2 rounded-[2px] border border-white/30"
              />
            ))}
          </div>

          <div
            className={`flex flex-col items-center p-1 sm:p-1.5 rounded-2xl border transition-all w-13 sm:w-15 ${
              currentTurn === 'ai1'
                ? 'bg-amber-500/25 border-amber-400 animate-pulse-glow'
                : 'bg-white/8 border-white/15'
            }`}
          >
            <div className="relative mb-0.5">
              <span className="w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs shadow-md">
                {SEAT_META.ai1.avatar}
              </span>
              <span className="absolute -bottom-0.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black">
                南
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-white truncate max-w-full">
              {aiRight.name}
            </span>
            <span className="text-[10px] font-mono font-extrabold text-amber-300">
              🫘{aiRight.score}
            </span>
            <span className="text-[9px] text-emerald-300 font-bold">
              {aiRight.hand.length}张
            </span>
          </div>
        </aside>
      </main>

      {/* ==================== 出牌飞出放大特写残影 ==================== */}
      {lastDiscardedTile && lastDiscardedBy && (
        <div
          key={lastDiscardedTile.id}
          className={`pointer-events-none fixed z-30 ${flyPositionMap[lastDiscardedBy].posClass} ${flyPositionMap[lastDiscardedBy].animClass}`}
        >
          <div className="relative p-1 rounded-xl bg-gradient-to-b from-amber-300/90 to-amber-600/90 shadow-[0_0_24px_rgba(251,191,36,0.9)] ring-2 ring-white">
            <TileView tile={lastDiscardedTile} size="sm" />
          </div>
        </div>
      )}

      {/* ==================== 吃/碰/杠/胡 书法火焰大字特效 ==================== */}
      {actionBanner && Date.now() - actionBanner.timestamp < 2200 && (
        <div
          key={actionBanner.timestamp}
          className={`pointer-events-none fixed z-40 ${stampPositionMap[actionBanner.playerId]}`}
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute w-20 h-20 rounded-full border-4 border-amber-300 animate-shockwave" />
            <div className="animate-action-stamp px-5 py-1.5 rounded-full bg-gradient-to-b from-red-600 via-rose-600 to-amber-600 border-2 border-amber-200 shadow-[0_0_35px_rgba(251,191,36,0.95)]">
              <span className="font-calligraphy font-black text-xl sm:text-3xl text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {actionBanner.text}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 手牌正上方操作区：出牌 + 吃 / 碰 / 杠 / 胡 / 过 + 听牌提示 ==================== */}
      <div className="mini-compact-actions relative z-30 flex items-center justify-center px-2 min-h-[40px] sm:min-h-[48px] pointer-events-none shrink-0">
        {/* 左侧：灯泡💡听牌提示悬浮窗 */}
        {(activeWaits.length > 0 || tips.fanHints.length > 0) && (
          <div className="pointer-events-auto absolute left-2 bottom-0.5 flex items-center gap-1.5 max-w-[44vw]">
            <button
              type="button"
              onClick={() => setTingExpanded((v) => !v)}
              className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border-2 border-white shadow-[0_4px_12px_rgba(245,158,11,0.7)] flex flex-col items-center justify-center shrink-0 cursor-pointer active:scale-95"
              title="展开/收起听牌提示"
            >
              <span className="text-[10px] leading-none">💡</span>
              <span className="text-[8px] font-black text-slate-950 leading-none">听</span>
            </button>

            {tingExpanded && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-2xl bg-slate-950/92 border border-amber-400/50 shadow-xl overflow-x-auto no-scrollbar">
                {activeWaits.length > 0 ? (
                  <>
                    <div className="text-[9px] font-black text-amber-300 shrink-0 pr-1 border-r border-white/15 leading-tight">
                      <div>听牌</div>
                      <div className="text-[8px] text-emerald-300 font-bold">
                        {activeWaits.reduce((s, w) => s + w.remaining, 0)}张
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {activeWaits.map((w) => {
                        const parsed = parseTileKey(w.key)
                        return (
                          <div
                            key={w.key}
                            className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-white/10 border border-amber-400/25 shrink-0"
                          >
                            <TileView
                              tile={{
                                id: `wait-${w.key}`,
                                suit: parsed.suit,
                                value: parsed.value,
                                name: parsed.name,
                              }}
                              size="xs"
                            />
                            <div className="leading-tight">
                              <div className="text-[9px] font-black text-amber-300">
                                {w.totalFan}番
                              </div>
                              <div className="text-[8px] font-bold text-emerald-300">
                                {w.remaining}张
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-emerald-300 whitespace-nowrap">
                    {tips.fanHints.join(' · ')}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* 牌型正上方：吃 / 碰 / 杠 / 胡 / 过 与 出牌 按钮 */}
        <div className="pointer-events-auto flex items-center justify-center gap-2 sm:gap-3 ml-auto mr-auto">
          {availableClaims.map((claim, idx) => {
            const isHu = claim.type === 'hu'
            const colorStyle = isHu
              ? 'w-11 h-11 sm:w-13 sm:h-13 bg-gradient-to-b from-red-500 via-rose-600 to-amber-600 ring-2 ring-amber-300 shadow-[0_0_20px_rgba(244,63,94,0.95)] animate-pulse-glow text-sm sm:text-lg'
              : claim.type === 'minggang' || claim.type === 'angang'
                ? 'w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-b from-purple-400 via-indigo-600 to-indigo-800 ring-2 ring-amber-300 shadow-[0_4px_14px_rgba(99,102,241,0.75)] text-xs sm:text-base'
                : claim.type === 'peng'
                  ? 'w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-b from-amber-300 via-amber-500 to-orange-600 ring-2 ring-white shadow-[0_4px_14px_rgba(245,158,11,0.75)] text-slate-950 text-xs sm:text-base'
                  : 'w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-b from-emerald-400 via-teal-600 to-emerald-800 ring-2 ring-amber-200 shadow-[0_4px_14px_rgba(16,185,129,0.75)] text-xs sm:text-base'

            return (
              <button
                key={idx}
                type="button"
                onClick={() => executeClaim(claim)}
                className={`rounded-full flex flex-col items-center justify-center font-calligraphy font-black text-white cursor-pointer active:scale-92 transition animate-action-stamp ${colorStyle}`}
              >
                <span>{claim.label}</span>
              </button>
            )
          })}

          {availableClaims.length > 0 && (
            <button
              type="button"
              onClick={passClaim}
              className="w-8.5 h-8.5 sm:w-10 sm:h-10 rounded-full bg-gradient-to-b from-slate-600 to-slate-800 border-2 border-slate-400 text-white font-bold text-xs shadow-lg cursor-pointer active:scale-92 transition"
            >
              过
            </button>
          )}

          {isPlayerTurn && (
            <button
              type="button"
              disabled={!canDiscard}
              onClick={discardSelected}
              className={`px-4 sm:px-6 h-9 sm:h-10 rounded-full font-calligraphy font-black text-xs sm:text-base tracking-wider transition-all flex items-center gap-1.5 ${
                canDiscard
                  ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-slate-950 shadow-[0_4px_16px_rgba(245,158,11,0.8)] ring-2 ring-white cursor-pointer active:scale-95'
                  : 'bg-white/10 text-amber-200/60 border border-amber-400/25 cursor-not-allowed'
              }`}
            >
              <span>
                {canDiscard ? `出牌 (${selectedTileObj?.name ?? ''})` : '请选择手牌出牌'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== 底部：本家（东·玩家）头像豆子 + 副露区 + 14张大立体手牌 ==================== */}
      <footer className="relative z-20 px-1.5 sm:px-3 pt-0.5 pb-1 shrink-0">
        <div className="flex items-end justify-between gap-1.5 sm:gap-2">
          {/* 左下角：本家头像欢乐豆 + 吃碰杠副露牌架 */}
          <div className="flex items-end gap-1.5 shrink-0">
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-xl border transition-all ${
                isPlayerTurn
                  ? 'bg-amber-500/25 border-amber-400 animate-pulse-glow'
                  : 'bg-white/10 border-white/15'
              }`}
            >
              <div className="relative">
                <span className="w-6.5 h-6.5 sm:w-7.5 sm:h-7.5 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-xs shadow">
                  {SEAT_META.player.avatar}
                </span>
                <span className="absolute -bottom-0.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black">
                  东庄
                </span>
              </div>
              <div className="leading-tight">
                <div className="text-[11px] font-black text-white">{human.name}</div>
                <div className="text-[10px] font-mono font-extrabold text-amber-300">
                  🫘{human.score}
                </div>
              </div>
            </div>

            {human.melds.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[145px] sm:max-w-[240px] pb-0.5">
                {human.melds.map((m, i) => (
                  <MeldGroup key={i} meld={m} selectedKey={selectedTileKey} />
                ))}
              </div>
            )}
          </div>

          {/* 底部中央：本家 13/14 张 3D 手牌（针对 iPhone 12 mini 横屏宽度精确调校） */}
          <div className="mini-compact-hand flex-1 min-w-0 flex items-center justify-center overflow-x-auto no-scrollbar pt-2.5 pb-0.5 px-0.5">
            <div className="flex items-end gap-[3px] sm:gap-1">
              {human.hand.map((tile) => {
                const isSelected = selectedTileId === tile.id
                const isNewlyDrawn = lastDrawnTileId === tile.id
                const canTingIfDiscarded = Boolean(tips.discardHints[getTileKey(tile)])

                return (
                  <TileView
                    key={tile.id}
                    tile={tile}
                    size="md"
                    selected={isSelected}
                    isNewlyDrawn={isNewlyDrawn}
                    canTingIfDiscarded={canTingIfDiscarded}
                    onClick={() => {
                      if (isSelected && isPlayerTurn) {
                        discardTileById(tile.id)
                      } else {
                        selectTile(tile.id)
                      }
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </footer>

      {/* 结算与战绩存取弹窗 */}
      <ResultModal />
      <ScoreModal open={scoreModalOpen} onClose={() => setScoreModalOpen(false)} />
    </div>
  )
}
