/******************************************************************************
                                    Types
******************************************************************************/

interface StateAccessor<K extends object, V extends object> {
  (key: K): V;
  readonly init: (key: K, value: V) => V;
  readonly has: (key: unknown) => key is K;
}

/******************************************************************************
                                  Functions
******************************************************************************/

/**
 * Create an accessor that stores private state directly on an object under a
 * module-scoped symbol. The symbol never leaves this closure, so the state
 * cannot be reached by name, but it is still discoverable through
 * `Object.getOwnPropertySymbols()`, `Reflect.ownKeys()`, and devtools.
 */
function createStateAccessor<K extends object, V extends object>(
  description: string,
): StateAccessor<K, V> {
  const sym = Symbol(description);

  const accessor = (key: K): V => {
    const value = (key as Record<symbol, V | undefined>)[sym];
    if (value === undefined) {
      throw new Error('Private state accessed before initialization');
    }
    return value;
  };

  const init = (key: K, value: V): V => {
    // Non-enumerable, so spread, Object.assign, Object.keys, and
    // JSON.stringify all skip it.
    Object.defineProperty(key, sym, {
      value,
      enumerable: false,
      writable: false,
      configurable: false,
    });
    return value;
  };

  const has = (key: unknown): key is K => {
    return typeof key === 'object' && key !== null && sym in key;
  };

  return Object.assign(accessor, { init, has });
}

/******************************************************************************
                                    Export
******************************************************************************/

export default createStateAccessor;
