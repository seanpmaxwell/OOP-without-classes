// ------------- Playground.ts ---------- //

const verr = ValidationError.from();
verr.message('foo');

console.log(verr.message()); // => 'foo'
console.log(Object.keys(verr)); // => ['path', 'message']
console.log(JSON.stringify(verr)); // => '{"path":[],"message":"foo"}'
