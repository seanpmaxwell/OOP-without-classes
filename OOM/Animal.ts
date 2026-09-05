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
 * Create a new animal with a generated id. Goes through "from" so the same
 * invariants apply whether the data came from code or from IO.
 *
 * @static
 */
function create(state: Omit<AnimalState, 'id'>): IAnimal {
  return from({ id: crypto.randomUUID(), ...state });
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
  if (!_validate(val)) throw new Error('Invalid Animal state');
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
 * The only way to change the name from outside the module, which is what
 * lets it enforce that a name is never blank.
 *
 * @instance
 */
function rename(this: IAnimal, name: string): void {
  if (!_isName(name)) throw new Error('Animal name cannot be blank');
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
 * Shape and invariants together: the fields toJSON produces, a non-blank
 * name, and non-negative finite numbers.
 *
 * @private
 */
function _validate(val: unknown): val is AnimalState {
  if (typeof val !== 'object' || val === null) return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    _isName(obj.name) &&
    _isMeasure(obj.age) &&
    _isMeasure(obj.weight)
  );
}

/**
 * @private
 */
function _isName(val: unknown): val is string {
  return typeof val === 'string' && val.trim() !== '';
}

/**
 * @private
 */
function _isMeasure(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0;
}

/******************************************************************************
                                    Export
******************************************************************************/

export default StaticFunctions;
