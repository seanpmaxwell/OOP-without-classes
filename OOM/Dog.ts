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

const _store = createPrivateStore<IDog, DogState>();

/******************************************************************************
                               Static Functions
******************************************************************************/

/**
 * Create a new dog. Animal.create generates the id, and its snapshot becomes
 * the animal half of the dog's state.
 *
 * @static
 */
function create(state: Omit<DogState, 'id'>): IDog {
  const { breed, ...animal } = state;
  return _new({ ...Animal.create(animal).toJSON(), breed });
}

/**
 * Build a dog from a plain object. Only the field this module adds is checked
 * here. Animal.from validates the inherited fields and throws on its own.
 *
 * @static
 */
function from(val: unknown): IDog {
  if (!_validate(val)) throw new Error('Invalid Dog state');
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
function breed(this: IDog): string {
  return _store(this).breed;
}

/**
 * Human-readable summary. JavaScript calls this for template literals and
 * String(dog), so `${dog}` works too.
 *
 * @instance
 */
function toString(this: IDog): string {
  const { name, breed, age, weight } = _store(this);
  return `${name} the ${breed}, age ${age}, ${weight} kg`;
}

/**
 * Overrides Animal's toJSON. The body is the same, since the one state object
 * already holds every field. The override exists to narrow the return type.
 *
 * @instance
 */
function toJSON(this: IDog): DogState {
  return { ..._store(this) };
}

/******************************************************************************
                              Private Functions
******************************************************************************/

/**
 * Build the instance. Animal.extend returns one object carrying both modules'
 * functions and registers it in Animal's store with this state. Registering
 * the same state object here means there is exactly one copy of the dog's
 * data, and both modules read and write it.
 *
 * @private
 */
function _new(state: DogState): IDog {
  const self: IDog = Animal.extend({ ...InstanceFunctions }, state);
  _store.init(self, state);
  return self;
}

/**
 * Shape and invariant for the field this module adds. The rest is Animal's
 * job.
 *
 * @private
 */
function _validate(val: unknown): val is { breed: string } {
  if (typeof val !== 'object' || val === null) return false;
  const breed = (val as Record<string, unknown>).breed;
  return typeof breed === 'string' && breed.trim() !== '';
}

/******************************************************************************
                                    Export
******************************************************************************/

export default StaticFunctions;
