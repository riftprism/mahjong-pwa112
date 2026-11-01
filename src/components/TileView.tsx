import type { Tile } from '../game/types'

interface TileViewProps {
  tile: Tile
  size?: 'xs' | 'river' | 'sm' | 'md' | 'lg'
  selected?: boolean
  isNewlyDrawn?: boolean
  isLastDiscard?: boolean
  isSameAsSelected?: boolean
  canTingIfDiscarded?: boolean
  faceDown?: boolean
  onClick?: () => void
  className?: string
}

const WAN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

/**
 * 渲染筒子（1~9筒）传统彩色圆饼 SVG 图案
 */
function TongFace({ value }: { value: number }) {
  const C_RED = '#dc2626'
  const C_GREEN = '#16a34a'
  const C_BLUE = '#2563eb'

  const Dot = ({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} />
      <circle cx={cx} cy={cy} r={r * 0.58} fill="none" stroke="#fff" strokeWidth={r * 0.2} />
      <circle cx={cx} cy={cy} r={r * 0.22} fill="#fff" />
    </g>
  )

  if (value === 1) {
    return (
      <svg viewBox="0 0 40 52" className="w-full h-full">
        <circle cx="20" cy="27" r="14" fill={C_GREEN} />
        <circle
          cx="20"
          cy="27"
          r="11"
          fill="none"
          stroke="#fef08a"
          strokeWidth="1.5"
          strokeDasharray="2.2 1.4"
        />
        <circle cx="20" cy="27" r="8.2" fill={C_RED} />
        <circle cx="20" cy="27" r="4.5" fill="none" stroke="#fff" strokeWidth="1.3" />
        <circle cx="20" cy="27" r="1.8" fill="#fef08a" />
      </svg>
    )
  }

  const coords: Record<number, Array<{ x: number; y: number; r: number; c: string }>> = {
    2: [
      { x: 20, y: 15, r: 7.5, c: C_BLUE },
      { x: 20, y: 37, r: 7.5, c: C_GREEN },
    ],
    3: [
      { x: 11, y: 13, r: 6.2, c: C_BLUE },
      { x: 20, y: 26, r: 6.2, c: C_RED },
      { x: 29, y: 39, r: 6.2, c: C_GREEN },
    ],
    4: [
      { x: 12.5, y: 15, r: 6.2, c: C_BLUE },
      { x: 27.5, y: 15, r: 6.2, c: C_GREEN },
      { x: 12.5, y: 37, r: 6.2, c: C_GREEN },
      { x: 27.5, y: 37, r: 6.2, c: C_BLUE },
    ],
    5: [
      { x: 12, y: 14, r: 5.5, c: C_BLUE },
      { x: 28, y: 14, r: 5.5, c: C_GREEN },
      { x: 20, y: 26, r: 5.8, c: C_RED },
      { x: 12, y: 38, r: 5.5, c: C_GREEN },
      { x: 28, y: 38, r: 5.5, c: C_BLUE },
    ],
    6: [
      { x: 13, y: 13, r: 5.2, c: C_GREEN },
      { x: 27, y: 13, r: 5.2, c: C_GREEN },
      { x: 13, y: 28, r: 5.2, c: C_RED },
      { x: 27, y: 28, r: 5.2, c: C_RED },
      { x: 13, y: 40, r: 5.2, c: C_RED },
      { x: 27, y: 40, r: 5.2, c: C_RED },
    ],
    7: [
      { x: 10, y: 11, r: 4.5, c: C_GREEN },
      { x: 20, y: 15, r: 4.5, c: C_GREEN },
      { x: 30, y: 19, r: 4.5, c: C_GREEN },
      { x: 13, y: 30, r: 4.8, c: C_RED },
      { x: 27, y: 30, r: 4.8, c: C_RED },
      { x: 13, y: 41, r: 4.8, c: C_RED },
      { x: 27, y: 41, r: 4.8, c: C_RED },
    ],
    8: [
      { x: 13, y: 11, r: 4.4, c: C_BLUE },
      { x: 27, y: 11, r: 4.4, c: C_BLUE },
      { x: 13, y: 21, r: 4.4, c: C_BLUE },
      { x: 27, y: 21, r: 4.4, c: C_BLUE },
      { x: 13, y: 31, r: 4.4, c: C_BLUE },
      { x: 27, y: 31, r: 4.4, c: C_BLUE },
      { x: 13, y: 41, r: 4.4, c: C_BLUE },
      { x: 27, y: 41, r: 4.4, c: C_BLUE },
    ],
    9: [
      { x: 10, y: 13, r: 4.3, c: C_BLUE },
      { x: 20, y: 13, r: 4.3, c: C_BLUE },
      { x: 30, y: 13, r: 4.3, c: C_BLUE },
      { x: 10, y: 26, r: 4.3, c: C_RED },
      { x: 20, y: 26, r: 4.3, c: C_RED },
      { x: 30, y: 26, r: 4.3, c: C_RED },
      { x: 10, y: 39, r: 4.3, c: C_GREEN },
      { x: 20, y: 39, r: 4.3, c: C_GREEN },
      { x: 30, y: 39, r: 4.3, c: C_GREEN },
    ],
  }

  const list = coords[value] ?? []
  return (
    <svg viewBox="0 0 40 52" className="w-full h-full">
      {list.map((d, i) => (
        <Dot key={i} cx={d.x} cy={d.y} r={d.r} color={d.c} />
      ))}
    </svg>
  )
}

