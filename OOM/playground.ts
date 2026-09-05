import ValidationError from './ValidationError.ts';

/******************************************************************************
                                  Playground
******************************************************************************/

const verr = ValidationError.of('foo', ['user', 'email']);

console.log('message:', verr.message()); // => message: foo
console.log('path:', verr.path()); // => path: [ 'user', 'email' ]
console.log('Object.keys:', Object.keys(verr)); // => Object.keys: [ 'path', 'message', 'stack', 'toJSON' ]
console.log('toJSON:', JSON.stringify(verr)); // => toJSON: {"path":["user","email"],"message":"foo"} (no stack)
console.log('spread:', { ...verr }); // => spread: { path: [Function: path], message: [Function: message], stack: [Function: stack], toJSON: [Function: toJSON] }

// The trace comes from a real Error created inside "of".
console.log('stack:', verr.stack()?.split('\n').slice(0, 2)); // => stack: [ 'Error: foo', '    at Object.of (.../OOM/ValidationError.ts:NN:NN)' ]

// The type guard only passes objects built by this module, even if the shape
// matches.
console.log('is:', ValidationError.is(verr)); // => is: true
console.log('is:', ValidationError.is({ path: () => [], message: () => '', stack: () => undefined, toJSON: () => ({ path: [], message: '' }) })); // => is: false

// Clones share no state with the source but keep its trace.
const clone = ValidationError.clone(verr);
clone.path(['other']);
console.log('clone:', verr.path()); // => clone: [ 'user', 'email' ]
console.log('clone:', clone.path()); // => clone: [ 'other' ]
console.log('clone:', clone.stack() === verr.stack()); // => clone: true

// IO data: parsed JSON is a plain object, so "is" rejects it, but "from"
// rebuilds a real instance from it.
const json: unknown = JSON.parse(JSON.stringify(verr));
console.log('is:', ValidationError.is(json)); // => is: false
console.log('from:', ValidationError.is(ValidationError.from(json))); // => from: true
try {
  ValidationError.from({ message: 42 });
} catch (err) {
  console.log('from:', (err as Error).message); // => from: Value is not a serialized ValidationError
}

// A bare instance can be built and filled in later.
const blank = ValidationError.create();
blank.message('bar');
console.log('create:', JSON.stringify(blank)); // => create: {"path":[],"message":"bar"}

// Nothing is attached to the object at all, so even reflection finds nothing.
console.log('Object.getOwnPropertySymbols:', Object.getOwnPropertySymbols(verr)); // => Object.getOwnPropertySymbols: []
console.log('Reflect.ownKeys:', Reflect.ownKeys(verr)); // => Reflect.ownKeys: [ 'path', 'message', 'stack', 'toJSON' ]
