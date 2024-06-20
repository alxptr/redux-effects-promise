import { MiddlewareAPI } from 'redux';
import {
  ILogger,
  LoggerFactory,
} from 'ts-smart-logger';

import { EffectsAction } from './effects.action';
import { EffectsActionBuilder } from './effects-action.builder';
import { EffectsService } from './effects.service';
import {
  IEffectsAction,
  IEffectsMiddlewareAPI,
} from './effects.interface';
import {
  isDefined,
  isFn,
  isPromiseLike,
  pushGlobalError,
} from './effects.utils';

const logger = LoggerFactory.makeLogger('effects.middleware');

/**
 * @stable [10.01.2020]
 * @param {IEffectsAction} action
 * @param result
 * @returns {IEffectsAction[]}
 */
const toActions = (action: IEffectsAction, result): IEffectsAction[] => {
  const initialData = action.data;
  const initialType = action.initialType;
  let chainedActions: IEffectsAction[];

  if (Array.isArray(result)) {
    chainedActions = result
      .filter((resultItem) => resultItem instanceof EffectsAction)
      .map((resultAction: IEffectsAction): IEffectsAction => ({ ...resultAction, initialData, initialType }));

    if (chainedActions.length > 0) {
      // Return chained effects actions
      return chainedActions;
    }
  } else if (result instanceof EffectsAction) {
    // Return chained effects action
    return [{ ...result, initialData, initialType }];
  }
  return [
    // Default result done action
    {
      type: EffectsActionBuilder.buildDoneActionType(action.type),
      data: result,
      initialData,
      initialType,
    }
  ];
};

/**
 * @stable [20.06.2024]
 * @param payload
 */
export const effectsMiddleware = <TState>(payload: MiddlewareAPI<TState>) => (
  (next: <TAction extends IEffectsAction>(action: TAction) => TAction) => <TAction extends IEffectsAction>(initialAction: TAction) => {

    const { dispatch } = payload as IEffectsMiddlewareAPI;
    const initialData = initialAction.data;
    const initialType = initialAction.type;

    const proxy = EffectsService.fromEffectsMap(initialType);
    const nextActionResult = next(initialAction);

    if (!isFn(proxy)) {
      // Native redux behavior (!)
      return nextActionResult;
    }

    const dispatchError = (error: Error) => {
      logger.error('[effectsMiddleware] The error:', error);
      pushGlobalError(error);

      dispatch({
        type: EffectsActionBuilder.buildErrorActionType(initialType),
        error,
        initialData,
        initialType,
      });
    };

    let proxyResult = null;
    try {
      proxyResult = proxy(initialAction);
    } catch (error) {
      logger.error('[effectsMiddleware] The error:', error);

      dispatchError(error);

      // Chain stop. The effect returns nothing, because error (!)
      return null;
    }

    if (!isDefined(proxyResult)) {
      // Chain stop. The effect returns nothing (!)
      return nextActionResult;
    }

    const dispatchCallback = ($nextAction: IEffectsAction) => dispatch({ ...$nextAction, initialData, initialType });

    if (isPromiseLike(proxyResult)) {
      // Bluebird Promise supporting
      // The effect returns a promise object - we must build an async (!) chain

      proxyResult.then(
        (result) => toActions(initialAction, result).forEach(dispatchCallback),
        (error) => dispatchError(error)
      );
    } else {
      toActions(initialAction, proxyResult).forEach(dispatchCallback);
    }
    return nextActionResult;
  });
