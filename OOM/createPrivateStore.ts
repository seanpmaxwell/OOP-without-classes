/******************************************************************************
                                    Types
******************************************************************************/

interface PrivateStore<K extends object, V extends object> {
  (key: K): V;
  readonly init: (key: K, value: V) => V;
  readonly has: (key: unknown) => key is K;
}

/******************************************************************************
                                  Functions
******************************************************************************/

/**
 * Create an accessor that keeps private state in a module-scoped WeakMap.
 * Nothing is attached to the object itself, so the state is unreachable from
 * outside this module by any means. Entries are released when the object is
 * garbage collected.
 */
function createPrivateStore<K extends object, V extends object>(): PrivateStore<K, V> {
  const store = new WeakMap<K, V>();

  const accessor = (key: K): V => {
    const value = store.get(key);
    if (value === undefined) {
      throw new Error('Private state accessed before initialization');
    }
    return value;
  };

  const init = (key: K, value: V): V => {
    if (store.has(key)) {
      throw new Error('Private state initialized twice for the same object');
    }
    store.set(key, value);
    return value;
  };

  const has = (key: unknown): key is K => {
    return typeof key === 'object' && key !== null && store.has(key as K);
  };

  return Object.assign(accessor, { init, has });
}

/******************************************************************************
                                    Export
******************************************************************************/

export default createPrivateStore;
