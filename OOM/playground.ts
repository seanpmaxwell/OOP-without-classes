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

// The trace comes from a real Error created inside "from".
console.log(verr.stack()?.split('\n')[1]); // =>     at from (.../OOM/ValidationError.ts:NN:NN)

// The type guard only passes objects built by this module, even if the shape
// matches.
console.log(ValidationError.is(verr)); // => true
console.log(ValidationError.is({ path: () => [], message: () => '', stack: () => undefined, toJSON: () => ({ path: [], message: '' }) })); // => false

// Copies share no state with the source.
const copy = ValidationError.from(verr);
copy.path(['other']);
console.log(verr.path()); // => [ 'user', 'email' ]
console.log(copy.path()); // => [ 'other' ]

// Nothing is attached to the object at all, so even reflection finds nothing.
console.log(Object.getOwnPropertySymbols(verr)); // => []
console.log(Reflect.ownKeys(verr)); // => [ 'path', 'message', 'stack', 'toJSON' ]
