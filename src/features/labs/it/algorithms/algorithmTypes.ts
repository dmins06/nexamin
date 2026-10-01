export type AlgorithmId =
  | 'bubble'
  | 'selection'
  | 'insertion'
  | 'merge'
  | 'quick'
  | 'linear'
  | 'binary'
  | 'bfs'
  | 'dfs'
  | 'dijkstra'
export interface AlgorithmDefinition {
  id: AlgorithmId
  title: string
  category: 'sorting' | 'searching' | 'graph'
  code: readonly string[]
  best: string
  average: string
  worst: string
  space: string
  explanation: string
}
export interface GraphEdge {
  from: number
  to: number
  weight: number
}
export interface AlgorithmInput {
  values: number[]
  target: number
  nodeCount: number
  edges: GraphEdge[]
  start: number
  directed: boolean
}
export interface TraceFrame {
  values: number[]
  active: number[]
  settled: number[]
  frontier: number[]
  distances: (number | null)[]
  found: number | null
  codeLine: number
  operation: string
  comparisons: number
  swaps: number
  visited: number[]
  edge: [number, number] | null
}
