/** Bounded single-CPU scheduling contracts used by the teaching engine. */
export interface LabProcess {id:string;arrival:number;burst:number;priority:number}
export type SchedulingPolicy='fcfs'|'sjf'|'srtf'|'round-robin'|'priority'
export interface ScheduleSlice {processId:string|null;start:number;end:number}
export interface ProcessMetrics {processId:string;waiting:number;turnaround:number;response:number}
export interface MemoryBlock {start:number;size:number;processId:string|null}
