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

const _store = createPrivateStore<IAnimal, AnimalState>();

const StaticFunctions = {
  create,
  of,
  from,
  is,
  extend,
  defaults,
} as const;

// Written with the state as their first parameter. _store.init attaches them
// to an object and registers its state in one step.
const InstanceFunctions = {
  id,
  name,
  age,
  weight,
  rename,
  toJSON,
} as const;

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create a new animal with a generated id. Anything not passed comes from
 * "defaults". Goes through "from" so the same invariants apply whether the
 * data came from code or from IO.
 *
 * @static
 */
function create(params: Partial<Omit<AnimalState, 'id'>> = {}): IAnimal {
  return from({ id: crypto.randomUUID(), ...defaults(), ...params });
}

/**
 * Positional shorthand for the common case. Builds from the constituent values
 * the way Array.of does, and defers to "create" for everything else.
 *
 * @static
 */
function of(name: string, age?: number, weight?: number): IAnimal {
  const params: Partial<Omit<AnimalState, 'id'>> = { name };
  if (age !== undefined) params.age = age;
  if (weight !== undefined) params.weight = weight;
  return create(params);
}

/**
 * Build an animal from a plain object, such as a database row or a parsed
 * request body. Throws if the value does not have the shape produced by
 * toJSON or breaks an invariant. Fields are copied one by one so the instance
 * never aliases the object it was built from.
 *
 * @static
 */
function from(val: unknown): IAnimal {
  if (!validate(val)) throw new Error('Invalid Animal state');
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
 * Composition hook for other modules. Adds Animal's instance functions to the
 * target in place and registers it in this module's store with the given
 * state. The child should register the same state object in its own store, so
 * that both modules read and write one object. Anything already on the target
 * wins, so a child can override, and the Partial<IAnimal> constraint makes the
 * compiler check that any override is compatible with Animal's signature.
 *
 * @static
 */
function extend<T extends Partial<IAnimal>>(target: T, state: AnimalState): T & IAnimal {
  return _store.init(InstanceFunctions, state, target);
}

/**
 * What "create" fills in for anything the caller leaves out. A fresh object
 * each call, so nothing is shared between instances. Must satisfy "validate".
 *
 * @static
 */
function defaults(): Omit<AnimalState, 'id'> {
  return {
    name: 'Unnamed',
    age: 0,
    weight: 0,
  };
}

/******************************************************************************
                              Instance Functions
******************************************************************************/

/**
 * The id is assigned at creation and can never be changed.
 *
 * @instance
 */
function id(state: AnimalState): string {
  return state.id;
}

/**
 * @instance
 */
function name(state: AnimalState): string {
  return state.name;
}

/**
 * @instance
 */
function age(state: AnimalState): number {
  return state.age;
}

/**
 * @instance
 */
function weight(state: AnimalState): number {
  return state.weight;
}

/**
 * The only way to change the name from outside the module, which is what
 * lets it enforce that a name is never blank.
 *
 * @instance
 */
function rename(state: AnimalState, name: string): void {
  if (!isName(name)) throw new Error('Animal name cannot be blank');
  state.name = name;
}

/**
 * Called by JSON.stringify. Returns a snapshot of the private state.
 *
 * @instance
 */
function toJSON(state: AnimalState): AnimalState {
  return { ...state };
}

/******************************************************************************
                              Private Functions
******************************************************************************/

/**
 * Build the instance. _store.init attaches the instance functions and
 * registers the state in one step.
 *
 * @private
 */
function _new(state: AnimalState): IAnimal {
  return _store.init(InstanceFunctions, state);
}

/**
 * Shape and invariants together: the fields toJSON produces, a non-blank
 * name, and non-negative finite numbers.
 *
 * @private
 */
function validate(val: unknown): val is AnimalState {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    isName(obj.name) &&
    isMeasure(obj.age) &&
    isMeasure(obj.weight)
  );
}

/**
 * @private
 */
function isName(val: unknown): val is string {
  return typeof val === 'string' && val.trim() !== '';
}

/**
 * @private
 */
function isMeasure(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

/******************************************************************************
                                    Export
******************************************************************************/

export default StaticFunctions;
