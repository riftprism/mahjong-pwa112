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
    <div className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-white/5 border border-amber-400/30 shadow-md shrink-0">
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
  const [isPortraitViewport, setIsPortraitViewport] = useState(false)
  // 当检测到手机处于竖屏时，默认自动开启浏览器内 90° 横屏旋转；也可手动点击顶部「📱旋转」切换
  const [autoRotateInPortrait, setAutoRotateInPortrait] = useState(true)
  const [countdown, setCountdown] = useState(15)
  const [tingExpanded, setTingExpanded] = useState(true)

  useEffect(() => {
    if (phase === 'idle') {
      initGame()
    }
  }, [phase, initGame])

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortraitViewport(window.innerHeight > window.innerWidth)
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

  const shouldForceRotate = isPortraitViewport && autoRotateInPortrait

  const flyPositionMap: Record<
    PlayerId,
    { posClass: string; animClass: string }
  > = {
    player: {
      posClass: 'bottom-22 left-1/2 -translate-x-1/2',
      animClass: 'animate-fly-bottom',
    },
    ai2: {
      posClass: 'top-12 left-1/2 -translate-x-1/2',
      animClass: 'animate-fly-top',
    },
    ai3: {
      posClass: 'left-22 top-1/2 -translate-y-1/2',
      animClass: 'animate-fly-left',
    },
    ai1: {
      posClass: 'right-22 top-1/2 -translate-y-1/2',
      animClass: 'animate-fly-right',
    },
  }

  const stampPositionMap: Record<PlayerId, string> = {
    player: 'bottom-22 left-1/2 -translate-x-1/2',
    ai2: 'top-12 left-1/2 -translate-x-1/2',
    ai3: 'left-22 top-1/2 -translate-y-1/2',
    ai1: 'right-22 top-1/2 -translate-y-1/2',
  }

  return (
    <div
      className={`mahjong-table-felt relative flex flex-col justify-between overflow-hidden select-none text-slate-100 ${
        shouldForceRotate
          ? 'force-landscape-rotate'
          : 'safe-area-table w-full h-full'
      }`}
    >
      {/* ==================== 顶部栏：左上房间胶囊 + 中央对家立牌席 + 右上旋转/战绩/新局胶囊 ==================== */}
      <header className="mini-compact-header relative z-20 flex items-center justify-between px-1.5 sm:px-2.5 pt-0.5 pb-0.5 shrink-0">
        {/* 左上角：房间局数胶囊 */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/8 border border-white/15 text-[10px] sm:text-[11px]">
          <span className="font-calligraphy font-black text-amber-300 text-xs">
            欢乐国粹场
          </span>
          <span className="text-white/30">|</span>
          <span className="text-emerald-300 font-bold">第{roundNumber || 1}局</span>
        </div>

        {/* 顶部正中：对家（西·电脑2）头像 + 13张立体翠绿暗立牌 + 副露 */}
        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all ${
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
            <div className="flex items-center gap-1 pr-0.5">
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
                className="tile-3d-back w-2.5 h-4 rounded-[2px] border border-emerald-200/40"
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

        {/* 右上角：旋转画面、战绩存取、深浅色、新局 */}
        <div className="flex items-center gap-1">
          {isPortraitViewport && (
            <button
              type="button"
              onClick={() => setAutoRotateInPortrait((v) => !v)}
              className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-400/40 cursor-pointer transition"
              title="旋转画面方向"
            >
              📱旋转
            </button>
          )}
          <button
            type="button"
            onClick={() => setScoreModalOpen(true)}
            className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-white/10 hover:bg-white/20 text-amber-300 border border-amber-400/35 cursor-pointer transition"
          >
            🏆战绩
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            title="切换主题"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/15 cursor-pointer transition"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            onClick={initGame}
            className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-slate-950 shadow cursor-pointer active:scale-95 transition"
          >
            🔄新局
          </button>
        </div>
      </header>

      {/* ==================== 中部全屏环绕主牌桌（左席 + 中央天元罗盘与四方牌河 + 右席） ==================== */}
      <main className="relative z-10 flex-1 min-h-0 flex items-center justify-between px-1 sm:px-2.5 overflow-hidden">
        {/* 左侧席位：上家（北·电脑3） */}
        <aside className="flex items-center gap-1 shrink-0 z-10">
          <div
            className={`flex flex-col items-center p-1 rounded-2xl border transition-all w-12 sm:w-14 ${
              currentTurn === 'ai3'
                ? 'bg-amber-500/25 border-amber-400 animate-pulse-glow'
                : 'bg-white/8 border-white/15'
            }`}
          >
            <div className="relative mb-0.5">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-xs shadow-md">
                {SEAT_META.ai3.avatar}
              </span>
              <span className="absolute -bottom-0.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black">
                北
              </span>
            </div>
            <span className="text-[10px] font-bold text-white truncate max-w-full">
              {aiLeft.name}
            </span>
            <span className="text-[9px] font-mono font-extrabold text-amber-300">
              🫘{aiLeft.score}
            </span>
            <span className="text-[8px] text-emerald-300 font-bold">
              {aiLeft.hand.length}张
            </span>
          </div>

          {/* 上家纵向立体侧面牌墙 */}
          <div className="flex flex-col gap-0.5 py-0.5 px-0.5 rounded-lg bg-white/5">
            {Array.from({ length: Math.min(aiLeft.hand.length, 13) }).map((_, i) => (
              <div
                key={i}
                className="tile-3d-side w-2.5 h-1.5 sm:w-3.5 sm:h-2 rounded-[2px] border border-white/30"
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
          <div className="relative grid grid-cols-[minmax(72px,1fr)_auto_minmax(72px,1fr)] grid-rows-[minmax(30px,auto)_auto_minmax(30px,auto)] items-center justify-items-center gap-1 sm:gap-2 max-w-2xl w-full">
            {/* 【上方牌河】对家（西·电脑2）弃牌 */}
            <div className="col-start-2 row-start-1 flex flex-wrap justify-center gap-0.5 max-w-[155px] sm:max-w-[215px] min-h-[30px] p-0.5 rounded-lg bg-white/5 border border-white/10">
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
            <div className="col-start-1 row-start-2 justify-self-end flex flex-wrap justify-end content-center gap-0.5 max-w-[125px] sm:max-w-[165px] min-h-[40px] p-0.5 rounded-lg bg-white/5 border border-white/10">
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
            <div className="mini-compact-compass col-start-2 row-start-2 relative w-18 h-18 sm:w-22 sm:h-22 rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-500/65 shadow-[0_0_24px_rgba(245,158,11,0.22),inset_0_0_14px_rgba(245,158,11,0.18)] flex flex-col items-center justify-center">
              <div
                className={`absolute top-0.5 left-1/2 -translate-x-1/2 px-2 py-0 rounded-b text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'ai2'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                西
              </div>
              <div
                className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 px-2 py-0 rounded-t text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'player'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                东
              </div>
              <div
                className={`absolute left-0.5 top-1/2 -translate-y-1/2 px-0.5 py-1 rounded-r text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'ai3'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                北
              </div>
              <div
                className={`absolute right-0.5 top-1/2 -translate-y-1/2 px-0.5 py-1 rounded-l text-[9px] font-calligraphy font-black transition-all ${
                  currentTurn === 'ai1'
                    ? 'bg-amber-400 text-slate-950 shadow-[0_0_10px_#fbbf24]'
                    : 'text-slate-500'
                }`}
              >
                南
              </div>

              <div className="flex flex-col items-center justify-center leading-none">
                <span className="text-base sm:text-xl font-mono font-black text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]">
                  {String(countdown).padStart(2, '0')}
                </span>
                <span className="mt-0.5 px-1 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/30 text-[8px] sm:text-[9px] font-bold text-emerald-300">
                  余{wall.length}
                </span>
              </div>
            </div>

            {/* 【右侧牌河】下家（南·电脑1）弃牌 */}
            <div className="col-start-3 row-start-2 justify-self-start flex flex-wrap justify-start content-center gap-0.5 max-w-[125px] sm:max-w-[165px] min-h-[40px] p-0.5 rounded-lg bg-white/5 border border-white/10">
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
            <div className="col-start-2 row-start-3 flex flex-wrap justify-center gap-0.5 max-w-[155px] sm:max-w-[215px] min-h-[30px] p-0.5 rounded-lg bg-white/8 border border-amber-400/25">
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
          <div className="flex flex-col gap-0.5 py-0.5 px-0.5 rounded-lg bg-white/5">
            {Array.from({ length: Math.min(aiRight.hand.length, 13) }).map((_, i) => (
              <div
                key={i}
                className="tile-3d-side w-2.5 h-1.5 sm:w-3.5 sm:h-2 rounded-[2px] border border-white/30"
              />
            ))}
          </div>

          <div
            className={`flex flex-col items-center p-1 rounded-2xl border transition-all w-12 sm:w-14 ${
              currentTurn === 'ai1'
                ? 'bg-amber-500/25 border-amber-400 animate-pulse-glow'
                : 'bg-white/8 border-white/15'
            }`}
          >
            <div className="relative mb-0.5">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs shadow-md">
                {SEAT_META.ai1.avatar}
              </span>
              <span className="absolute -bottom-0.5 -right-1 px-1 rounded-full bg-amber-400 text-slate-950 text-[8px] font-black">
                南
              </span>
            </div>
            <span className="text-[10px] font-bold text-white truncate max-w-full">
              {aiRight.name}
            </span>
            <span className="text-[9px] font-mono font-extrabold text-amber-300">
              🫘{aiRight.score}
            </span>
            <span className="text-[8px] text-emerald-300 font-bold">
              {aiRight.hand.length}张
            </span>
          </div>
        </aside>
      </main>

      {/* ==================== 出牌飞出放大特写残影 ==================== */}
      {lastDiscardedTile && lastDiscardedBy && (
        <div
          key={lastDiscardedTile.id}
          className={`pointer-events-none absolute z-30 ${flyPositionMap[lastDiscardedBy].posClass} ${flyPositionMap[lastDiscardedBy].animClass}`}
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
          className={`pointer-events-none absolute z-40 ${stampPositionMap[actionBanner.playerId]}`}
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

      {/* ==================== 手牌正上方操作区：左侧本家信息+听牌提示 | 中央 出牌/吃/碰/杠/胡/过 ==================== */}
      <div className="mini-compact-actions relative z-30 flex items-center justify-between px-2 min-h-[38px] sm:min-h-[44px] shrink-0">
        {/* 左侧：本家身份积分胶囊 + 灯泡💡听牌提示 */}
        <div className="flex items-center gap-1.5 max-w-[52%] overflow-x-auto no-scrollbar">
          {/* 本家精简头像豆子胶囊（移至手牌上方左侧，把底部100%宽度让给14张手牌！） */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border shrink-0 transition-all ${
              isPlayerTurn
                ? 'bg-amber-500/25 border-amber-400'
                : 'bg-white/10 border-white/15'
            }`}
          >
            <span className="text-xs">{SEAT_META.player.avatar}</span>
            <span className="px-1 rounded bg-amber-400 text-slate-950 text-[8px] font-black">
              东庄
            </span>
            <span className="text-[10px] font-mono font-extrabold text-amber-300">
              🫘{human.score}
            </span>
          </div>

          {/* 灯泡听牌提示 */}
          {(activeWaits.length > 0 || tips.fanHints.length > 0) && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setTingExpanded((v) => !v)}
                className="w-7 h-7 rounded-full bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border border-white shadow flex flex-col items-center justify-center shrink-0 cursor-pointer active:scale-95"
                title="展开/收起听牌提示"
              >
                <span className="text-[9px] leading-none">💡</span>
                <span className="text-[8px] font-black text-slate-950 leading-none">听</span>
              </button>

              {tingExpanded && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-xl bg-slate-950/92 border border-amber-400/50 shadow-xl">
                  {activeWaits.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {activeWaits.map((w) => {
                        const parsed = parseTileKey(w.key)
                        return (
                          <div
                            key={w.key}
                            className="flex items-center gap-0.5 px-1 py-0.2 rounded bg-white/10 border border-amber-400/25 shrink-0"
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
                  ) : (
                    <span className="text-[9px] font-bold text-emerald-300 whitespace-nowrap">
                      {tips.fanHints.slice(0, 2).join(' · ')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 中右（牌型正上方）：吃 / 碰 / 杠 / 胡 / 过 与 出牌 按钮 */}
        <div className="flex items-center justify-center gap-2 sm:gap-2.5 ml-auto">
          {availableClaims.map((claim, idx) => {
            const isHu = claim.type === 'hu'
            const colorStyle = isHu
              ? 'w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-b from-red-500 via-rose-600 to-amber-600 ring-2 ring-amber-300 shadow-[0_0_18px_rgba(244,63,94,0.95)] animate-pulse-glow text-sm sm:text-base'
              : claim.type === 'minggang' || claim.type === 'angang'
                ? 'w-9.5 h-9.5 sm:w-11 sm:h-11 bg-gradient-to-b from-purple-400 via-indigo-600 to-indigo-800 ring-2 ring-amber-300 shadow text-xs sm:text-sm'
                : claim.type === 'peng'
                  ? 'w-9.5 h-9.5 sm:w-11 sm:h-11 bg-gradient-to-b from-amber-300 via-amber-500 to-orange-600 ring-2 ring-white shadow text-slate-950 text-xs sm:text-sm'
                  : 'w-9.5 h-9.5 sm:w-11 sm:h-11 bg-gradient-to-b from-emerald-400 via-teal-600 to-emerald-800 ring-2 ring-amber-200 shadow text-xs sm:text-sm'

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
              className="w-8 h-8 sm:w-9.5 sm:h-9.5 rounded-full bg-gradient-to-b from-slate-600 to-slate-800 border border-slate-400 text-white font-bold text-xs shadow cursor-pointer active:scale-92 transition"
            >
              过
            </button>
          )}

          {isPlayerTurn && (
            <button
              type="button"
              disabled={!canDiscard}
              onClick={discardSelected}
              className={`px-3.5 sm:px-5 h-8.5 sm:h-9.5 rounded-full font-calligraphy font-black text-xs sm:text-sm tracking-wider transition-all flex items-center gap-1 ${
                canDiscard
                  ? 'bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 text-slate-950 shadow-[0_3px_14px_rgba(245,158,11,0.8)] ring-2 ring-white cursor-pointer active:scale-95'
                  : 'bg-white/10 text-amber-200/60 border border-amber-400/25 cursor-not-allowed'
              }`}
            >
              <span>
                {canDiscard ? `出牌 (${selectedTileObj?.name ?? ''})` : '选牌出牌'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ==================== 底部：100%全宽专属手牌架（14张手牌自适应均分宽度，绝不裁切） ==================== */}
      <footer className="mini-compact-hand relative z-20 w-full px-1.5 sm:px-3 pt-2.5 pb-1 shrink-0">
        <div className="w-full flex items-end justify-center gap-1 sm:gap-2">
          {/* 本家已吃碰杠的副露（若有） */}
          {human.melds.length > 0 && (
            <div className="flex items-center gap-1 shrink-0 pb-0.5">
              {human.melds.map((m, i) => (
                <MeldGroup key={i} meld={m} selectedKey={selectedTileKey} />
              ))}
            </div>
          )}

          {/* 本家 13/14 张手牌：全宽自适应均分，保证任何手机屏幕上 14 张牌全部完整呈现 */}
          <div className="flex-1 max-w-2xl flex items-end justify-center gap-[2px] sm:gap-1">
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
      </footer>

      {/* 结算与战绩存取弹窗 */}
      <ResultModal />
      <ScoreModal open={scoreModalOpen} onClose={() => setScoreModalOpen(false)} />
    </div>
  )
}
