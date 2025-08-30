import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';
import { app } from 'electron';

class ApplicationTerminatorOnLastWindowClose implements AppModule {
  private windowAllClosedListener?: () => void;

  enable(context: ModuleContext): Promise<void> | void {
    this.windowAllClosedListener = () => app.quit();
    app.on('window-all-closed', this.windowAllClosedListener);
  }

  disable(): Promise<void> | void {
    if (this.windowAllClosedListener) {
      app.off('window-all-closed', this.windowAllClosedListener);
      this.windowAllClosedListener = undefined;
    }
  }
}


export function terminateAppOnLastWindowClose() {
  return new ApplicationTerminatorOnLastWindowClose();
}
