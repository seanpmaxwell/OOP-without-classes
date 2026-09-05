import ValidationError from './ValidationError.ts';

/******************************************************************************
                                  Playground
******************************************************************************/

const verr = ValidationError.of('foo', ['user', 'email']);

console.log(verr.message()); // => foo
console.log(verr.path()); // => [ 'user', 'email' ]
console.log(Object.keys(verr)); // => [ 'path', 'message', 'toJSON' ]
console.log(JSON.stringify(verr)); // => {"path":["user","email"],"message":"foo"}
console.log({ ...verr }); // => { path: [Function: path], message: [Function: message], toJSON: [Function: toJSON] }

// The type guard only passes objects built by this module, even if the shape
// matches.
console.log(ValidationError.is(verr)); // => true
console.log(ValidationError.is({ path: () => [], message: () => '', toJSON: () => ({ path: [], message: '' }) })); // => false

// Copies share no state with the source.
const copy = ValidationError.from(verr);
copy.path(['other']);
console.log(verr.path()); // => [ 'user', 'email' ]
console.log(copy.path()); // => [ 'other' ]

// Nothing is attached to the object at all, so even reflection finds nothing.
console.log(Object.getOwnPropertySymbols(verr)); // => []
console.log(Reflect.ownKeys(verr)); // => [ 'path', 'message', 'toJSON' ]
