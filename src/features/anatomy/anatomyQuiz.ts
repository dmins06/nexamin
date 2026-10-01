import type { AnatomyLearningPrompt } from './anatomyTypes'

const recognizable = ['skull', 'spine', 'rib-cage', 'femur', 'heart', 'aorta', 'lungs', 'liver', 'stomach', 'brain', 'kidneys', 'bladder']

export function createAnatomyQuiz(availableIds: ReadonlySet<string> | undefined, step: number): AnatomyLearningPrompt | null {
  const pool = recognizable.filter((id) => !availableIds || availableIds.has(id))
  if (pool.length < 4) return null
  const index = ((step % pool.length) + pool.length) % pool.length
  const structureId = pool[index]
  if (!structureId) return null
  const distractors = [1, 2, 3].map((offset) => pool[(index + offset) % pool.length]).filter((id): id is string => typeof id === 'string')
  if (distractors.length !== 3) return null
  const choices = [structureId, ...distractors]
  return { structureId, choices: choices.slice(index % 4).concat(choices.slice(0, index % 4)), answerId: null }
}
