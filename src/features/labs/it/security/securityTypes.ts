/** Phase 3: sandbox-only demonstrations, no external target address accepted. */
export type SecurityLesson='hashing'|'salted-passwords'|'authentication'|'authorization'|'secure-coding'
export interface SecurityExercise {id:string;lesson:SecurityLesson;scenario:string;mitigation:string;environment:'local-sandbox'}
