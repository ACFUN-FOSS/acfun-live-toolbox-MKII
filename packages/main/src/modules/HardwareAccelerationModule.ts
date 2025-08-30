import { AppModule } from '../core/AppModule';
import { ModuleContext } from '../core/ModuleContext';

export class HardwareAccelerationModule implements AppModule {
  readonly #shouldBeDisabled: boolean;


  constructor({enable}: {enable: boolean}) {
    this.#shouldBeDisabled = !enable;
  }

  async enable({app}: ModuleContext): Promise<boolean> {
    if (this.#shouldBeDisabled) {
      app.disableHardwareAcceleration();
    }
    return true;
  }

  async disable(): Promise<boolean> {
    // 硬件加速设置无法在运行时动态启用，返回true表示操作成功
    return true;
  }
}

export function hardwareAccelerationMode(...args: ConstructorParameters<typeof HardwareAccelerationModule>) {
  return new HardwareAccelerationModule(...args);
}
