import { useGameStore } from '../game/state/store'
import type { PlayerId } from '../game/types'
import { TileView } from './TileView'

const PLAYER_ORDER: PlayerId[] = ['player', 'ai1', 'ai2', 'ai3']

export function ResultModal() {
  const phase = useGameStore((s) => s.phase)
  const roundResult = useGameStore((s) => s.roundResult)
  const players = useGameStore((s) => s.players)
  const initGame = useGameStore((s) => s.initGame)

  if (phase !== 'roundEnd' || !roundResult) return null

  const {
    isDraw,
    isZimo,
    winnerName,
    fromPlayerName,
    fanNames,
    totalFan,
    scoreChanges,
    winningHand,
    winningMelds,
  } = roundResult

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-2">
      <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 shadow-2xl p-3.5 sm:p-5 text-slate-900 dark:text-slate-100 animate-action-flash">
        {/* 标题区域 */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-wide flex items-center gap-2">
              {isDraw ? (
                <span className="text-amber-500">荒牌流局</span>
              ) : (
                <>
                  <span className="text-emerald-500">
                    {winnerName} {isZimo ? '自摸胡牌！' : '荣胡！'}
                  </span>
                  {!isZimo && fromPlayerName && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-semibold">
                      {fromPlayerName} 点炮
                    </span>
                  )}
                </>
              )}
            </h2>
            {!isDraw && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                番型：{fanNames.join(' · ')}（共 {totalFan} 番）
              </p>
            )}
          </div>
          {!isDraw && (
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black text-base sm:text-lg">
                {totalFan} 番
              </span>
            </div>
          )}
        </div>

        {/* 胡牌牌型展示 */}
        {!isDraw && winningHand.length > 0 && (
          <div className="mb-3 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/70">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              胡牌牌型
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {winningMelds.map((meld, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-0.5 px-1.5 py-1 rounded bg-slate-200/80 dark:bg-slate-700/60"
                >
                  {meld.tiles.map((t) => (
                    <TileView key={t.id} tile={t} size="xs" />
                  ))}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-0.5">
                {winningHand.map((t) => (
                  <TileView key={t.id} tile={t} size="sm" />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 四家得分变化表 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {PLAYER_ORDER.map((pid) => {
            const p = players[pid]
            const delta = scoreChanges[pid]
            return (
              <div
                key={pid}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/60 text-center"
              >
                <div className="text-xs font-bold truncate">
                  {p.name}
                  {p.isDealer && (
                    <span className="ml-1 text-[10px] px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                      庄
                    </span>
                  )}
                </div>
                <div
                  className={`text-sm sm:text-base font-black mt-0.5 ${
                    delta > 0
                      ? 'text-emerald-500'
                      : delta < 0
                        ? 'text-rose-500'
                        : 'text-slate-400'
                  }`}
                >
                  {delta > 0 ? `+${delta}` : delta}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  总分: {p.score}
                </div>
              </div>
            )
          })}
        </div>

        {/* 底部操作按钮 */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={initGame}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 cursor-pointer transition"
          >
            再来一局（下一局）
          </button>
        </div>
      </div>
    </div>
  )
}
