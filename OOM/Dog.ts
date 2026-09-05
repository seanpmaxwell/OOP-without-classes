import createPrivateStore from './createPrivateStore.ts';
import Animal, { AnimalDefaults, type IAnimal, type AnimalState } from './Animal.ts';

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

// Animal's defaults plus the one field Dog adds.
const DogDefaults = {
  ...AnimalDefaults,
  breed: 'Unknown',
} as const satisfies Omit<DogState, 'id'>;

const StaticFunctions = {
  create,
  from,
  is,
} as const;

// Only what Dog adds or overrides. id, name, age, weight, and rename come from
// Animal.extend and are never redefined here.
const InstanceFunctions = {
  breed,
  toString,
  toJSON,
} as const;

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create a new dog with a generated id. Anything not passed comes from
 * DogDefaults. Goes through "from" so the same invariants apply whether the
 * data came from code or from IO.
 *
 * @static
 */
function create(params: Partial<Omit<DogState, 'id'>> = {}): IDog {
  return from({ id: crypto.randomUUID(), ...DogDefaults, ...params });
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
  const self = _store.init(InstanceFunctions, state);
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

export default StaticFunctions;
