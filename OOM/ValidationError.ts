import createPrivateStore from './createPrivateStore.ts';

/******************************************************************************
                                    Types
******************************************************************************/

export interface IValidationError {
  path(path?: string[]): string[];
  message(message?: string): string;
  stack(): string | undefined;
  toJSON(): Json;
}

// The shape produced by toJSON and accepted by "from".
export interface Json {
  path: string[];
  message: string;
}

export interface State extends Json {
  stack: string | undefined;
}

/******************************************************************************
                                  Variables
******************************************************************************/

const StaticFunctions = {
  create,
  of,
  clone,
  from,
  is,
} as const;

const InstanceFunctions = {
  path,
  message,
  stack,
  toJSON,
} as const;

const _store = createPrivateStore<IValidationError, State>();

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create an empty error. The message and path can be filled in afterwards
 * through the instance functions.
 *
 * @static
 */
function create(): IValidationError {
  return _new({ message: '', path: [], stack: new Error().stack });
}

/**
 * Create a new error from a message and an optional path. Inheritance through
 * composition: instead of extending Error, create a real one and keep the part
 * we want, its trace.
 *
 * @static
 */
function of(message: string, path?: string[]): IValidationError {
  return _new({
    message,
    path: path ? [...path] : [],
    stack: new Error(message).stack,
  });
}

/**
 * Clone an existing error. The clone shares no state with the source but keeps
 * its trace, so the original point of failure is not lost.
 *
 * @static
 */
function clone(verr: IValidationError): IValidationError {
  return _new({
    message: verr.message(),
    path: [...verr.path()],
    stack: verr.stack(),
  });
}

/**
 * Build an error from a plain object, such as one parsed from a request body.
 * Throws if the value does not have the shape produced by toJSON.
 *
 * @static
 */
function from(val: unknown): IValidationError {
  if (!_validate(val)) throw new Error('Value is not a serialized ValidationError');
  return of(val.message, val.path);
}

/**
 * Runtime type guard. Only objects created by this module pass.
 *
 * @static
 */
function is(val: unknown): val is IValidationError {
  return _store.has(val);
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
  const state = _store(this);
  if (path) state.path = [...path];
  return state.path;
}

/**
 * Get the message, or set it when an argument is passed.
 *
 * @instance
 */
function message(this: IValidationError, message?: string): string {
  const state = _store(this);
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
  return _store(this).stack;
}

/**
 * Called by JSON.stringify. Returns a snapshot of the private state. The
 * stack is left out so it never ends up in a response body.
 *
 * @instance
 */
function toJSON(this: IValidationError): Json {
  const state = _store(this);
  return { path: [...state.path], message: state.message };
}

/******************************************************************************
                              Private Functions
******************************************************************************/

/**
 * Create a bare instance and attach its state. Every public constructor goes
 * through here.
 *
 * @private
 */
function _new(state: State): IValidationError {
  const self: IValidationError = { ...InstanceFunctions };
  _store.init(self, state);
  return self;
}

/**
 * Structural check for the shape produced by toJSON.
 *
 * @private
 */
function _validate(val: unknown): val is Json {
  return (
    typeof val === 'object' && val !== null &&
    typeof (val as Json).message === 'string' &&
    Array.isArray((val as Json).path) &&
    (val as Json).path.every((p) => typeof p === 'string')
  );
}

/******************************************************************************
                                    Export
******************************************************************************/

export default StaticFunctions;
