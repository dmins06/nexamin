/** Minimal extension contract; current Worker results are defined in sqlEngine. No production DB connection. */
export interface LocalSQLRequest {sql:string;sampleDatabase:'students-courses'}
export interface LocalSQLResult {columns:readonly string[];rows:readonly (readonly (string|number|null)[])[];affectedRows:number;elapsedMs:number}
export interface ERDEntity {id:string;name:string;attributes:readonly {name:string;type:string;primaryKey:boolean;foreignKey:{entityId:string;attribute:string}|null}[]}
