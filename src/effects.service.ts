import { Store } from 'redux';
import { Container } from 'inversify';
import {
  ILogger,
  LoggerFactory,
} from 'ts-smart-logger';

import { isDefined } from './effects.utils';

export class EffectsService {

  /**
   * @stable [15.03.2020]
   * @param {string} actionTypeOrConfig
   * @param {boolean} override
   * @returns {(...args) => void}
   */
  public static effects(actionTypeOrConfig: string | null | undefined, override = false): (...args) => void {
    if (!isDefined(actionTypeOrConfig)) {
      throw new Error(`The configuration is not defined...`);
    }
    return (target: { new(...args): void }, propertyKey: string): void => {
      if (this.effectsMap.has(actionTypeOrConfig)) {
        if (override) {
          this.logger.debug(`[$EffectsService] An effect does already exist for the action type ${actionTypeOrConfig}. Will be overridden..`);
        } else {
          this.logger.warn(`[$EffectsService] An effect does already exist for the action type ${actionTypeOrConfig}. Exit...`);
          return;
        }
      }
      this.addEffect(actionTypeOrConfig, propertyKey, target);
    };
  }

  /**
   * @stable [10.01.2020]
   * @param {string} type
   * @returns {(...args) => {}}
   */
  public static fromEffectsMap(type: string): (...args) => {} {
    return this.effectsMap.get(type);
  }

  /**
   * @stable [10.01.2020]
   * @param {Container} $IoCContainer
   * @param {Store<{}>} store
   */
  public static configure($IoCContainer: Container, store: Store<{}>): void {
    this.$IoCContainer = $IoCContainer;
    this.store = store;
  }

  private static $IoCContainer: Container;
  private static readonly effectsMap = new Map<string, (...args) => {}>();
  private static readonly logger = LoggerFactory.makeLogger(EffectsService);
  private static store: Store<{}>;

  /**
   * @stable [10.01.2020]
   * @param {string} actionType
   * @param {string} propertyKey
   * @param {{new(...args): void}} target
   */
  private static addEffect(actionType: string, propertyKey: string, target: { new(...args): void }) {
    this.effectsMap.set(
      actionType,
      function() {
        const proxyObject = EffectsService.$IoCContainer.get(target.constructor);
        const effectsFn = Reflect.get(proxyObject, propertyKey) as () => {};
        const currentState = EffectsService.store.getState();
        const args = [...Array.from(arguments), currentState];

        return effectsFn.apply(proxyObject, args);
      }
    );
  }
}
