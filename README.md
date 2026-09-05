# Object-Oriented Programming Without Classes

A pattern for writing object-oriented TypeScript with factory functions and
modules instead of classes. Each module plays the role a class normally would,
which is why this repo calls one an **Object-Oriented Module**, or **OOM** for
short. Private state lives in a module-scoped `WeakMap`, so it is unreachable
from outside the module by any means.

| File | Purpose |
|---|---|
| [`OOM/ValidationError.ts`](OOM/ValidationError.ts) | An example Object-Oriented Module |
| [`OOM/createPrivateStore.ts`](OOM/createPrivateStore.ts) | The `WeakMap`-backed private state helper |
| [`OOM/playground.ts`](OOM/playground.ts) | Runnable demo with the expected output in comments |

---

## The pattern

An Object-Oriented Module exports a small set of static functions (`from`,
`of`, `is`). The factory, `from`, returns a plain object whose properties are
functions declared once at module scope. Each of those functions reads and
writes its instance's state through a private store that only this module can
see.

```ts
import ValidationError from './OOM/ValidationError.ts';

const verr = ValidationError.of('Must be an email', ['user', 'email']);

verr.message();              // 'Must be an email'
verr.path();                 // [ 'user', 'email' ]
verr.path(['user', 'name']); // setter form, returns the new value

Object.keys(verr);           // [ 'path', 'message', 'toJSON' ]
JSON.stringify(verr);        // {"path":["user","name"],"message":"Must be an email"}
ValidationError.is(verr);    // true
ValidationError.is({ path: () => [], message: () => '', toJSON: () => ({}) }); // false
```

### How the private state works

`createPrivateStore` returns an accessor function with two helpers attached:

```ts
const _state = createPrivateStore<IValidationError, State>();

_state.init(self, initialState); // attach state to a new instance
_state(self).message = 'foo';    // read or write state from inside the module
_state.has(val);                 // type guard: was this object built here?
```

The instance is the `WeakMap` key and the state object is the value. Nothing is
added to the instance itself, and entries are released when the instance is
garbage collected.

### Running the example

Node 22.18 and later strip types natively, so no build step is needed:

```bash
node OOM/playground.ts
```

---

## Why factory functions instead of classes

### No inheritance machinery

1. **No prototype chain to reason about.** There is no `super()`, no fragile
   `extends` chain, and no confusion about which ancestor defines a method.
   Composition replaces inheritance entirely.

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

8. **Functions are independently testable.** Standalone functions like `path`
   and `message` can be unit tested by binding a `this` value, without
   constructing a full instance.

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

## Trade-offs

This pattern is not free. The costs worth naming:

- **Weaker compiler-enforced correctness.** Structural typing means any object
  matching the interface shape will type-check, even if it never went through
  the real factory. The exported `is` guard gives you a runtime check to fall
  back on.
- **No `instanceof`.** Runtime narrowing has to go through `is` instead.
- **Methods still depend on `this`.** The instance functions read their state
  through `this`, so a detached call like `const m = verr.message; m()` throws,
  exactly as it would with a class method.
- **An unfamiliar shape.** Most TypeScript readers expect classes, and getter
  and setter pairs collapsed into one function (`path()` / `path([...])`) take
  a moment to get used to.
