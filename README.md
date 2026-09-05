# Object-Oriented Programming Without Classes

A pattern for writing object-oriented TypeScript with factory functions and
modules instead of classes. Each module plays the role a class normally would,
which is why this repo calls one an **Object-Oriented Module**, or **OOM** for
short. Private state lives in a module-scoped `WeakMap`, so it is unreachable
from outside the module by any means.

The idea descends from the factory-function and module patterns that predate
`class`. What it keeps from them, and what it does differently, is covered in
[Prior art](#prior-art).

| File | Purpose |
|---|---|
| [`OOM/Animal.ts`](OOM/Animal.ts) | A base Object-Oriented Module with `id`, `name`, `age`, and `weight` |
| [`OOM/Dog.ts`](OOM/Dog.ts) | Builds on `Animal` through composition, adding `breed` and `toString` |
| [`OOM/createPrivateStore.ts`](OOM/createPrivateStore.ts) | The `WeakMap`-backed private state helper |
| [`OOM/playground.ts`](OOM/playground.ts) | Runnable demo with the expected output in comments |
| [`tsconfig.json`](tsconfig.json) | Strict compiler settings for type-checking the examples |

---

## The pattern

An Object-Oriented Module exports a small set of static functions. Here they
are `create`, `from`, and `is`. The constructors return a plain object whose
properties are functions declared once at module scope. Each of those
functions reads and writes its instance's state through a private store that
only this module can see.

```ts
import Dog from './OOM/Dog.ts';

const dog = Dog.create({ name: 'Rex', age: 3, weight: 20, breed: 'Labrador' });

dog.name();            // 'Rex'
dog.breed();           // 'Labrador'
dog.id();              // a generated UUID, fixed for the life of the object
`${dog}`;              // 'Rex the Labrador, age 3, 20 kg', via toString
dog.rename('Max');     // the only way to change the name
dog.rename('  ');      // throws, a name cannot be blank

Object.keys(dog);      // [ 'id', 'name', 'age', 'weight', 'rename', 'toJSON', 'breed', 'toString' ]
JSON.stringify(dog);   // {"id":"...","name":"Max","age":3,"weight":20,"breed":"Labrador"}
Dog.is(dog);           // true
Dog.is({ ...dog });    // false, see "Extending a module" below

const fromDb = Dog.from(row); // rebuilt from a plain object, throws on a bad shape
```

The constructors follow the names the rest of JavaScript uses. `create` builds
a new instance from its properties, as in `document.createElement` or an ORM's
`Model.create`. `from` converts from another representation, like `Array.from`
or `Buffer.from`. `is` is the runtime type guard.

### How the private state works

`createPrivateStore` returns an accessor function with two helpers attached:

```ts
const _store = createPrivateStore<IAnimal, AnimalState>();

_store.init(self, initialState); // attach state to a new instance, once
_store(self).name = 'Max';       // read or write state from inside the module
_store.has(val);                 // type guard: was this object built here?
```

The instance is the `WeakMap` key and the state object is the value. Nothing is
added to the instance itself, and entries are released when the instance is
garbage collected.

### Prior art

Factory functions and the module pattern are old. Douglas Crockford was
describing both before ES5, and for years the standard way to get private
state without prototypes was a closure:

```js
function createAnimal(name, age, weight) {
  var state = { name: name, age: age, weight: weight };
  return {
    name: function () { return state.name; },
    rename: function (n) { state.name = n; },
  };
}
```

This repo keeps the shape of that idea, a function returns a plain object, and
changes the parts that aged badly:

- **Functions are shared, not recreated.** The closure factory builds a new
  set of function objects for every instance, because each one has to capture
  its own `state`. Here every function is declared once at module scope and
  finds its state through `this` and the `WeakMap`. Instances share their
  functions exactly as class instances share prototype methods, with no
  prototype involved.
- **Privacy is stronger.** Closure state was private only until a method leaked
  it, and nothing stopped a method from returning `state` by accident. A
  `WeakMap` in module scope is unreachable from outside the module no matter
  what an instance function returns.
- **The module is native.** No IIFE, no revealing-module boilerplate. An ES
  module is the boundary, and the file's exports are its public surface.
- **The types are real.** `IAnimal`, `AnimalState`, and the `this` parameter on each
  instance function give the compiler the same view of the object a class
  declaration would.
- **The runtime check is designed, not inherited.** The old pattern had no
  answer to `instanceof`. Here `is` is a deliberate function, and
  [Working with IO data](#working-with-io-data) explains why owning it matters.

If you already know the classic pattern, read this as that pattern with the
per-instance memory cost, the weak privacy, and the missing types fixed.

### Extending a module

A class-based `Dog` would `extend Animal`. Here `Dog`'s state type extends
`Animal`'s, `Animal` exports one composition hook, `extend`, and `Dog` builds
itself on top of it:

```ts
// Animal.ts
function extend<T extends object>(target: T, state: AnimalState): T & IAnimal {
  const self = { ...InstanceFunctions, ...target };
  _store.init(self, state);
  return self;
}

// Dog.ts
export interface DogState extends AnimalState {
  breed: string;
}

function _new(state: DogState): IDog {
  const self: IDog = Animal.extend({ ...InstanceFunctions }, state);
  _store.init(self, state);
  return self;
}
```

`extend` returns one object that carries Animal's instance functions plus
whatever the target brought, and registers that object in Animal's store with
the state it was given. `Dog` registers the same object, with the same state,
in its own store. The result is a single instance with a single state object,
known to both modules. `id`, `name`, `age`, `weight`, and `rename` on a dog are
Animal's own functions, not copies and not forwarders, and `Dog.ts` never
mentions them. When Animal's `rename` writes `state.name`, Dog's `toJSON` sees
it, because there is only one state object. Both `Dog.is(dog)` and `Animal.is(dog)`
are `true`.

A few things follow from this.

**Overriding is spread order.** The target's properties are spread last, so
anything the child defines wins. `Dog` overrides `toJSON`, and because the
state already holds every field the body is identical to Animal's. The
override exists to narrow the return type to include `breed`.

**Construction is reused, not repeated.** `Dog.create` calls `Animal.create`
for the animal half, which is where the id comes from, and takes its `toJSON`
snapshot as the base of the dog's state. `Dog.from` checks only `breed`, then
does the same with `Animal.from`, which validates the inherited fields and
throws with its own message. Nothing about the animal's shape appears in
`Dog.ts`.

**The interface can still extend.** `IDog extends IAnimal` is only a type, so
a dog can be passed anywhere an `IAnimal` is expected. What is not inherited is
the implementation, and that is the point.

**Spreading an instance does not work, and that is by design.** `{ ...dog }`
creates a new object neither store has seen, and its first method call throws.
State is keyed by object identity, so an object is only an instance if a
module registered it. That is the same property that makes `is` trustworthy,
and the reason composition has to go through the parent's public API rather
than around it.

The cost is that the parent has to opt in. `extend` is an API that exists
only so other modules can build on `Animal`, which is a little of what
inheritance was. It is one function, it is explicit, and a module that does not
export it cannot be extended, which is a reasonable default.

### Running the example

Node 22.18 and later strip types natively, so no build step is needed:

```bash
node OOM/playground.ts
```

To type-check under the strict settings in `tsconfig.json` without installing
anything into the repo:

```bash
npx -p typescript tsc
```

---

## Why factory functions instead of classes

### No inheritance machinery

1. **No prototype chain to reason about.** There is no `super()`, no fragile
   `extends` chain, and no confusion about which ancestor defines a method.
   Composition replaces inheritance entirely, see
   [Extending a module](#extending-a-module).

2. **No `new` keyword.** A factory is an ordinary function call. Classes throw
   when called without `new`, and before strict-mode classes made that a hard
   error, forgetting `new` was a classic JavaScript bug.

### Composability

3. **Mixins are explicit object spreads.** Merging behavior from several
   sources is `{ ...loggable(self), ...serializable(self) }`. The class-based
   equivalent needs mixin functions that manipulate prototypes, which adds
   indirection and is harder to trace.

4. **Instances are plain objects.** They work with anything that expects a
   plain object: spread, `Object.entries`, structural typing, and generic
   serializers. There is no prototype to leak behavior into consumers.

### Flexibility and testing

5. **Trivial to stub.** The "interface" is a structural object shape, so a test
   double is an object literal. There is no class to extend and no mocking
   library needed to override a method.

6. **Immutable state is a natural extension.** State lives in one internal
   object, so returning a new state object instead of mutating in place is an
   easy change. Class fields nudge you toward `this.x = y`.

### Tooling and language alignment

7. **No class-specific TypeScript gotchas.** No `strictPropertyInitialization`
   to satisfy, no `public`/`private`/`protected` keywords that are erased at
   compile time and offer no runtime privacy, and no decorator churn.

8. **Functions are independently testable.** Standalone functions like `name`
   and `rename` can be unit tested by binding a `this` value, without
   constructing a full instance.

### Readability

9. **State changes are easy to trace.** Private helpers have no `this`, so
   any function that reads or writes state must receive the state object as an
   explicit argument. Every place state moves is visible at the call site,
   which makes it simple to search for and follow. In a class, any method can
   reach `this` and mutate a field from anywhere, with nothing at the call site
   to show it. In the example, `_new` is handed the state object it attaches
   and `_validate` is handed the value it checks. Neither can reach an
   instance's state any other way, so searching for `_store(` finds every
   read and write in the module.

10. **Every function stays at the top level.** Nothing is nested inside a
    class body or a factory closure, so the whole module reads as a flat list
    of declarations. Each function can be found, read, and moved on its own,
    and the file's section separators map directly onto its structure.

---

## Why a `WeakMap` for private state

1. **Privacy is real, not conventional.** The state is not attached to the
   object at all, so `Object.keys`, `JSON.stringify`, `Reflect.ownKeys`,
   `Object.getOwnPropertySymbols`, and devtools inspection of the instance all
   find nothing. `#private` class fields come close, but they still appear when
   you inspect the instance in devtools, and a `symbol`-keyed property is still
   discoverable through reflection.

2. **Nothing can be copied by accident.** `{ ...instance }` and
   `Object.assign({}, instance)` cannot leak private state because there is no
   private property on the object to copy. Underscore-prefixed "private"
   properties, and enumerable symbol-keyed ones, do get copied.

3. **No memory leak.** `WeakMap` keys are held weakly, so state is released as
   soon as the instance is garbage collected.

This makes the pattern safe when an object crosses a trust boundary: a
separate npm package, a browser extension, a third-party plugin, untrusted user
script, or a different security realm. The costs are that the state cannot be
seen by looking at the object, which makes debugging slightly less convenient,
and that a `WeakMap` lookup is a little slower than a property read.

---

## Working with IO data

Data that crosses an IO boundary comes back as plain objects. An HTTP body, a
database row, a file, or a queue message that once held a class instance has
been through `JSON.stringify` and `JSON.parse`, and the prototype did not
survive the trip. `instanceof` is now `false` and every method is gone.

Classes are fragile here because the only way to repair that is an explicit
constructor call at every boundary, `new Dog(row.name, row.age, row.weight,
row.breed)`. Miss one, and an `instanceof` check somewhere downstream quietly
takes the wrong branch. The check itself is fixed by the language, so there is
nothing to configure. Either the prototype chain is intact or it is not.

With this pattern the runtime check is an ordinary function you own. As
written in this repo, `is` asks the `WeakMap` whether it has seen the object,
so a parsed row returns `false` for the same reason `instanceof` would. Unlike
`instanceof`, that is a choice, not a rule. Because `is` is just a function,
you can make it whatever your boundary needs: keep it strict, make it
structural, or split the two concerns.

The example splits them. `is` stays strict, so only objects built by the
module pass. `from` accepts raw data, checks its shape with a private
structural guard, and builds a real instance:

```ts
function from(val: unknown): IDog {
  if (!_validate(val)) throw new Error('Value is not a serialized Dog');
  return _new({ animal: Animal.from(val), breed: val.breed });
}
```

```ts
const row: unknown = JSON.parse(body);
Dog.is(row);           // false, it is a plain object
Dog.is(Dog.from(row)); // true
```

The hydration step still has to happen somewhere, but it happens once, in a
function that sits next to `is` and is written by the same person, rather than
being re-implemented at every place data enters the system.

---

## Trade-offs

This pattern is not free. The costs worth naming:

- **Not for plain data.** If a thing has no behavior and no invariant to
  protect, declare a type and move on. The `WeakMap` and the accessor
  functions only earn their keep when there is something outside code must not
  be able to do, like reassign an `id`.
- **Weaker compiler-enforced correctness.** Structural typing means any object
  matching the interface shape will type-check, even if it never went through
  the real factory. The exported `is` guard gives you a runtime check to fall
  back on.
- **No `instanceof`.** Narrowing goes through each module's `is`. A dog
  passes both `Dog.is` and `Animal.is` because `extend` registered it in both
  stores, but there is no single operator that walks a chain for you.
- **Extension is opt-in.** A module can only be built on if it exports an
  `extend` hook. That is deliberate, but it means a parent written without one
  has to be changed before a child can exist.
- **Methods still depend on `this`.** The instance functions read their state
  through `this`, so a detached call like `const n = dog.name; n()` throws,
  exactly as it would with a class method.
- **An unfamiliar shape.** Most TypeScript readers expect classes, and the
  module-as-class layout takes a moment to get used to.
