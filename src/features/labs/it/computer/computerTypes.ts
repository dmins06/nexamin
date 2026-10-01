/** Phase 2 domain contract, not a functioning CPU/microarchitecture simulator. */
export type Instruction = {op:'LOAD';address:number;register:number}|{op:'ADD';left:number;right:number;destination:number}|{op:'STORE';register:number;address:number}|{op:'HALT'}
export interface CPUState {phase:'fetch'|'decode'|'execute'|'halted';pc:number;registers:readonly number[];ram:readonly number[];instruction:Instruction|null}
