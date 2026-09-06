import createPrivateStore from './createPrivateStore.ts';
import Animal, { type IAnimal, type AnimalState } from './Animal.ts';

/******************************************************************************
                                    Types
******************************************************************************/

// Extending the interface is fine. It is only a type, and it lets a dog be
// passed anywhere an animal is expected.
export interface IDog extends IAnimal {
  breed(): string;
  toString(): string;
  toJSON(): DogState;
}

// One state object for the whole dog. Animal's store and this module's store
// both point at the same object.
export interface DogState extends AnimalState {
  breed: string;
}

/******************************************************************************
                                  Variables
******************************************************************************/

const _store = createPrivateStore<IDog, DogState>();

const StaticFns = {
  create,
  of,
  from,
  is,
  extend,
  defaults,
} as const;

// Only what Dog adds or overrides. id, name, age, weight, and rename come from
// Animal.extend and are never redefined here.
const InstanceFns = {
  breed,
  toString,
  toJSON,
} as const;

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create a new dog with a generated id. Anything not passed comes from
 * "defaults". Goes through "from" so the same invariants apply whether the
 * data came from code or from IO.
 *
 * @static
 */
function create(params: Partial<Omit<DogState, 'id'>> = {}): IDog {
  return from({ id: crypto.randomUUID(), ...defaults(), ...params });
}

/**
 * Positional shorthand for the common case. Builds from the constituent values
 * the way Array.of does, and defers to "create" for everything else.
 *
 * @static
 */
function of(name: string, breed: string, age?: number): IDog {
  return create(age === undefined ? { name, breed } : { name, breed, age });
}

/**
 * Build a dog from a plain object. Only the field this module adds is checked
 * here. Animal.from validates the inherited fields and throws on its own.
 *
 * @static
 */
function from(val: unknown): IDog {
  if (!validate(val)) throw new Error('Invalid Dog state');
  return _new({ ...Animal.from(val).toJSON(), breed: val.breed });
}

/**
 * Runtime type guard. Only objects created by this module pass.
 *
 * @static
 */
function is(val: unknown): val is IDog {
  return _store.has(val);
}

/**
 * Animal's defaults plus the one field Dog adds.
 *
 * @static
 */
function defaults(): Omit<DogState, 'id'> {
  return { ...Animal.defaults(), breed: 'Unknown' };
}

/**
 * Composition hook, so the chain can continue past Dog. Adds Dog's functions
 * to the target in place, then hands the same object and state to
 * Animal.extend. Anything already on the target wins.
 *
 * @static
 */
function extend<T extends Partial<IDog>>(target: T, state: DogState): T & IDog {
  const self = _store.init(InstanceFns, state, target);
  return Animal.extend(self, state);
}

/******************************************************************************
                              Instance Functions
******************************************************************************/

/**
 * @instance
 */
function breed(state: DogState): string {
  return state.breed;
}

/**
 * Human-readable summary. JavaScript calls this for template literals and
 * String(dog), so `${dog}` works too.
 *
 * @instance
 */
function toString(state: DogState): string {
  const { name, breed, age, weight } = state;
  return `${name} the ${breed}, age ${age}, ${weight} kg`;
}

/**
 * Overrides Animal's toJSON. The body is the same, since the one state object
 * already holds every field. The override exists to narrow the return type.
 *
 * @instance
 */
function toJSON(state: DogState): DogState {
  return { ...state };
}

/******************************************************************************
                              Private Functions
******************************************************************************/

/**
 * Build the instance. _store.init attaches Dog's functions and registers the
 * state in this module's store. Animal.extend then adds Animal's functions to
 * the same object, without touching the ones Dog defined, and registers the
 * same state object in Animal's store. One object, one state, two modules.
 *
 * @private
 */
function _new(state: DogState): IDog {
  const self = _store.init(InstanceFns, state);
  return Animal.extend(self, state);
}

/**
 * Shape and invariant for the field this module adds. The rest is Animal's
 * job.
 *
 * @private
 */
function validate(val: unknown): val is { breed: string } {
  if (typeof val !== 'object' || val === null) return false;
  const breed = (val as Record<string, unknown>).breed;
  return typeof breed === 'string' && breed.trim() !== '';
}

/******************************************************************************
                                    Export
******************************************************************************/

export default StaticFns;
