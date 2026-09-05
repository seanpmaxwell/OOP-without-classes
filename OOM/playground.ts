import ValidationError from './ValidationError.ts';

/******************************************************************************
                                  Playground
******************************************************************************/

const verr = ValidationError.of('foo', ['user', 'email']);

console.log(verr.message()); // => foo
console.log(verr.path()); // => [ 'user', 'email' ]
console.log(Object.keys(verr)); // => [ 'path', 'message', 'stack', 'toJSON' ]
console.log(JSON.stringify(verr)); // => {"path":["user","email"],"message":"foo"} (no stack)
console.log({ ...verr }); // => { path: [Function: path], message: [Function: message], stack: [Function: stack], toJSON: [Function: toJSON] }

// The trace comes from a real Error created inside "of".
console.log(verr.stack()?.split('\n').slice(0, 2)); // => [ 'Error: foo', '    at Object.of (.../OOM/ValidationError.ts:NN:NN)' ]

// The type guard only passes objects built by this module, even if the shape
// matches.
console.log(ValidationError.is(verr)); // => true
console.log(ValidationError.is({ path: () => [], message: () => '', stack: () => undefined, toJSON: () => ({ path: [], message: '' }) })); // => false

// Clones share no state with the source but keep its trace.
const clone = ValidationError.clone(verr);
clone.path(['other']);
console.log(verr.path()); // => [ 'user', 'email' ]
console.log(clone.path()); // => [ 'other' ]
console.log(clone.stack() === verr.stack()); // => true

// IO data: parsed JSON is a plain object, so "is" rejects it, but "from"
// rebuilds a real instance from it.
const json: unknown = JSON.parse(JSON.stringify(verr));
console.log(ValidationError.is(json)); // => false
console.log(ValidationError.is(ValidationError.from(json))); // => true
try {
  ValidationError.from({ message: 42 });
} catch (err) {
  console.log((err as Error).message); // => Value is not a serialized ValidationError
}

// A bare instance can be built and filled in later.
const blank = ValidationError.create();
blank.message('bar');
console.log(JSON.stringify(blank)); // => {"path":[],"message":"bar"}

// Nothing is attached to the object at all, so even reflection finds nothing.
console.log(Object.getOwnPropertySymbols(verr)); // => []
console.log(Reflect.ownKeys(verr)); // => [ 'path', 'message', 'stack', 'toJSON' ]
