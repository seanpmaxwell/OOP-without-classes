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

export default createPrivateStore;
