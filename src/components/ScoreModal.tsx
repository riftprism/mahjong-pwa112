import { useRef, useState } from 'react'
import { useGameStore } from '../game/state/store'
import type { PlayerId } from '../game/types'

interface ScoreModalProps {
  open: boolean
  onClose: () => void
}

const PLAYER_ORDER: PlayerId[] = ['player', 'ai1', 'ai2', 'ai3']

export function ScoreModal({ open, onClose }: ScoreModalProps) {
  const players = useGameStore((s) => s.players)
  const stats = useGameStore((s) => s.stats)
  const resetScores = useGameStore((s) => s.resetScores)
  const exportRecords = useGameStore((s) => s.exportRecords)
  const importRecords = useGameStore((s) => s.importRecords)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null)

  if (!open) return null

  const winRate =
    stats.totalRounds > 0
      ? `${Math.round((stats.playerWins / stats.totalRounds) * 100)}%`
      : '0%'

  const handleExportFile = () => {
    const json = exportRecords()
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `mahjong-records-${dateStr}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setStatusMsg({ ok: true, text: '战绩已导出为 JSON 文件' })
  }

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      const res = importRecords(content)
      setStatusMsg({ ok: res.ok, text: res.message })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-2 safe-area-pad">
      <div className="w-full max-w-xl max-h-[92dvh] flex flex-col rounded-2xl bg-slate-950 border border-amber-500/40 shadow-2xl p-3 sm:p-4 text-slate-100">
        {/* 顶部标题与导入导出按钮 */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2.5">
          <div>
            <h2 className="text-sm sm:text-base font-black text-amber-300">
              🏆 战绩榜与对局流水
            </h2>
            <p className="text-[10px] text-slate-400">
              战绩已自动持久化保存在浏览器中，支持文件导入与导出备份
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={handleExportFile}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-bold cursor-pointer"
            >
              📤 导出战绩
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 font-bold cursor-pointer"
            >
              📥 导入战绩
            </button>
            <button
              type="button"
              onClick={() => {
                resetScores()
                setStatusMsg({ ok: true, text: '战绩与积分已重置' })
              }}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-300 font-semibold cursor-pointer"
            >
              重置
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer"
            >
              关闭
            </button>
          </div>
        </div>

        {/* 操作状态提示条 */}
        {statusMsg && (
          <div
            className={`mb-2 px-2.5 py-1 rounded-lg text-xs font-bold ${
              statusMsg.ok
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* 四家当前积分 */}
        <div className="grid grid-cols-4 gap-1.5 mb-2.5">
          {PLAYER_ORDER.map((pid) => {
            const p = players[pid]
            const diff = p.score - 1000
            return (
              <div
                key={pid}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 text-center"
              >
                <div className="text-[11px] font-bold text-slate-200">{p.name}</div>
                <div className="text-sm sm:text-base font-black text-amber-400">
                  {p.score}
                </div>
                <div
                  className={`text-[10px] font-semibold ${
                    diff > 0
                      ? 'text-emerald-400'
                      : diff < 0
                        ? 'text-rose-400'
                        : 'text-slate-500'
                  }`}
                >
                  {diff > 0 ? `+${diff}` : diff}
                </div>
              </div>
            )
          })}
        </div>

        {/* 玩家战绩概览 */}
        <div className="grid grid-cols-5 gap-1.5 mb-2.5 text-center">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-slate-400">总局数</div>
            <div className="text-xs sm:text-sm font-black">{stats.totalRounds}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-slate-400">玩家胜局</div>
            <div className="text-xs sm:text-sm font-black text-emerald-400">
              {stats.playerWins}
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-slate-400">玩家胜率</div>
            <div className="text-xs sm:text-sm font-black text-amber-400">{winRate}</div>
          </div>
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-slate-400">玩家自摸</div>
            <div className="text-xs sm:text-sm font-black text-sky-400">
              {stats.playerZimo}
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className="text-[10px] text-slate-400">最高番数</div>
            <div className="text-xs sm:text-sm font-black text-rose-400">
              {stats.highestFan}番
            </div>
          </div>
        </div>

        {/* 最近对局记录 */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2">
          <div className="text-[11px] font-bold text-slate-400 mb-1.5">
            历史对局明细（最多保留最近 50 局）
          </div>
          {stats.history.length === 0 ? (
            <div className="py-5 text-center text-xs text-slate-500">
              暂无对局记录，完成一局后将自动保存
            </div>
          ) : (
            <div className="space-y-1">
              {stats.history.map((item, idx) => (
                <div
                  key={`${item.roundNumber}-${idx}`}
                  className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-white/5"
                >
                  <div className="min-w-0 truncate pr-2">
                    <span className="font-bold text-amber-400/80 mr-1.5">
                      第{item.roundNumber}局
                    </span>
                    <span className="font-semibold text-slate-100">{item.summary}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">
                      {item.fanText}
                    </span>
                  </div>
                  <div
                    className={`font-bold shrink-0 ${
                      item.scoreChanges.player > 0
                        ? 'text-emerald-400'
                        : item.scoreChanges.player < 0
                          ? 'text-rose-400'
                          : 'text-slate-400'
                    }`}
                  >
                    玩家:{' '}
                    {item.scoreChanges.player > 0
                      ? `+${item.scoreChanges.player}`
                      : item.scoreChanges.player}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
