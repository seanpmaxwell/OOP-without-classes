// -------- Playground -------

const verr = ValidationError.from();
verr.message('foo');

console.log(verr.message()); // => 'foo'
console.log(Object.keys(verr)); // => ['path', 'message', 'toJSON']
console.log(JSON.stringify(verr)); // => '{"path":[],"message":"foo"}'
console.log({ ...verr }); // => { path: [ƒ], message: [ƒ], toJSON: [ƒ] } — no private state leaked
console.log(ValidationError.is(verr)); // => true
console.log(ValidationError.is({ path: () => [], message: () => '', toJSON: () => ({} as State) })); // => false
