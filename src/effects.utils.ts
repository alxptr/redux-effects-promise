import { EFFECTS_GLOBAL_ERROR_HOOK_NAME } from './effects.interface';

/**
 * @stable [10.01.2020]
 * @param value
 * @returns {boolean}
 */
export const isFn = (value: any): boolean => typeof value === 'function';

/**
 * @stable [20.06.2024]
 * @param value
 */
export const isUndef = <TValue>(value: TValue) => typeof value === 'undefined';

/**
 * @stable [20.06.2024]
 * @param value
 */
export const isNil = <TValue>(value: TValue) => value === null;

/**
 * @stable [10.01.2020]
 * @param value
 * @returns {boolean}
 */
export const isDefined = (value: any): boolean => !isNil(value) && !isUndef(value);

export const pushGlobalError = (error: Error): void => {
  const $$racGlobalErrorHook = window[EFFECTS_GLOBAL_ERROR_HOOK_NAME];
  if (isFn($$racGlobalErrorHook)) {
    try {
      $$racGlobalErrorHook(error);
    } catch (ignored) {
      // Do nothing
    }
  }
};

/**
 * @stable [10.01.2020]
 * @param value
 * @returns {boolean}
 */
export const isPromiseLike = (value: any): value is Promise<unknown> =>
  value instanceof Promise || (
    isDefined(value) && isFn(value.then) && isFn(value.catch)
  );
