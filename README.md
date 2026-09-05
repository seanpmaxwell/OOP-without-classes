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

An Object-Oriented Module exports a small set of static functions. Here they
are `create`, `of`, `clone`, `from`, and `is`. The constructors return a plain
object whose properties are functions declared once at module scope. Each of
those functions reads and writes its instance's state through a private store
that only this module can see.

```ts
import ValidationError from './OOM/ValidationError.ts';

const verr = ValidationError.of('Must be an email', ['user', 'email']);

verr.message();              // 'Must be an email'
verr.path();                 // [ 'user', 'email' ]
verr.path(['user', 'name']); // setter form, returns the new value
verr.stack();                // 'Error: Must be an email\n    at Object.of (...)\n ...'

Object.keys(verr);           // [ 'path', 'message', 'stack', 'toJSON' ]
JSON.stringify(verr);        // {"path":["user","name"],"message":"Must be an email"}
ValidationError.is(verr);    // true
ValidationError.is({ path: () => [], message: () => '', stack: () => '', toJSON: () => ({}) }); // false

const clone = ValidationError.clone(verr);        // same values and trace, no shared state
const fromIo = ValidationError.from(JSON.parse(JSON.stringify(verr))); // rebuilt from plain data
```

The constructors follow the names the rest of JavaScript uses. `create` takes
no arguments and returns a blank instance, like `Object.create` or
`http.createServer`. `of` builds from the constituent values, like `Array.of`.
`from` converts from another representation, like `Array.from` or
`Buffer.from`. `clone` duplicates an existing instance.

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

### Inheritance through composition

A class-based `ValidationError` would `extend Error` to get a stack trace. This
module gets the same trace without inheriting anything. `of` creates a real
`Error`, takes its `stack`, and keeps it in private state:

```ts
function of(message: string, path?: string[]): IValidationError {
  return _new({
    message,
    path: path ? [...path] : [],
    stack: new Error(message).stack,
  });
}
```

The instance exposes it through `stack()`, and `clone(verr)` carries the
original's trace over so the point of failure is not lost when an error is
duplicated and rethrown. This is composition in place of inheritance:
the object *has* an `Error`'s trace rather than *being* an `Error`. Anything
else you would normally inherit is borrowed the same way. Create the built-in
object, keep the pieces you need, and expose them through your own functions.
Nothing else from `Error`'s prototype comes along, which is usually the point.
`toJSON` deliberately leaves the stack out so it never lands in a response body.

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
   Composition replaces inheritance entirely, see
   [Inheritance through composition](#inheritance-through-composition).

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

### Readability

9. **State changes are easy to trace.** Private helpers have no `this`, so
   any function that reads or writes state must receive the state object as an
   explicit argument. Every place state moves is visible at the call site,
   which makes it simple to search for and follow. In a class, any method can
   reach `this` and mutate a field from anywhere, with nothing at the call site
   to show it. In the example, `_new` is handed the state object it
   attaches and `_validate` is handed the value it checks. Neither can reach an
   instance's state any other way, so searching for `_state(` finds every
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
constructor call at every boundary, `new ValidationError(json.message,
json.path)`. Miss one, and an `instanceof` check somewhere downstream quietly
takes the wrong branch. The check itself is fixed by the language, so there is
nothing to configure. Either the prototype chain is intact or it is not.

With this pattern the runtime check is an ordinary function you own. As
written in this repo (`IValidationError`), `is` asks the `WeakMap` whether it has seen the object, so parsed IO
data returns `false` for the same reason `instanceof` would. Unlike
`instanceof`, that is a choice, not a rule. Because `is` is just a function,
you can make it whatever your boundary needs: keep it strict, make it
structural, or split the two concerns.

The example splits them. `is` stays strict, so only objects built by this
module pass. `from` accepts raw data, checks its shape with a private
structural guard, and rebuilds a real instance through `of`:

```ts
function from(json: unknown): IValidationError {
  if (!_validate(json)) throw new Error('Value is not a serialized ValidationError');
  return of(json.message, json.path);
}
```

```ts
const json: unknown = JSON.parse(body);
ValidationError.is(json);                       // false, it is a plain object
ValidationError.is(ValidationError.from(json)); // true
```

The hydration step still has to happen somewhere, but it happens once, in a
function that sits next to `is` and is written by the same person, rather than
being re-implemented at every place data enters the system.

---

## Trade-offs

This pattern is not free. The costs worth naming:

- **Weaker compiler-enforced correctness.** Structural typing means any object
  matching the interface shape will type-check, even if it never went through
  the real factory. The exported `is` guard gives you a runtime check to fall
  back on.
- **No `instanceof`.** Runtime narrowing has to go through `is` instead. That
  includes `instanceof Error`: the object carries an `Error`'s trace but is not
  one, so code that checks for real `Error` instances will not recognise it.
- **Methods still depend on `this`.** The instance functions read their state
  through `this`, so a detached call like `const m = verr.message; m()` throws,
  exactly as it would with a class method.
- **An unfamiliar shape.** Most TypeScript readers expect classes, and getter
  and setter pairs collapsed into one function (`path()` / `path([...])`) take
  a moment to get used to.
