import createPrivateStore from './createPrivateStore.ts';

/******************************************************************************
                                    Types
******************************************************************************/

export interface IAnimal {
  id(): string;
  name(): string;
  age(): number;
  weight(): number;
  rename(name: string): void;
  toJSON(): AnimalState;
}

// The private state. It is also what toJSON returns and what "from" accepts.
// Exported so a child module can extend it.
export interface AnimalState {
  id: string;
  name: string;
  age: number;
  weight: number;
}

/******************************************************************************
                                  Variables
******************************************************************************/

const StaticFunctions = {
  create,
  from,
  is,
  extend,
} as const;

const InstanceFunctions = {
  id,
  name,
  age,
  weight,
  rename,
  toJSON,
} as const;

const _store = createPrivateStore<IAnimal, AnimalState>();

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create a new animal with a generated id.
 *
 * @static
 */
function create(state: Omit<AnimalState, 'id'>): IAnimal {
  return _new({ id: crypto.randomUUID(), ...state });
}

/**
 * Build an animal from a plain object, such as a database row or a parsed
 * request body. Throws if the value does not have the shape produced by
 * toJSON. Fields are copied one by one so the instance never aliases the
 * object it was built from.
 *
 * @static
 */
function from(val: unknown): IAnimal {
  if (!_validate(val)) throw new Error('Value is not a serialized Animal');
  return _new({ id: val.id, name: val.name, age: val.age, weight: val.weight });
}

/**
 * Runtime type guard. Passes objects created by this module and objects that
 * were given an animal through "extend".
 *
 * @static
 */
function is(val: unknown): val is IAnimal {
  return _store.has(val);
}

/**
 * Composition hook for other modules. Returns a new object holding the
 * target's own properties plus Animal's instance functions, registered in
 * this module's store with the given state. The child should register the
 * same state object in its own store, so that both modules read and write
 * one object. Properties already on the target win, so a child can override.
 *
 * @static
 */
function extend<T extends object>(target: T, state: AnimalState): T & IAnimal {
  const self = { ...InstanceFunctions, ...target };
  _store.init(self, state);
  return self;
}

/******************************************************************************
                              Instance Functions
******************************************************************************/

/**
 * The id is assigned at creation and can never be changed.
 *
 * @instance
 */
function id(this: IAnimal): string {
  return _store(this).id;
}

/**
 * @instance
 */
function name(this: IAnimal): string {
  return _store(this).name;
}

/**
 * @instance
 */
function age(this: IAnimal): number {
  return _store(this).age;
}

/**
 * @instance
 */
function weight(this: IAnimal): number {
  return _store(this).weight;
}

/**
 * The only way to change the name from outside the module.
 *
 * @instance
 */
function rename(this: IAnimal, name: string): void {
  _store(this).name = name;
}

/**
 * Called by JSON.stringify. Returns a snapshot of the private state.
 *
 * @instance
 */
function toJSON(this: IAnimal): AnimalState {
  return { ..._store(this) };
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
function _new(state: AnimalState): IAnimal {
  const self: IAnimal = { ...InstanceFunctions };
  _store.init(self, state);
  return self;
}

/**
 * Structural check for the shape produced by toJSON.
 *
 * @private
 */
function _validate(val: unknown): val is AnimalState {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.age === 'number' &&
    typeof obj.weight === 'number'
  );
}

/******************************************************************************
                                    Export
******************************************************************************/

export default StaticFunctions;
