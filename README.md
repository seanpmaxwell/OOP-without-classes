# Object-Oriented Programming Without Classes

Two patterns for writing object-oriented TypeScript with factory functions and
modules instead of classes. Both build the same `ValidationError` object; they
differ only in where the private state lives.

| Folder | Name | Private state lives in |
|---|---|---|
| [`OOM/`](OOM) | Object-Oriented Module | A non-enumerable property keyed by a module-scoped `symbol` |
| [`SecureOOM/`](SecureOOM) | Secure Object-Oriented Module | A module-scoped `WeakMap` |

---

## The pattern

A module exports a small set of static functions (`from`, `of`, `is`). The
factory, `from`, returns a plain object whose properties are functions declared
once at module scope. Each of those functions reads and writes its instance's
state through a private accessor that only this module can see.

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

The two `ValidationError.ts` files are identical apart from one line: which
store they create. Compare [`OOM/ValidationError.ts`](OOM/ValidationError.ts)
with [`SecureOOM/ValidationError.ts`](SecureOOM/ValidationError.ts).

### Running the examples

Each folder has a `playground.ts` whose comments show the expected output.
Node 22.18 and later strip types natively, so no build step is needed:

```bash
node OOM/playground.ts
```

```bash
node SecureOOM/playground.ts
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

### Trade-offs

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

---

## Choosing between OOM and SecureOOM

|  | OOM (`symbol`) | SecureOOM (`WeakMap`) |
|---|---|---|
| Where the state lives | On the object, under a private `symbol` key | In a `WeakMap` inside the module |
| Hidden from `Object.keys`, `JSON.stringify`, spread, `Object.assign` | Yes, the property is non-enumerable | Yes, nothing is on the object |
| Hidden from `Object.getOwnPropertySymbols`, `Reflect.ownKeys`, devtools | No | Yes |
| Lookup cost | One property read | One `WeakMap.get` |
| Memory | Freed with the object | Freed with the object (weak keys) |

**Use OOM by default.** The symbol never leaves the module, so the only way to
reach the state is deliberate reflection. If all of the code that touches the
object is code you and your team wrote and review, that is enough.

**Use SecureOOM when the object crosses a trust boundary.** That means handing
it to a separate npm package, a browser extension, a third-party plugin,
untrusted user script, or a different security realm. In those cases:

1. **Privacy is real, not conventional.** WeakMap-backed state is unreachable
   from outside the module. `#private` class fields come close, but they still
   appear when you inspect the instance in devtools. WeakMap state is not
   attached to the object at all.

2. **Nothing can be copied by accident.** `{ ...instance }` and
   `Object.assign({}, instance)` cannot leak private state because there is no
   private property on the object to copy. Underscore-prefixed "private"
   properties, and enumerable symbol-keyed ones, do get copied.

The price is that the object's state can no longer be seen by looking at the
object, which makes debugging slightly less convenient, and the `WeakMap`
lookup on every access is a little slower than a property read.
