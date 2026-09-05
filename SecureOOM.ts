interface PrivateStore<K extends object, V extends object> {
  (key: K): V & { readonly patch: (partial: Partial<V>) => void };
  readonly init: (key: K, value: V) => V & { readonly patch: (partial: Partial<V>) => void };
  readonly has: (key: unknown) => key is K;
}

function createPrivateStore<K extends object, V extends object>(): PrivateStore<K, V> {
  const store = new WeakMap<K, V>();

  function getFull(key: K): V {
    const value = store.get(key);
    if (value === undefined) {
      throw new Error('Private state accessed before initialization');
    }
    return value;
  }

  function accessor(key: K): V & { patch: (partial: Partial<V>) => void } {
    return new Proxy({} as V & { patch: (partial: Partial<V>) => void }, {
      get(_, prop) {
        if (prop === 'patch') {
          return (partial: Partial<V>) => {
            store.set(key, { ...getFull(key), ...partial });
          };
        }
        return getFull(key)[prop as keyof V];
      },
      set(_, prop, value) {
        store.set(key, { ...getFull(key), [prop]: value });
        return true;
      },
    });
  }

  return Object.assign(accessor, {
    init(key: K, value: V) {
      store.set(key, value);
      return accessor(key);
    },
    has(key: unknown): key is K {
      return typeof key === 'object' && key !== null && store.has(key as K);
    },
  });
}

// --------- ValidationError.ts -------------

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


// -------- Playground -------

const verr = ValidationError.from();
verr.message('foo');

console.log(verr.message()); // => 'foo'
console.log(Object.keys(verr)); // => ['path', 'message', 'toJSON']
console.log(JSON.stringify(verr)); // => '{"path":[],"message":"foo"}'
console.log({ ...verr }); // => { path: [ƒ], message: [ƒ], toJSON: [ƒ] } — no private state leaked
console.log(ValidationError.is(verr)); // => true
console.log(ValidationError.is({ path: () => [], message: () => '', toJSON: () => ({} as State) })); // => false
