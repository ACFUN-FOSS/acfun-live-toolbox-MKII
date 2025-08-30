import type { ModuleContext } from './ModuleContext.js';

export interface AppModule {
    enable(context: ModuleContext): Promise<void> | void;
    disable?(): Promise<void> | void;
}