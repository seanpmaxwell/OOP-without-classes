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
                               Static Functions
******************************************************************************/

/**
 * Create a new dog with a generated id. Anything not passed comes from
 * "defaults". Goes through "from" so the same invariants apply whether the
 * data came from code or from IO.
 *
 * @static
 */
function create(this: DogModule): IDog {
  const newDog = this._self.new();
  // this._self.state() <-- state function not present on static function
  newDog.id = crypto.randomUUID();
  return newDog;
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
function is(this: DogModule, val: unknown): val is IDog {
  return this._self.is(val);
}

/**
 * Animal's defaults plus the one field Dog adds.
 *
 * @static
 */
function getDefaultState(): Omit<DogState, 'id'> {
  return { ...Animal.defaults(), breed: 'Unknown' };
}

// /**
//  * Composition hook, so the chain can continue past Dog. Adds Dog's functions
//  * to the target in place, then hands the same object and state to
//  * Animal.extend. Anything already on the target wins.
//  *
//  * @static
//  */
// function extend<T extends Partial<IDog>>(target: T, state: DogState): T & IDog {
//   const self = _store.init(InstanceFns, state, target);
//   return Animal.extend(self, state);
// }

/******************************************************************************
                              Instance Functions
******************************************************************************/

/**
 * @instance
 */
function breed(this: DogModule): string {
  return this._self.state().breed;
}

/**
 * Human-readable summary. JavaScript calls this for template literals and
 * String(dog), so `${dog}` works too.
 *
 * @instance
 */
function toString(state: DogState): string {
  const { name, breed, age, weight } = this._self.state();
  return `${name} the ${breed}, age ${age}, ${weight} kg`;
}

/**
 * Overrides Animal's toJSON. The body is the same, since the one state object
 * already holds every field. The override exists to narrow the return type.
 *
 * @instance
 */
function toJSON(state: DogState): DogState {
  return { ...this._self.state() };
}

/******************************************************************************
                              Private Functions
******************************************************************************/

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

export default {
  create,
  of,
  from,
  is,
  extend,
  defaults,
  bindPrivateState({
    state: getDefaultState,
    fns: {
      breed,
      toString,
      toJSON,
    },
  }),
} as const;
