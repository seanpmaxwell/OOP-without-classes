# Object-Oriented Programming Without Classes

Using TypeScript modules as the unit of encapsulation, with `WeakMap`-backed
private state.

Each module does the job a class would normally do, so I've been calling them
**Object-Oriented Modules**, or **OOM** for short. The private state sits in a
`WeakMap` that only the module can see, which means nothing outside the module
can get at it, not even with reflection.

None of this is new. Factory functions and the module pattern have been around
since long before `class` existed. The
[Old school patterns](#old-school-patterns) section goes over what I kept from
them and what I changed.

| File | Purpose |
|---|---|
| [`OOM/Animal.ts`](OOM/Animal.ts) | A base module with `id`, `name`, `age`, and `weight` |
| [`OOM/Dog.ts`](OOM/Dog.ts) | Builds on `Animal` through composition, adding `breed` and `toString` |
| [`OOM/createPrivateStore.ts`](OOM/createPrivateStore.ts) | The `WeakMap` helper both modules use for private state |
| [`OOM/playground.ts`](OOM/playground.ts) | Runnable demo with the expected output in comments |
| [`tsconfig.json`](tsconfig.json) | Strict compiler settings for type-checking the examples |
| [`package.json`](package.json) | No dependencies. Marks the repo as ESM and holds the two scripts below |

---

## Why modules instead of classes

### No inheritance machinery

1. **No prototype chain to reason about.** No `super()`, no fragile `extends`
   chain, no wondering which ancestor a method actually came from. Composition
   covers it, see [Extending a module](#extending-a-module).

2. **No `new` keyword.** A factory is a normal function call. Classes throw if
   you call them without `new`, and before strict-mode classes made that a
   hard error, forgetting `new` was a classic JavaScript bug.

### Composability

3. **Mixins are plain object spreads.** Pulling behavior from a few sources is
   `{ ...loggable(self), ...serializable(self) }`. Doing the same with classes
   means mixin functions that poke at prototypes, which is more indirection
   and harder to follow.

4. **Instances are plain objects.** They work with anything that expects one:
   spread, `Object.entries`, structural typing, generic serializers. There's no
   prototype to leak behavior into whoever consumes them.

### Flexibility and testing

5. **Easy to stub.** The "interface" is just an object shape, so a test double
   is an object literal. Nothing to extend, no mocking library needed to
   override a method.

6. **State lives in one place.** Every field an instance has is in a single
   object that only the instance functions can touch, and they change it in
   place. That's a narrower surface than class fields, where any method can
   assign to `this.x` from anywhere. It is not immutable, though: the store
   holds a reference to that one object, so an instance function can't swap
   it for a new one, and moving to copy-on-write updates would need support
   from the store itself.

### Tooling and language alignment

7. **None of the class-specific TypeScript gotchas.** No
   `strictPropertyInitialization` to satisfy, no `public`/`private`/`protected`
   keywords that get erased at compile time and give you no runtime privacy,
   no decorator churn.

8. **Functions can be tested on their own.** `rename` is a plain function of
   `(state, name)`. A test passes an object literal as the state and checks
   what came back or what changed. No instance, no store, no binding.

### Readability

9. **State changes are easy to trace.** No function in the module has a
   `this`. Instance functions receive the state as their first parameter, and
   private helpers are handed whatever they operate on. Every place state
   moves is visible at the call site, which makes it easy to search for. In a
   class, any method can reach `this` and mutate a field from anywhere, with
   nothing at the call site to tell you. In `Animal.ts`, searching for `state`
   finds every read and write there is, and the store itself has no getter to
   go around that.

10. **Every function stays at the top level.** Nothing is nested inside a class
    body or a factory closure, so the module reads as a flat list of
    declarations. Each function can be found, read, and moved on its own, and
    the section separators in the file line up with its structure.

---

## The pattern

A module exports a few static functions. In these examples they're
`defaults`, `create`, `from`, and `is`, and Dog adds a positional `of`. The constructors hand back a plain object whose properties
are functions declared once at the top of the module. Each of those functions
is written with the instance's state as its first parameter, and a private
store hands that state in. Nothing else can reach it.

```ts
import Dog from './OOM/Dog.ts';

const dog = Dog.create({ name: 'Rex', age: 3, weight: 20, breed: 'Labrador' });
const pup = Dog.create({ name: 'Bo' }); // partial, the rest comes from the module's defaults
const ivy = Dog.of('Ivy', 'Beagle', 2);  // positional shorthand, age is optional

dog.name();            // 'Rex'
dog.breed();           // 'Labrador'
dog.id();              // a generated UUID, fixed for the life of the object
`${dog}`;              // 'Rex the Labrador, age 3, 20 kg', via toString
dog.rename('Max');     // the only way to change the name
dog.rename('  ');      // throws, a name cannot be blank

Object.keys(dog);      // [ 'breed', 'toString', 'toJSON', 'id', 'name', 'age', 'weight', 'rename' ]
JSON.stringify(dog);   // {"id":"...","name":"Max","age":3,"weight":20,"breed":"Labrador"}
Dog.is(dog);           // true
Dog.is({ ...dog });    // false, see "Extending a module" below

const fromDb = Dog.from(row); // rebuilt from a plain object, throws on a bad shape
```

I picked the constructor names to match what the rest of JavaScript does.
`create` builds a new instance from its properties, like `document.createElement`
or an ORM's `Model.create`. It takes a partial, or nothing, and fills in the
gaps from `defaults()`, so `Dog.create()` is a valid dog. `defaults` is public
and returns a fresh object each call, and `Dog.defaults()` is built on
`Animal.defaults()` the same way the rest of Dog is built on Animal. `from` converts from some other representation, like
`Array.from` or `Buffer.from`. `of` builds from the constituent values, like
`Array.of`, and is just a positional front for `create`. `is` is the runtime
type guard.

### How the private state works

`createPrivateStore` returns an object with two functions on it:

```ts
const _store = createPrivateStore<IAnimal, AnimalState>();
const InstanceFunctions = { id, name, age, weight, rename, toJSON } as const;

_store.init(InstanceFunctions, state);         // new instance: functions + state
_store.init(InstanceFunctions, state, target); // same, done to an existing object in place
_store.has(val);                               // type guard: was this object built here?
```

There's deliberately no way to ask the store for an object's state. The only
code that ever sees it is the set of instance functions handed to `init`,
which get it as their first argument.

The instance is the `WeakMap` key and the state object is the value. Nothing
gets added to the instance itself, and when the instance is garbage collected
its entry goes with it.

`init` is what lets the instance functions stay free of `this`. They're
written like this:

```ts
function rename(state: AnimalState, name: string): void {
  if (!isName(name)) throw new Error('Animal name cannot be blank');
  state.name = name;
}
```

`init` wraps each one in a function that looks the state up from `this` and
passes it along, puts those copies on the object, and registers the state, all
in one call. The wrapping happens the first time a given functions object is
seen and is cached after that, so every instance shares the same function
objects. The originals never see `this`, which means a unit test can call
`rename({ id: '1', name: 'Rex', age: 3, weight: 20 }, 'Max')` with no instance
and no store involved.

### Old school patterns

Factory functions and the module pattern are old. Douglas Crockford was
writing about both before ES5, and for a long time the usual way to get
private state without prototypes was a closure:

```js
function createAnimal(name, age, weight) {
  var state = { name: name, age: age, weight: weight };
  return {
    name: function () { return state.name; },
    rename: function (n) { state.name = n; },
  };
}
```

I kept the basic shape, a function that returns a plain object, and changed
the parts that haven't aged well:

- **Functions are shared.** The closure version builds a brand new set of
  function objects for every instance, because each one has to close over its
  own `state`. Here every function is declared once at module scope and is
  handed its state by the `WeakMap` store. Instances share their functions the
  same way class instances share prototype methods, just without a prototype.
- **Privacy is stronger.** Closure state was only private until some method
  returned it by accident. A `WeakMap` in module scope can't be reached from
  outside the module no matter what an instance function returns.
- **The module is native.** No IIFE and no revealing-module boilerplate. The
  ES module is the boundary and its exports are the public surface.
- **The types are real.** `IAnimal`, `AnimalState`, and the typed `state`
  parameter on each instance function give the compiler the same picture of
  the object that a class declaration would.
- **`is` is a decision I get to make.** The old pattern had no real answer to
  `instanceof`. Here the runtime check is an ordinary function, and
  [Working with IO data](#working-with-io-data) goes into why that turns out
  to matter.

If you already know the closure pattern, this is that pattern with the
per-instance memory cost, the weak privacy, and the missing types dealt with.

### Extending a module

With classes you'd write `class Dog extends Animal`. Here `Dog`'s state type
extends `Animal`'s, `Animal` exports a single hook called `extend`, and `Dog`
builds itself on top of that:

```ts
// Animal.ts
function _new(state: AnimalState): IAnimal {
  return _store.init(InstanceFunctions, state);
}

function extend<T extends Partial<IAnimal>>(target: T, state: AnimalState): T & IAnimal {
  return _store.init(InstanceFunctions, state, target);
}

// Dog.ts
export interface DogState extends AnimalState {
  breed: string;
}

function _new(state: DogState): IDog {
  const self = _store.init(InstanceFunctions, state);
  return Animal.extend(self, state);
}
```

Dog's `_store.init` makes an object with Dog's three functions and registers it
in Dog's store. `Animal.extend` then adds Animal's functions to that same
object, in place, and registers it in Animal's store with the same state. So
there's one instance and one state object, and both modules know about it.
`id`, `name`, `age`, `weight`, and `rename` on a dog are Animal's actual
functions. `Dog.ts` doesn't redefine or forward them, it never mentions them at
all. When Animal's `rename` writes `state.name`, Dog's `toJSON` sees it,
because they're looking at the same object. Both `Dog.is(dog)` and
`Animal.is(dog)` come back `true`.

Some consequences of doing it this way:

- **Overriding is just "whatever was there first stays".** `extend` only adds
  functions the target doesn't already have, so anything the child defined
  wins. `Dog` overrides `toJSON`, and since the shared state already has every
  field, the body is identical to Animal's. The override is there to narrow
  the return type so it includes `breed`. The `Partial<IAnimal>` constraint on
  `extend` means the compiler checks each override against Animal's signature,
  so a child can't shadow `name` with something that returns a number.
- **There is no `super`.** An override replaces the parent's function
  outright. Animal's `InstanceFunctions` isn't exported, so a child can't call
  the version it displaced. `Dog.toJSON` gets away with this because the
  shared state lets it produce the same result on its own. A child that needs
  the parent's behaviour plus a bit more has to write the parent's part again.
- **Construction gets reused.** `Dog.create` goes through `Dog.from`, the same
  way `Animal.create` goes through `Animal.from`, so the breed invariant
  applies to both paths. `Dog.from` checks `breed` and hands the value to
  `Animal.from`, which validates the inherited fields, throws its own error if
  they're wrong, and builds the animal half. `Dog.ts` doesn't know anything
  about the animal's shape.
- **Interfaces can still extend.** `IDog extends IAnimal` is only a type, so a
  dog can go anywhere an `IAnimal` is expected. It's the implementation that
  isn't inherited.
- **Spreading an instance breaks it.** `{ ...dog }` makes a new object that
  neither store has seen, so its first method call throws. State is keyed by
  object identity, which means an object is only an instance if a module
  registered it. That's the same thing that makes `is` trustworthy, and it's
  why composition has to go through the parent's public API instead of around
  it.

The downside is that the parent has to opt in. `extend` only exists so other
modules can build on `Animal`, which is a bit of what inheritance was. On the
other hand it's one explicit function, and a module that doesn't export it
can't be extended, which I'm fine with as a default.

### Running the example

Node 22.18 and later strip types natively, so there's no build step and
nothing to install:

```bash
npm run play
```

To type-check under the strict settings in `tsconfig.json`:

```bash
npm run check
```

Both are one-liners in `package.json` if you'd rather call `node` and `tsc`
directly.

---

## Why a `WeakMap` for private state

1. **The privacy is real.** The state isn't attached to the object at all, so
   `Object.keys`, `JSON.stringify`, `Reflect.ownKeys`,
   `Object.getOwnPropertySymbols`, and devtools inspection of the instance all
   turn up nothing. `#private` class fields come close, but they still show up
   when you inspect the instance in devtools, and a `symbol`-keyed property can
   still be found through reflection.

2. **Nothing gets copied by accident.** `{ ...instance }` and
   `Object.assign({}, instance)` can't leak private state because there's no
   private property on the object to copy. Underscore-prefixed "private"
   properties, and enumerable symbol-keyed ones, do get copied.

3. **No memory leak.** `WeakMap` keys are held weakly, so state is released as
   soon as the instance is collected.

That makes the pattern safe when an object crosses a trust boundary: a
separate npm package, a browser extension, a third-party plugin, untrusted
user script, a different security realm. The costs are that you can't see the
state by looking at the object, which makes debugging a little less convenient,
and that a `WeakMap` lookup is slightly slower than a property read.

---

## Working with IO data

Anything that crosses an IO boundary comes back as a plain object. An HTTP
body, a database row, a file, a queue message that used to hold a class
instance has been through `JSON.stringify` and `JSON.parse`, and the prototype
didn't survive. `instanceof` is `false` now and the methods are gone.

Classes are fragile here because the only fix is an explicit constructor call
at every boundary, `new Dog(row.name, row.age, row.weight, row.breed)`. Miss
one and an `instanceof` check somewhere downstream quietly takes the wrong
branch. The check itself is fixed by the language, so there's nothing to
configure. The prototype chain is either intact or it isn't.

With this pattern the runtime check is a function you own. As written in this
repo, `is` asks the `WeakMap` whether it has seen the object, so a parsed row
comes back `false` for the same reason `instanceof` would. The difference is
that this is a choice. Since `is` is just a function, you can make it whatever
your boundary needs: keep it strict, make it structural, or split the two
concerns.

The example splits them. `is` stays strict, so only objects the module built
pass. `from` takes raw data, checks its shape with a private guard, and builds
a real instance:

```ts
function from(val: unknown): IDog {
  if (!validate(val)) throw new Error('Invalid Dog state');
  return _new({ ...Animal.from(val).toJSON(), breed: val.breed });
}
```

```ts
const row: unknown = JSON.parse(body);
Dog.is(row);           // false, it's a plain object
Dog.is(Dog.from(row)); // true
```

The hydration step still has to happen somewhere. It just happens once, in a
function that sits next to `is` and was written by the same person, instead of
being reinvented at every place data enters the system.

---

## Trade-offs

This isn't free. The costs I'd want to know about before adopting it:

- **Not for plain data.** If something has no behavior and no invariant to
  protect, declare a type and move on. The `WeakMap` and the instance
  functions only pay for themselves when there's something outside code
  shouldn't be able to do, like reassign an `id`.
- **Weaker compile-time guarantees.** Structural typing means any object with
  the right shape will type-check, even if it never went through the real
  factory. The exported `is` guard is the runtime fallback.
- **No `instanceof`.** Narrowing goes through each module's `is`. A dog passes
  both `Dog.is` and `Animal.is` because `extend` registered it in both stores,
  but there's no single operator that walks a chain for you.
- **Extension is opt-in.** A module can only be built on if it exports an
  `extend` hook. That's on purpose, but it means a parent written without one
  has to change before a child can exist.
- **Detached calls still throw.** The wrapper `init` puts on the instance is
  what reads `this`, so `const n = dog.name; n()` fails the same way a
  detached class method would. The functions themselves don't use `this`, but
  the copies on the instance have to.
- **`init` is real type machinery.** The mapped type that turns
  `(state, ...args) => R` into `(this, ...args) => R`, plus the overloads and
  the wrapper cache, is the one piece of the repo a reader has to take on
  trust. It's about thirty lines and lives in one file, but it's there.
- **It looks unfamiliar.** Most TypeScript readers expect classes, and the
  module-as-class layout takes a minute to get used to.
