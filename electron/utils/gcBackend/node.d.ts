import type { config, Session } from './types.d.ts';

export type * from './types.d.ts';

declare const nodeSession: (config?: config) => Session;
export default nodeSession;
