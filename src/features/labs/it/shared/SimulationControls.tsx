import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react'
export function SimulationControls({
  index,
  count,
  playing,
  speed,
  onIndex,
  onPlay,
  onSpeed,
}: {
  index: number
  count: number
  playing: boolean
  speed: number
  onIndex: (index: number) => void
  onPlay: () => void
  onSpeed: (speed: number) => void
}) {
  return (
    <div className="it-controls" aria-label="Điều khiển mô phỏng">
      <button
        className="it-button"
        disabled={!count || index === 0}
        onClick={() => onIndex(0)}
      >
        <RotateCcw size={16} aria-hidden="true" />
        Bắt đầu lại
      </button>
      <button
        className="it-button"
        disabled={!count || index === 0}
        onClick={() => onIndex(index - 1)}
        aria-label="Bước trước"
      >
        <SkipBack size={17} aria-hidden="true" />
      </button>
      <button
        className="it-button primary"
        disabled={!count || index >= count - 1}
        onClick={onPlay}
      >
        {playing ? (
          <Pause size={17} aria-hidden="true" />
        ) : (
          <Play size={17} aria-hidden="true" />
        )}
        {playing ? 'Tạm dừng' : 'Phát'}
      </button>
      <button
        className="it-button"
        disabled={!count || index >= count - 1}
        onClick={() => onIndex(index + 1)}
        aria-label="Bước tiếp"
      >
        <SkipForward size={17} aria-hidden="true" />
      </button>
      <label>
        Tốc độ
        <select
          aria-label="Tốc độ"
          value={speed}
          onChange={(e) => onSpeed(Number(e.target.value))}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </label>
    </div>
  )
}
