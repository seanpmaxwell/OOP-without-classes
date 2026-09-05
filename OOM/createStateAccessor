
function createStateAccessor<T extends object, S extends object>(desc: string) {
  const sym = Symbol(desc);
  // Init the function
  const getState = (key: T): S => {
    const value = (key as Record<symbol, S>)[sym];
    if (value === undefined) {
      throw new Error('Private state accessed before initialization');
    }
    return value;
  }
  // Add the accessor for the symbol
  return Object.assign(getState, {
    getSymbol(): symbol {
      return sym;
    },
  });
}

export default createStateAccessor;