/**
 * 渲染条子（1条幺鸡 + 2~9条竹节）SVG 图案
 */
function TiaoFace({ value }: { value: number }) {
  const C_GREEN = '#15803d'
  const C_RED = '#dc2626'
  const C_GOLD = '#d97706'

  if (value === 1) {
    return (
      <svg viewBox="0 0 40 52" className="w-full h-full">
        <path
          d="M11 39 C10 29, 17 22, 22 22 C28 22, 32 28, 30 37 C27 42, 16 44, 11 39 Z"
          fill={C_GREEN}
        />
        <path d="M18 11 C20 7, 25 8, 24 13 C26 11, 29 13, 25 16 Z" fill={C_RED} />
        <circle cx="20" cy="17" r="4.5" fill={C_GOLD} />
        <polygon points="13,17 16.5,15.2 16.5,18.8" fill={C_RED} />
        <circle cx="19.5" cy="16.5" r="1.1" fill="#fff" />
        <path
          d="M15 26 Q22 23 27 30 Q22 35 15 32 Z"
          fill="#fef08a"
          stroke={C_RED}
          strokeWidth="1.2"
        />
        <path
          d="M16 38 L12 45 M20 39 L20 46 M24 38 L28 45"
          stroke={C_RED}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const Stick = ({
    x,
    y,
    h = 14,
    color = C_GREEN,
  }: {
    x: number
    y: number
    h?: number
    color?: string
  }) => (
    <g>
      <rect x={x - 2.1} y={y} width="4.2" height={h} rx="2" fill={color} />
      <line
        x1={x - 2.1}
        y1={y + h / 2}
        x2={x + 2.1}
        y2={y + h / 2}
        stroke="#fefce8"
        strokeWidth="1.3"
      />
    </g>
  )

  const sticksMap: Record<number, Array<{ x: number; y: number; h?: number; c?: string }>> = {
    2: [
      { x: 20, y: 9, h: 15 },
      { x: 20, y: 28, h: 15 },
    ],
    3: [
      { x: 20, y: 9, h: 15 },
      { x: 13, y: 28, h: 15 },
      { x: 27, y: 28, h: 15 },
    ],
    4: [
      { x: 13, y: 9, h: 15 },
      { x: 27, y: 9, h: 15 },
      { x: 13, y: 28, h: 15 },
      { x: 27, y: 28, h: 15 },
    ],
    5: [
      { x: 11, y: 9, h: 15 },
      { x: 29, y: 9, h: 15 },
      { x: 20, y: 19, h: 14, c: C_RED },
      { x: 11, y: 28, h: 15 },
      { x: 29, y: 28, h: 15 },
    ],
    6: [
      { x: 11, y: 9, h: 15 },
      { x: 20, y: 9, h: 15 },
      { x: 29, y: 9, h: 15 },
      { x: 11, y: 28, h: 15 },
      { x: 20, y: 28, h: 15 },
      { x: 29, y: 28, h: 15 },
    ],
    7: [
      { x: 20, y: 6, h: 11, c: C_RED },
      { x: 11, y: 19, h: 11 },
      { x: 20, y: 19, h: 11 },
      { x: 29, y: 19, h: 11 },
      { x: 11, y: 33, h: 11 },
      { x: 20, y: 33, h: 11 },
      { x: 29, y: 33, h: 11 },
    ],
    8: [
      { x: 10, y: 9, h: 14 },
      { x: 17, y: 9, h: 14 },
      { x: 23, y: 9, h: 14 },
      { x: 30, y: 9, h: 14 },
      { x: 10, y: 28, h: 14 },
      { x: 17, y: 28, h: 14 },
      { x: 23, y: 28, h: 14 },
      { x: 30, y: 28, h: 14 },
    ],
    9: [
      { x: 11, y: 6, h: 11 },
      { x: 20, y: 6, h: 11, c: C_RED },
      { x: 29, y: 6, h: 11 },
      { x: 11, y: 20, h: 11 },
      { x: 20, y: 20, h: 11, c: C_RED },
      { x: 29, y: 20, h: 11 },
      { x: 11, y: 34, h: 11 },
      { x: 20, y: 34, h: 11, c: C_RED },
      { x: 29, y: 34, h: 11 },
    ],
  }

  const sticks = sticksMap[value] ?? []
  return (
    <svg viewBox="0 0 40 52" className="w-full h-full">
      {sticks.map((s, idx) => (
        <Stick key={idx} x={s.x} y={s.y} h={s.h} color={s.c} />
      ))}
    </svg>
  )
}

/**
 * 渲染万字、风牌、三元牌（中发白）牌面
 */
function CharacterOrHonorFace({ tile }: { tile: Tile }) {
  if (tile.suit === 'wan') {
    const numChar = WAN_NUMS[tile.value - 1] ?? String(tile.value)
    return (
      <div className="flex flex-col items-center justify-center w-full h-full leading-none py-0.5 font-calligraphy">
        <span className="text-[1.05em] font-black text-slate-900 tracking-tighter">
          {numChar}
        </span>
        <span className="text-[0.92em] font-black text-red-600 -mt-0.5">萬</span>
      </div>
    )
  }

  if (tile.suit === 'wind') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full font-calligraphy">
        <span className="text-[1.4em] font-black text-slate-800 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
          {tile.name}
        </span>
      </div>
    )
  }

  if (tile.value === 1) {
    return (
      <div className="flex items-center justify-center w-full h-full font-calligraphy">
        <span className="text-[1.45em] font-black text-red-600 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
          中
        </span>
      </div>
    )
  }
  if (tile.value === 2) {
    return (
      <div className="flex items-center justify-center w-full h-full font-calligraphy">
        <span className="text-[1.4em] font-black text-emerald-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
          發
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center w-full h-full p-1">
      <div className="w-full h-full rounded-[3px] border-2 border-blue-700 p-0.5 flex items-center justify-center">
        <div className="w-full h-full rounded-[1px] border border-blue-500/70" />
      </div>
    </div>
  )
}

export function TileView({
  tile,
  size = 'md',
  selected = false,
  isNewlyDrawn = false,
  isLastDiscard = false,
  isSameAsSelected = false,
  canTingIfDiscarded = false,
  faceDown = false,
  onClick,
  className = '',
}: TileViewProps) {
  const sizeClasses = {
    xs: 'w-5 h-7 text-[10px] rounded-[4px] shrink-0',
    river: 'w-[21px] h-[29px] sm:w-6.5 sm:h-9 text-[10px] sm:text-xs rounded-[4px] shrink-0',
    sm: 'w-7 h-10 text-xs rounded-[5px] shrink-0',
    // hand-tile-responsive Uses CSS variable / fluid sizing so 14 tiles always fit on 1 row
    md: 'hand-tile-md text-[13px] sm:text-lg rounded-[5px] sm:rounded-[7px]',
    lg: 'w-12 h-16.5 sm:w-14 sm:h-19.5 text-lg sm:text-xl rounded-[8px] shrink-0',
  }[size]

  if (faceDown) {
    return (
      <div
        className={`tile-3d-back inline-flex items-center justify-center border border-emerald-200/40 select-none ${sizeClasses} ${className}`}
      >
        <div className="w-3/4 h-3/4 rounded-[2px] border border-white/25 bg-white/5 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rotate-45 bg-amber-300/50" />
        </div>
      </div>
    )
  }

  const isSmall = size === 'xs' || size === 'river' || size === 'sm'

  const cornerBadge =
    !isSmall && (tile.suit === 'tong' || tile.suit === 'tiao') ? tile.value : null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={tile.name}
      className={[
        'relative inline-flex flex-col items-center justify-center select-none transition-all duration-150',
        isSmall ? 'tile-3d-front-sm' : 'tile-3d-front',
        'border border-amber-900/20',
        sizeClasses,
        selected
          ? '-translate-y-3 ring-2 ring-amber-400 shadow-[0_10px_18px_rgba(245,158,11,0.55)] z-20'
          : onClick
            ? 'active:scale-95 hover:-translate-y-0.5 cursor-pointer'
            : 'cursor-default',
        isLastDiscard
          ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)] animate-river-land z-20'
          : '',
        isSameAsSelected && !selected
          ? 'ring-2 ring-cyan-400 brightness-105 shadow-[0_0_12px_rgba(34,211,238,0.85)] z-10'
          : '',
        isNewlyDrawn ? 'ml-1.5 sm:ml-3' : '',
        className,
      ].join(' ')}
    >
      {/* 最新打出的弃牌上方跳动金色指示锥 */}
      {isLastDiscard && (
        <span className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 animate-pointer-bounce flex flex-col items-center">
          <span className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-amber-400 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
        </span>
      )}

      {/* 左上角点数速读角标 */}
      {cornerBadge && (
        <span className="absolute top-0.5 left-0.5 text-[7px] sm:text-[8px] leading-none font-black text-slate-500/85 pointer-events-none">
          {cornerBadge}
        </span>
      )}

      {/* 打此张可听牌的橙金「听」角标 */}
      {canTingIfDiscarded && (
        <span className="absolute -top-2 -right-0.5 px-1 py-0 text-[8px] sm:text-[9px] leading-3.5 font-black rounded-full bg-gradient-to-b from-amber-400 to-orange-600 text-white shadow-md ring-1 ring-amber-200 z-20">
          听
        </span>
      )}

      {/* 牌面图案 */}
      <div className="w-full h-full flex items-center justify-center p-0.5 overflow-hidden">
        {tile.suit === 'tong' ? (
          <TongFace value={tile.value} />
        ) : tile.suit === 'tiao' ? (
          <TiaoFace value={tile.value} />
        ) : (
          <CharacterOrHonorFace tile={tile} />
        )}
      </div>
    </button>
  )
}
