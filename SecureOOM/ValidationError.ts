
// --------- Types

interface IValidationError {
  path(_?: string[]): string[];
  message(_?: string): string;
  toJSON(): State;
}

interface State {
  path: string[];
  message: string;
}

// ------ Init ---------

const _state = createPrivateStore<IValidationError, State>();

// ---- static functions ----

function from(verr?: IValidationError): IValidationError {
  const self: IValidationError = {
    path,
    message,
    toJSON,
  };
  _state.init(self, _initState(verr));
  return self;
}

// Should only be called by .from. Need to make sure any array/object
// fields are copied so no hanging references into the source error.
function _initState(verr?: IValidationError): State {
  return {
    path: verr ? [...verr.path()] : [],
    message: verr ? verr.message() : '',
  };
}

function of(message: string, path?: string[]): IValidationError {
  const verr = from();
  // OR
  _state(verr).patch({
    message,
    path: path ? [...path] : [],
   });
  return verr;
}

function is(val: unknown): val is IValidationError {
  return _state.has(val);
}

// ---- Instance functions ----

function path(this: IValidationError, path?: string[]): string[] {
  if (path) _state(this).path = [...path];
  return state.path;
}

function message(this: IValidationError, message?: string): string {
  if (message) _state(this).message = message;
  return state.message;
}

function toJSON(this: IValidationError): State {
  return { ..._state(this) };
}

// ---- Export ----- //

export default {
  from,
  of,
  is,
} as const;

