/** Small educational models calculated locally; no backend training jobs. */
export interface DataPoint {x:number;y:number;label:number|null}
export type MLExperiment='linear-regression'|'knn'|'kmeans'|'decision-tree'|'neural-network'
export interface TrainingFrame {iteration:number;loss:number;predictions:readonly number[];parameters:readonly number[]}
