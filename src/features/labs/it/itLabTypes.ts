import type { LucideIcon } from 'lucide-react'
export type ITLabId =
  | 'code'
  | 'algorithms'
  | 'computer'
  | 'network'
  | 'os'
  | 'database'
  | 'ai'
  | 'security'
export interface ITLabDefinition {
  id: ITLabId
  title: string
  description: string
  icon: LucideIcon
  topics: readonly string[]
  status: 'beta' | 'coming-soon'
  route: `/labs/it/${ITLabId}`
  next: string
}
