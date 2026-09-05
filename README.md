# Object-Oriented Programming without classes
An alternative to classes in OOP using factory-functions and different approaches to internal state-storage.

---

## Advantages of Factory Functions + Modules

### No `this` Footguns from Inheritance

3. **No prototype chain to reason about.** No `super()`, no fragile `extends` chains, no diamond-problem-style confusion about which ancestor defines a method. Composition (spreading multiple factories' methods into one object) replaces inheritance entirely.

4. **No `new` keyword, no forgetting it.** Calling a factory function without `new` just... works, the normal way. Classes called without `new` throw; forgetting `new` used to be a classic JS bug before strict-mode classes made it a hard error — factories sidestep the whole issue.

### Composability

5. **Mixins/composition are trivial and explicit.** Merging behavior from multiple sources is just object spread: `{ ...loggable(self), ...serializable(self) }`. Multiple inheritance-like composition in class-land requires mixin functions that manipulate prototypes — more indirection, harder to trace.

6. **Instances are plain objects.** They pass `typeof x === 'object'`, work with any code expecting a plain object (spread, `Object.entries`, structural typing), and don't carry surprising prototype methods that show up in `for...in` loops or generic serializers.

### Flexibility & Testing

7. **Trivial to stub/mock.** Since the "interface" is structural (just an object shape), test doubles are just object literals — no need to extend a class or use a mocking library to override methods.

8. **Immutable-by-default state is a natural extension.** Because state lives in one internal object, patterns like returning a new state object instead of mutating in place fall out naturally, whereas class fields nudge you toward direct mutation (`this.x = y`).

### Tooling / Language Alignment

9. **No class-specific TS gotchas.** No worrying about `strictPropertyInitialization`, no accidental `public`/`private`/`protected` keyword confusion (TS-only, erased at compile time, not real privacy), no decorators-related version churn.

10. **Functions are independently testable and tree-shakeable.** Standalone functions like `path`, `message` can be unit tested directly, and bundlers can tree-shake unused ones — harder to cleanly tree-shake individual class methods since they're bound to the prototype as a unit.

### Honest Caveat (worth including for balance)

This pattern isn't free of tradeoffs. Two worth naming explicitly:

- **Weaker compiler-enforced correctness** — structural typing means a malformed fake object matching the interface shape will still typecheck, even if it was never built through the real factory.
- **No `instanceof`** — you lose runtime type-narrowing unless you add a manual brand field (e.g. `readonly __brand: 'ValidationError'`).

Framing the piece as "here's the tradeoff, here's when it's worth it" will land better with readers than "classes are bad."

---

## Two approaches

- Use a `symbol` or private storage with `WeakMap`
- **OOM**: "Object-Oriented Module" (`symbol` method)
  - This approach is fine for most real world scenarios. 
- **SecureOOM**: "Secure Object-Oriented Module" (`WeakMap` method)
  - State is completely hidden but the storage data-structure is a lot more complex and has longer lookup times. 

> Use SecureOOM when you're handing your object to code outside your codebase's boundary of trust or code review — a separate npm package, a browser extension, a third-party plugin, untrusted user script, or a different security realm entirely. If everything touching the object is code you and your team wrote and can review, Symbol (or even a plain unexported convention) is sufficient, and WeakMap's extra complexity isn't buying you anything real.

### SecureOOM Encapsulation & Privacy

1. **True privacy, not just convention.** WeakMap-backed state is unreachable from outside the module — no `Object.getOwnPropertyNames`, no debugger inspection panel showing it, no `JSON.stringify` leak. `#private` class fields are closer, but still visible when you inspect the instance directly in devtools; WeakMap state isn't attached to the object at all.

2. **No accidental exposure via spread or destructuring.** `{...instance}` or `Object.assign({}, instance)` can never accidentally copy private state, because there's no private property on the object to copy in the first place. With `#private` fields this is a non-issue too, but with the older "closure variable in constructor" pattern, it was a common bug source.
