import Animal, { type IAnimal } from './Animal.ts';
import Dog from './Dog.ts';

/******************************************************************************
                                  Playground
******************************************************************************/

// Animal is a complete module on its own.
const cat = Animal.create({ name: 'Tom', age: 5, weight: 4 });
console.log('name:', cat.name()); // => name: Tom
console.log('is:', Animal.is(cat), Dog.is(cat)); // => is: true false

// Invariants hold no matter where the data came from. The only way to change
// state is through the module's functions, and they enforce the rules.
try {
  Animal.create({ name: 'Tom', age: -1, weight: 4 });
} catch (err) {
  console.log('create:', (err as Error).message); // => create: Invalid Animal state
}
try {
  cat.rename('   ');
} catch (err) {
  console.log('rename:', (err as Error).message); // => rename: Animal name cannot be blank
}

const dog = Dog.create({ name: 'Rex', age: 3, weight: 20, breed: 'Labrador' });

console.log('name:', dog.name()); // => name: Rex
console.log('breed:', dog.breed()); // => breed: Labrador
console.log('id:', dog.id().length); // => id: 36 (a generated UUID)
console.log('toString:', dog.toString()); // => toString: Rex the Labrador, age 3, 20 kg
console.log('toString:', `${dog}`); // => toString: Rex the Labrador, age 3, 20 kg (template literals call it too)

dog.rename('Max');
console.log('rename:', dog.name()); // => rename: Max

console.log('toJSON:', JSON.stringify(dog)); // => toJSON: {"id":"...","name":"Max","age":3,"weight":20,"breed":"Labrador"}
console.log('Object.keys:', Object.keys(dog)); // => Object.keys: [ 'id', 'name', 'age', 'weight', 'rename', 'toJSON', 'breed', 'toString' ]

// A dog satisfies the IAnimal interface, so it can go anywhere an animal can.
const describe = (animal: IAnimal): string => `${animal.name()}, age ${animal.age()}`;
console.log('IAnimal:', describe(dog)); // => IAnimal: Max, age 3

// The dog was registered in both stores by Animal.extend, so both guards
// recognise it. Its inherited functions are Animal's own, not copies.
console.log('is:', Dog.is(dog)); // => is: true
console.log('is:', Animal.is(dog)); // => is: true

// IO data: a parsed row is a plain object, so "is" rejects it, but "from"
// rebuilds a real instance. Dog.from checks breed and hands the rest to
// Animal.from, so the inherited validation is reused rather than repeated.
const row: unknown = JSON.parse(JSON.stringify(dog));
console.log('is:', Dog.is(row)); // => is: false
console.log('from:', Dog.is(Dog.from(row))); // => from: true
try {
  Dog.from({ name: 'Rex', breed: 'Pug' });
} catch (err) {
  console.log('from:', (err as Error).message); // => from: Invalid Animal state (raised by Animal.from)
}

// State is keyed by object identity, so spreading an instance makes a new
// object the store has never seen. Composition has to go through the module.
const spread = { ...dog };
try {
  spread.name();
} catch (err) {
  console.log('spread:', (err as Error).message); // => spread: Private state accessed before initialization
}

// Nothing is attached to the object at all, so even reflection finds nothing.
console.log('Object.getOwnPropertySymbols:', Object.getOwnPropertySymbols(dog)); // => Object.getOwnPropertySymbols: []
