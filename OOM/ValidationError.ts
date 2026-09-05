import createPrivateStore from './createPrivateStore.ts';

/******************************************************************************
                                    Types
******************************************************************************/

export interface IValidationError {
  path(path?: string[]): string[];
  message(message?: string): string;
  toJSON(): State;
}

export interface State {
  path: string[];
  message: string;
}

/******************************************************************************
                                  Variables
******************************************************************************/

const _state = createPrivateStore<IValidationError, State>();

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create a new error, optionally copying the state of an existing one.
 */
function from(verr?: IValidationError): IValidationError {
  const self: IValidationError = { path, message, toJSON };
  _state.init(self, _initState(verr));
  return self;
}

/**
 * Should only be called by "from". Array/object fields must be copied so the
 * new error holds no references into the source error.
 */
function _initState(verr?: IValidationError): State {
  return {
    path: verr ? [...verr.path()] : [],
    message: verr ? verr.message() : '',
  };
}

/**
 * Create a new error from a message and an optional path.
 */
function of(message: string, path?: string[]): IValidationError {
  const verr = from(),
    state = _state(verr);
  state.message = message;
  if (path) {
    state.path = [...path];
  }
  return verr;
}

/**
 * Runtime type guard. Only objects created by "from" or "of" pass.
 */
function is(val: unknown): val is IValidationError {
  return _state.has(val);
}

/******************************************************************************
                              Instance Functions
******************************************************************************/

/**
 * Get the path, or set it when an argument is passed. A copy is returned so
 * callers cannot mutate the internal array.
 */
function path(this: IValidationError, path?: string[]): string[] {
  const state = _state(this);
  if (path) {
    state.path = [...path];
  }
  return [...state.path];
}

/**
 * Get the message, or set it when an argument is passed.
 */
function message(this: IValidationError, message?: string): string {
  const state = _state(this);
  if (message !== undefined) {
    state.message = message;
  }
  return state.message;
}

/**
 * Called by JSON.stringify. Returns a snapshot of the private state.
 */
function toJSON(this: IValidationError): State {
  const state = _state(this);
  return { path: [...state.path], message: state.message };
}

/******************************************************************************
                                    Export
******************************************************************************/

export default {
  from,
  of,
  is,
} as const;
