/** Phase 3 educational topology only; never connects to an actual network. */
export interface NetworkDevice {id:string;kind:'pc'|'laptop'|'switch'|'router'|'server';ip:string|null;subnetMask:string|null;gateway:string|null;x:number;y:number;interfaces?:readonly {ip:string;mask:string}[]}
export interface NetworkLink {from:string;to:string}
export interface SimulatedPacket {sourceId:string;destinationId:string;layers:readonly ('application'|'transport'|'network'|'data-link')[];route:readonly string[];failure:'wrong-subnet'|'missing-gateway'|'duplicate-ip'|'unreachable'|null}
