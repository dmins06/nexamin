import { useEffect, useState } from 'react'
export function readLabSettings(
  id: string,
  defaults: Readonly<Record<string, string>>,
): Record<string, string> {
  try {
    const v: unknown = JSON.parse(
      localStorage.getItem(`nexamin.it.${id}.v1`) ?? 'null',
    )
    if (
      !v ||
      typeof v !== 'object' ||
      !('version' in v) ||
      v.version !== 1 ||
      !('values' in v) ||
      !v.values ||
      typeof v.values !== 'object'
    )
      return { ...defaults }
    const entries = Object.entries(v.values)
    return Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => {
        const value = entries.find(([k]) => k === key)?.[1]
        return [
          key,
          typeof value === 'string' ? value.slice(0, 32768) : fallback,
        ]
      }),
    )
  } catch {
    return { ...defaults }
  }
}
export function useLabSettings(
  id: string,
  defaults: Readonly<Record<string, string>>,
) {
  const [settings, setSettings] = useState(() => readLabSettings(id, defaults))
  useEffect(() => {
    try {
      localStorage.setItem(
        `nexamin.it.${id}.v1`,
        JSON.stringify({ version: 1, values: settings }),
      )
    } catch {
      /* Private browsing/quota never disables the lab. */
    }
  }, [id, settings])
  return {
    settings,
    change: (key: string, value: string) =>
      setSettings((s) => ({ ...s, [key]: value.slice(0, 32768) })),
  }
}
