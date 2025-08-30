import { AppModule } from '../core/AppModule';
import { autoUpdater, type AppUpdater, type Logger } from 'electron-updater';
import { ModuleContext } from '../core/ModuleContext';

type DownloadNotification = Parameters<AppUpdater['checkForUpdatesAndNotify']>[0];

export class AutoUpdater implements AppModule {

  readonly #logger: Logger | null;
  readonly #notification: DownloadNotification | undefined;
  private context: ModuleContext | undefined;

  constructor(
    {
      logger = null,
      downloadNotification,
    }: {
      logger?: Logger | null;
      downloadNotification?: DownloadNotification;
    } = {},
  ) {
    this.#logger = logger;
    this.#notification = downloadNotification;
  }

  async enable(context: ModuleContext): Promise<boolean> {
    this.context = context;
    await this.runAutoUpdater();
    return true;
  }

  async disable(): Promise<boolean> {
    // 实现禁用逻辑
    return true;
  }

  getAutoUpdater(): AppUpdater {
    return autoUpdater;
  }

  async runAutoUpdater() {
    const updater = this.getAutoUpdater();
    try {
      updater.logger = this.#logger || null;
      updater.fullChangelog = true;

      if (process.env.VITE_DISTRIBUTION_CHANNEL) {
        updater.channel = process.env.VITE_DISTRIBUTION_CHANNEL;
      }

      return await updater.checkForUpdatesAndNotify(this.#notification);
    } catch (error) {
      if (error instanceof Error && error.message.includes('No published versions')) {
        return null;
      }
      throw error;
    }
  }
}


export function createAutoUpdater(...args: ConstructorParameters<typeof AutoUpdater>) {
  return new AutoUpdater(...args);
}
