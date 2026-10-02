import { useEffect, useState } from 'react'
import { useLabSettings } from './useLabSettings'
const defaults = { speed: '1' }
export function usePlayback<T>(frames: readonly T[]) {
  const [index, setIndex] = useState(0),
    [playing, setPlaying] = useState(false),
    { settings, change } = useLabSettings('playback', defaults)
  const speed = [0.5, 1, 2].find((s) => String(s) === settings.speed) ?? 1
  useEffect(() => {
    setIndex(0)
    setPlaying(false)
  }, [frames])
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(
      () => setIndex((i) => Math.min(frames.length - 1, i + 1)),
      700 / speed,
    )
    return () => clearInterval(timer)
  }, [playing, frames.length, speed])
  useEffect(() => {
    if (index >= frames.length - 1) setPlaying(false)
  }, [index, frames.length])
  const safeIndex = Math.max(0, Math.min(index, frames.length - 1))
  return {
    index: safeIndex,
    count: frames.length,
    playing,
    speed,
    frame: frames[safeIndex],
    onIndex: (i: number) => {
      setPlaying(false)
      setIndex(Math.max(0, Math.min(i, frames.length - 1)))
    },
    onPlay: () => setPlaying((p) => !p),
    onSpeed: (s: number) => change('speed', String(s)),
  }
}
