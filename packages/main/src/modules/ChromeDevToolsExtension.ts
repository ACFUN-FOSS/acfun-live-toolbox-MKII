import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';
import { app } from 'electron';
import installer from 'electron-devtools-installer';

const {
  REDUX_DEVTOOLS,
  VUEJS_DEVTOOLS,
  VUEJS3_DEVTOOLS,
  EMBER_INSPECTOR,
  BACKBONE_DEBUGGER,
  REACT_DEVELOPER_TOOLS,
  APOLLO_DEVELOPER_TOOLS,
  JQUERY_DEBUGGER,
  ANGULARJS_BATARANG,
  MOBX_DEVTOOLS,
  CYCLEJS_DEVTOOL,
  default: installExtension,
} = installer;

const extensionsDictionary = {
  REDUX_DEVTOOLS,
  VUEJS_DEVTOOLS,
  VUEJS3_DEVTOOLS,
  EMBER_INSPECTOR,
  BACKBONE_DEBUGGER,
  REACT_DEVELOPER_TOOLS,
  APOLLO_DEVELOPER_TOOLS,
  JQUERY_DEBUGGER,
  ANGULARJS_BATARANG,
  MOBX_DEVTOOLS,
  CYCLEJS_DEVTOOL,
} as const;

export class ChromeDevToolsExtension implements AppModule {
  readonly #extension: keyof typeof extensionsDictionary;

  constructor({extension}: {readonly extension: keyof typeof extensionsDictionary}) {
    this.#extension = extension;
  }

  async enable(context: ModuleContext): Promise<boolean> {
    await app.whenReady();
    await installExtension(extensionsDictionary[this.#extension]);
    return true;
  }

  async disable(): Promise<boolean> {
    // Chrome扩展无法通过编程方式禁用，返回true表示操作成功
    return true;
  }
}

export function chromeDevToolsExtension(...args: ConstructorParameters<typeof ChromeDevToolsExtension>) {
  return new ChromeDevToolsExtension(...args);
}
