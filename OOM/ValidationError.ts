import createPrivateStore from './createPrivateStore.ts';

/******************************************************************************
                                    Types
******************************************************************************/

export interface IValidationError {
  path(path?: string[]): string[];
  message(message?: string): string;
  stack(): string | undefined;
  toJSON(): Omit<State, 'stack'>;
}

export interface State {
  path: string[];
  message: string;
  stack: string | undefined;
}

/******************************************************************************
                                  Variables
******************************************************************************/

const _state = createPrivateStore<IValidationError, State>();

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Starting point, from where all new instances originate.
 *
 * @static
 */
function from(verr?: IValidationError): IValidationError {
  const self: IValidationError = { path, message, stack, toJSON };
  const state: State = {
    path: verr ? [...verr.path()] : [],
    message: verr ? verr.message() : '',
    // Inheritance through composition: instead of extending Error, create a
    // real one and keep the part we want. A copy keeps the original's trace.
    stack: verr ? verr.stack() : new Error().stack,
  };
  _state.init(self, state);
  return self;
}

/**
 * Create a new error from a message and an optional path.
 *
 * @static
 */
function of(message: string, path?: string[]): IValidationError {
  const verr = from(),
    state = _state(verr);
  state.message = message;
  if (path) _setPath(state, path);
  return verr;
}

/**
 * Runtime type guard. Only objects created by "from" or "of" pass.
 *
 * @static
 */
function is(val: unknown): val is IValidationError {
  return _state.has(val);
}

/******************************************************************************
                              Instance Functions
******************************************************************************/

/**
 * Get the path, or set it when an argument is passed.
 *
 * @instance
 */
function path(this: IValidationError, path?: string[]): string[] {
  const state = _state(this);
  if (path) _setPath(state, path);
  return state.path;
}

/**
 * Get the message, or set it when an argument is passed.
 *
 * @instance
 */
function message(this: IValidationError, message?: string): string {
  const state = _state(this);
  if (message !== undefined) state.message = message;
  return state.message;
}

/**
 * The stack trace captured from a built-in Error when this instance was
 * created. Read-only.
 *
 * @instance
 */
function stack(this: IValidationError): string | undefined {
  return _state(this).stack;
}

/**
 * Called by JSON.stringify. Returns a snapshot of the private state. The
 * stack is left out so it never ends up in a response body.
 *
 * @instance
 */
function toJSON(this: IValidationError): Omit<State, 'stack'> {
  const state = _state(this);
  return { path: [...state.path], message: state.message };
}

/******************************************************************************
                              Private Functions
******************************************************************************/

/**
 * Private helpers have no "this", so state is passed in explicitly. Every
 * write to "path" goes through here, which makes it a single place to search
 * for and to enforce the copy.
 *
 * @private
 */
function _setPath(state: State, path: string[]): void {
  state.path = [...path];
}

/******************************************************************************
                                    Export
******************************************************************************/

export default {
  from,
  of,
  is,
} as const;
