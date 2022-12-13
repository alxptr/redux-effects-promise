import { Action } from 'redux';

export const EFFECTS_GLOBAL_ERROR_HOOK_NAME = '$$racGlobalErrorHook';

/**
 * @stable [23.01.2021]
 */
export interface IEffectsAction<TData = unknown,
  TInitialData = unknown,
  TError = unknown>
  extends Action {
  data?: TData;
  error?: TError;
  initialData?: TInitialData;
  initialType?: string;
}

/**
 * @stable [23.01.2021]
 */
export interface IEffectsMiddlewareAPI {
  dispatch: (action: IEffectsAction) => IEffectsAction;
}
