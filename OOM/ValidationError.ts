

// ------------------ Types

type State = {
  path: string[];
  message: string;
};

interface IValidationError extends Omit<Error, 'message'> {
  [key: symbol]: unknown; // holds private state under _state.getSymbol()
  path(_?: string[]): string[];
  message(_?: string): string;
  toJSON(): State;
}

// ------------------ Init

const _state = createStateAccessor();

// ---- Static functions

function from(verr?: IValidationError): IValidationError {
  const { message: _, ...other } = new Error();
  return {
    ...other,
    [_state.getSymbol()]: _initState(verr),
    path,
    message,
    toJSON,
  };
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
  _state(verr).message = message;
  if (path) _state(verr).path = [...path];
  return verr;
}

function is(val: unknown): val is IValidationError {
  return typeof val === 'object' && val !== null && _state.getSymbol() in val;
}

// ---- Instance functions

function path(this: IValidationError, path?: string[]): string[] {
  if (path) _state(this).path = [...path];
  return _state(this).path;
}

function message(this: IValidationError, message?: string): string {
  if (message) _state(this).message = message;
  return _state(this).message;
}

function toJSON(this: IValidationError): State {
  return { ..._state(this) };
}

// ---- Export

export default {
  from,
  of,
  is,
} as const;

