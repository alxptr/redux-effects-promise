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
      .map((resultAction: IEffectsAction): IEffectsAction => ({...resultAction, initialData, initialType}));

    if (chainedActions.length > 0) {
      // Return chained effects actions
      return chainedActions;
    }
  } else if (result instanceof EffectsAction) {
    // Return chained effects action
    return [{...result, initialData, initialType}];
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
 * @stable [10.01.2020]
 * @param {MiddlewareAPI<TState>} payload
 * @returns {(next: (action: IEffectsAction) => IEffectsAction) => (initialAction: IEffectsAction) => (IEffectsAction | undefined)}
 */
export const effectsMiddleware = <TState>(payload: MiddlewareAPI<TState>) => (
  (next: <TAction extends IEffectsAction>(action: TAction) => TAction) => <TAction extends IEffectsAction>(initialAction: TAction) => {
    const {dispatch} = payload as IEffectsMiddlewareAPI;
    const proxy = EffectsService.fromEffectsMap(initialAction.type);

    if (!isFn(proxy)) {
      // Native redux behavior (!)
      return next(initialAction);
    }

    const initialData = initialAction.data;
    const initialType = initialAction.type;
    const proxyResult = proxy(initialAction);
    if (!isDefined(proxyResult)) {
      // Stop chaining. An effect does return nothing (!)
      return next(initialAction);
    }

    const nextActionResult = next(initialAction);
    const dispatchCallback = ($nextAction: IEffectsAction) => dispatch({...$nextAction, initialData, initialType});
    if (isPromiseLike(proxyResult)) {
      // Bluebird Promise supporting
      // An effect does return a promise object - we should build the async chain (!)

      (proxyResult as Promise<{}>)
        .then(
          (result) => toActions(initialAction, result).forEach(dispatchCallback),
          (error) => {
            logger.error('[effectsMiddleware] The error:', error);
            pushGlobalError(error);
            dispatch({type: EffectsActionBuilder.buildErrorActionType(initialAction.type), error, initialData, initialType});
          }
        );
    } else {
      toActions(initialAction, proxyResult).forEach(dispatchCallback);
    }
    return nextActionResult;
  });
