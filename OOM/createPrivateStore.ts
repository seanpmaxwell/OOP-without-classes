/******************************************************************************
                                    Types
******************************************************************************/

// Instance functions as written inside a module: the state comes first.
type Unbound<V> = Record<string, (state: V, ...args: never[]) => unknown>;

// The same functions as placed on an instance: the state is looked up from
// "this" and the remaining parameters are kept.
type Bound<K, F> = {
  [P in keyof F]: F[P] extends (state: never, ...args: infer A) => infer R
    ? (this: K, ...args: A) => R
    : never;
};

interface PrivateStore<K extends object, V extends object> {
  readonly has: (key: unknown) => key is K;
  readonly init: {
    // Make a fresh instance from the functions and the state.
    <F extends Unbound<V>>(fns: F, state: V): Bound<K, F>;
    // Turn an existing object into an instance in place. This is how one
    // object can belong to more than one module.
    <F extends Unbound<V>, T extends object>(fns: F, state: V, target: T): T & Bound<K, F>;
  };
}

/******************************************************************************
                                  Functions
******************************************************************************/

/**
 * Create a store that keeps private state in a module-scoped WeakMap. Nothing
 * is attached to the object itself, so the state is unreachable from outside
 * this module by any means. Entries are released when the object is garbage
 * collected. The only way to read the state is to be one of the instance
 * functions handed to "init", which receive it as their first argument.
 */
function createPrivateStore<K extends object, V extends object>(): PrivateStore<K, V> {
  const store = new WeakMap<K, V>();
  // Wrapped copies of each functions object, built the first time it is seen
  // so every instance shares the same function objects.
  const bound = new WeakMap<object, Record<string, unknown>>();

  const get = (key: K): V => {
    const value = store.get(key);
    if (value === undefined) {
      throw new Error('Private state accessed before initialization');
    }
    return value;
  };

  const has = (key: unknown): key is K => {
    return typeof key === 'object' && key !== null && store.has(key as K);
  };

  // Each wrapper resolves the state from "this" and passes it in, so the
  // functions as written never see "this".
  const bind = (fns: Unbound<V>): Record<string, unknown> => {
    let wrapped = bound.get(fns);
    if (wrapped === undefined) {
      wrapped = {};
      for (const [name, fn] of Object.entries(fns)) {
        wrapped[name] = function (this: K, ...args: never[]) {
          return fn(get(this), ...args);
        };
      }
      bound.set(fns, wrapped);
    }
    return wrapped;
  };

  const init = (fns: Unbound<V>, state: V, target: object = {}): object => {
    // Anything already on the target wins, so a child can override.
    const self = Object.assign(target, { ...bind(fns), ...target }) as K;
    if (store.has(self)) {
      throw new Error('Private state initialized twice for the same object');
    }
    store.set(self, state);
    return self;
  };

  return { has, init } as PrivateStore<K, V>;
}

/******************************************************************************
                                    Export
******************************************************************************/

export default createPrivateStore;
