# Object-Oriented Programming Without Classes

[![CI](https://github.com/seanpmaxwell/OOP-without-classes/actions/workflows/ci.yml/badge.svg)](https://github.com/seanpmaxwell/OOP-without-classes/actions/workflows/ci.yml)

Using TypeScript modules as the unit of encapsulation, with `WeakMap`-backed
private state.

Each module does the job a class would normally do, so I call them
**Object-Oriented Modules**, or **OOM**. Private state sits in a `WeakMap`
only the module can see, so nothing outside can reach it, not even with
reflection. The idea descends from the factory-function and module patterns
that predate `class`; [Old school patterns](#old-school-patterns) covers what
changed.

| File | Purpose |
|---|---|
| [`src/Animal.ts`](src/Animal.ts) | A base module with `id`, `name`, `age`, and `weight` |
| [`src/Dog.ts`](src/Dog.ts) | Builds on `Animal` through composition, adding `breed` and `toString` |
| [`src/createPrivateStore.ts`](src/createPrivateStore.ts) | The `WeakMap` helper both modules use |
| [`src/playground.ts`](src/playground.ts) | Runnable demo with expected output in comments |
| [`src/*.test.ts`](src) | Tests on Node's built-in runner, including a third-level extension |

The only dependencies are dev ones: `typescript` and `@types/node`, the latter
so the tests type-check too. After `npm ci`, `npm run play`, `npm test`, and
`npm run check` run the playground, the tests, and a strict type-check on Node
22.18 or later.

---

## Why modules instead of classes

- **No prototype chain.** No `super()`, no `extends` chain, no wondering which
  ancestor a method came from. Composition covers it, see
  [Extending a module](#extending-a-module).
- **No `new`.** A factory is a normal function call.
- **Instances are plain objects.** Spread, `Object.entries`, structural typing,
  and generic serializers all just work. Mixins are object spreads.
- **Easy to stub.** The interface is an object shape, so a test double is an
  object literal.
- **No class-specific TypeScript gotchas.** No `strictPropertyInitialization`,
  no `private` keyword that's erased at compile time, no decorator churn.
- **State changes are easy to trace.** No function in a module has a `this`.
  Instance functions receive the state as their first parameter and private
  helpers are handed what they operate on, so searching for `state` finds
  every read and write. Any function can be unit tested by passing an object
  literal as the state.
- **Every function stays at the top level.** The module reads as a flat list
  of declarations, and the section separators in the file line up with it.

---

## The pattern

A module exports a few static functions, here `create`, `of`, `from`, `is`,
`extend`, and `defaults`. The constructors return a plain object whose
properties are functions declared once at the top of the module. Each of those
is written with the instance's state as its first parameter, and a private
store hands the state in.

```ts
import Dog from './src/Dog.ts';

const dog = Dog.create({ name: 'Rex', age: 3, weight: 20, breed: 'Labrador' });
const pup = Dog.create({ name: 'Bo' }); // partial, the rest from Dog.defaults()
const ivy = Dog.of('Ivy', 'Beagle', 2);  // positional shorthand

dog.name();            // 'Rex'
dog.id();              // a generated UUID, fixed for the life of the object
`${dog}`;              // 'Rex the Labrador, age 3, 20 kg'
dog.rename('Max');     // the only way to change the name
dog.rename('  ');      // throws, a name cannot be blank

JSON.stringify(dog);   // {"id":"...","name":"Max","age":3,"weight":20,"breed":"Labrador"}
Dog.is(dog);           // true
Dog.is({ ...dog });    // false, see "Extending a module"
Dog.from(row);         // rebuilt from a plain object, throws on a bad shape
```

The names match the rest of JavaScript: `create` like `document.createElement`,
`of` like `Array.of`, `from` like `Array.from`. `create` goes through `from`,
so the same invariants apply whether data came from code or from IO.

### How the private state works

`createPrivateStore` returns an object with two functions:

```ts
const _store = createPrivateStore<IAnimal, AnimalState>();
const InstanceFunctions = { id, name, age, weight, rename, toJSON } as const;

_store.init(InstanceFunctions, state);         // new instance: functions + state
_store.init(InstanceFunctions, state, target); // same, done to an existing object in place
_store.has(val);                               // was this object built here?
```

The instance is the `WeakMap` key and the state object is the value. Nothing
is added to the instance, and the entry goes when the instance is collected.
`init` wraps each function, once per module, in a copy that looks the state
up from `this` and passes it along. The originals never see `this`:

```ts
function rename(state: AnimalState, name: string): void {
  if (!isName(name)) throw new Error('Animal name cannot be blank');
  state.name = name;
}
```

There's deliberately no way to ask the store for an object's state. The only
code that sees it is the set of functions handed to `init`.

### Old school patterns

Factory functions and the module pattern are old. Crockford was writing about
both before ES5, and the usual way to get private state was a closure:

```js
function createAnimal(name) {
  var state = { name: name };
  return { name: function () { return state.name; } };
}
```

I kept the shape and changed what hasn't aged well:

- **Functions are shared.** The closure version builds new function objects
  for every instance. Here each is declared once and handed its state by the
  store, so instances share functions like class instances share prototype
  methods.
- **Privacy is stronger.** Closure state was private until a method returned
  it by accident. A `WeakMap` in module scope can't be reached from outside no
  matter what a function returns.
- **The module is native and the types are real.** No IIFE. `IAnimal`,
  `AnimalState`, and the typed `state` parameter give the compiler the same
  picture a class would.
- **`is` is a decision.** The old pattern had no answer to `instanceof`. Here
  the runtime check is a function you own, see
  [Working with IO data](#working-with-io-data).

### Extending a module

With classes you'd write `class Dog extends Animal`. Here `DogState` extends
`AnimalState`, `Animal` exports one hook called `extend`, and `Dog` builds on
it:

```ts
// Animal.ts
function extend<T extends Partial<IAnimal>>(target: T, state: AnimalState): T & IAnimal {
  return _store.init(InstanceFunctions, state, target);
}

// Dog.ts
function _new(state: DogState): IDog {
  const self = _store.init(InstanceFunctions, state);
  return Animal.extend(self, state);
}
```

Dog's `init` makes an object with Dog's three functions and registers it in
Dog's store. `Animal.extend` adds Animal's functions to that same object, in
place, and registers it in Animal's store with the same state. One instance,
one state object, two modules. `Dog.ts` never mentions `id`, `name`, `age`,
`weight`, or `rename`, and both `Dog.is(dog)` and `Animal.is(dog)` are `true`.

- **Whatever was there first stays.** `extend` only adds functions the target
  lacks, so a child's definition wins. The `Partial<IAnimal>` constraint makes
  the compiler check each override against the parent's signature.
- **There is no `super`.** An override replaces the parent's function
  outright. `Dog.toJSON` gets away with it because the shared state lets it
  produce the same result on its own.
- **Validation composes.** `Dog.from` checks `breed` and hands the value to
  `Animal.from`, which validates the rest and throws its own error.
- **Spreading an instance breaks it.** `{ ...dog }` is a new object neither
  store has seen. State is keyed by identity, which is also what makes `is`
  trustworthy.
- **The chain continues.** `Dog` exports `extend` too. `Dog.test.ts` builds a
  throwaway `Puppy` on it, overriding `toString` while keeping `breed` from
  Dog and `name` from Animal.

The cost is that each parent has to opt in with an `extend`, which is a bit
of what inheritance was. A module that doesn't export one can't be extended,
which I'm fine with as a default.

---

## Why a `WeakMap` for private state

The state isn't attached to the object at all, so `Object.keys`,
`JSON.stringify`, `Reflect.ownKeys`, `Object.getOwnPropertySymbols`, and
devtools inspection turn up nothing. `#private` fields still show in devtools,
and a `symbol`-keyed property is still found through reflection. Nothing can
be copied by accident either: `{ ...instance }` has no private property to
copy. Keys are held weakly, so state goes when the instance does.

That makes the pattern safe when an object crosses a trust boundary: another
npm package, a browser extension, a plugin, untrusted user script. The costs
are that you can't see the state by looking at the object, and a `WeakMap`
lookup is slightly slower than a property read.

---

## Working with IO data

Anything that crosses an IO boundary comes back as a plain object. A class
instance that's been through `JSON.stringify` and `JSON.parse` has no
prototype: `instanceof` is `false` and the methods are gone. The only fix is an
explicit constructor call at every boundary. Miss one and an `instanceof`
check downstream quietly takes the wrong branch, and there's nothing to
configure, because the check is fixed by the language.

Here the runtime check is a function you own. `is` asks the `WeakMap`, so a
parsed row is `false` for the same reason `instanceof` would be, but that's a
choice. The example keeps `is` strict and gives `from` the job of turning raw
data into a real instance:

```ts
const row: unknown = JSON.parse(body);
Dog.is(row);           // false, it's a plain object
Dog.is(Dog.from(row)); // true, or from() threw
```

Hydration still has to happen somewhere. It happens once, next to `is`,
instead of at every place data enters the system.

---

## Trade-offs

- **Not for plain data.** If something has no behavior and no invariant to
  protect, declare a type and move on.
- **Weaker compile-time guarantees.** Any object with the right shape
  type-checks, even if it never went through the factory. `is` is the runtime
  fallback.
- **No `instanceof`.** Narrowing goes through each module's `is`. Nothing
  walks a chain for you.
- **Extension is opt-in.** A parent written without `extend` has to change
  before a child can exist.
- **Detached calls still throw.** The wrapper `init` puts on the instance
  reads `this`, so `const n = dog.name; n()` fails like a detached method.
- **State is mutable, in place.** The store holds one reference, so an
  instance function can't swap in a new state object. Copy-on-write would
  need store support.
- **`init` is real type machinery.** About thirty lines of mapped types and
  overloads in one file, taken on trust.
- **It looks unfamiliar.** Most TypeScript readers expect classes.
