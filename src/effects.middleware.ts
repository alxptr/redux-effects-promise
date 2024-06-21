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

    const asNextAction = () => (
      /**
       * Actually forward the action to the reducer
       */
      next(initialAction)
    );

    const { dispatch } = payload as IEffectsMiddlewareAPI;
    const initialData = initialAction.data;
    const initialType = initialAction.type;

    const effect = EffectsService.fromEffectsMap(initialType);
    if (!isFn(effect)) {
      return asNextAction();
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

    let effectResult = null;
    try {
      /**
       * We must call the effect necessarily before next(action) so that the effect gets the previous state,
       * not the actual state - this is the pattern: the effect gets the previous state and the actual action
       * that changes that state
       */
      effectResult = effect(initialAction);
    } catch (error) {
      const nextActionOnError = asNextAction();
      dispatchError(error);
      return nextActionOnError;
    }

    if (!isDefined(effectResult)) {
      // Chain stop. The effect returns nothing (!)
      return asNextAction();
    }

    const dispatchCallback = ($nextAction: IEffectsAction) => dispatch({ ...$nextAction, initialData, initialType });
    const nextAction = asNextAction();

    if (isPromiseLike(effectResult)) {
      // Bluebird Promise supporting
      // The effect returns a promise object - we must build an async (!) chain

      effectResult.then(
        (result) => toActions(initialAction, result).forEach(dispatchCallback),
        (error) => dispatchError(error)
      );
    } else {
      toActions(initialAction, effectResult).forEach(dispatchCallback);
    }

    return nextAction;
  });
