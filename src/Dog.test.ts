import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import createPrivateStore from './createPrivateStore.ts';
import Animal, { type IAnimal } from './Animal.ts';
import Dog, { type IDog, type DogState } from './Dog.ts';

describe('Dog', () => {
  it('create() layers Dog defaults on Animal defaults', () => {
    const d = Dog.create();
    assert.deepEqual(Dog.defaults(), { ...Animal.defaults(), breed: 'Unknown' });
    assert.deepEqual(d.toJSON(), { id: d.id(), ...Dog.defaults() });
  });

  it('of() takes name, breed, and an optional age', () => {
    const d = Dog.of('Ivy', 'Beagle', 2);
    assert.equal(d.name(), 'Ivy');
    assert.equal(d.breed(), 'Beagle');
    assert.equal(d.age(), 2);
    assert.equal(Dog.of('Bo', 'Pug').age(), Dog.defaults().age);
  });

  it('is registered in both stores', () => {
    const d = Dog.create();
    assert.equal(Dog.is(d), true);
    assert.equal(Animal.is(d), true);
    const cat = Animal.create();
    assert.equal(Animal.is(cat), true);
    assert.equal(Dog.is(cat), false);
  });

  it("inherited functions are Animal's own, shared across instances", () => {
    const a = Dog.create();
    const b = Dog.create();
    assert.equal(a.name, b.name);
    assert.equal(a.breed, b.breed);
  });

  it('shares one state object between the two modules', () => {
    const d = Dog.create({ name: 'Rex', breed: 'Lab' });
    d.rename('Max'); // Animal's function
    assert.equal(d.toJSON().name, 'Max'); // Dog's function sees it
    assert.equal(`${d}`, 'Max the Lab, age 0, 0 kg');
  });

  it('satisfies IAnimal at the type level', () => {
    const describeAnimal = (a: IAnimal): string => a.name();
    assert.equal(describeAnimal(Dog.create({ name: 'Rex' })), 'Rex');
  });

  it('validates its own field and lets Animal validate the rest', () => {
    assert.throws(() => Dog.create({ breed: ' ' }), /Invalid Dog state/);
    assert.throws(() => Dog.from({ id: '1', name: 'Rex', age: 1, weight: 1 }), /Invalid Dog state/);
    assert.throws(() => Dog.from({ id: '1', name: 'Rex', age: -1, weight: 1, breed: 'Pug' }), /Invalid Animal state/);
  });

  it('round-trips through JSON via from()', () => {
    const d = Dog.of('Rex', 'Lab', 3);
    const row: unknown = JSON.parse(JSON.stringify(d));
    assert.equal(Dog.is(row), false);
    const back = Dog.from(row);
    assert.equal(Dog.is(back), true);
    assert.equal(Animal.is(back), true);
    assert.deepEqual(back.toJSON(), d.toJSON());
  });

  it('can itself be extended, and a child override wins', () => {
    // A throwaway third level, built the same way Dog is built on Animal.
    interface IPuppy extends IDog { toys(): number }
    interface PuppyState extends DogState { toys: number }
    const store = createPrivateStore<IPuppy, PuppyState>();
    const fns = {
      toys: (s: PuppyState) => s.toys,
      toString: (s: PuppyState) => `${s.name} (puppy)`, // overrides Dog's
    };
    const state: PuppyState = { id: '1', name: 'Bo', age: 0, weight: 1, breed: 'Pug', toys: 3 };
    const pup: IPuppy = Dog.extend(store.init(fns, state), state);

    assert.equal(pup.toys(), 3);
    assert.equal(`${pup}`, 'Bo (puppy)'); // child's toString
    assert.equal(pup.breed(), 'Pug');     // Dog's
    assert.equal(pup.name(), 'Bo');       // Animal's
    assert.equal(Dog.is(pup), true);
    assert.equal(Animal.is(pup), true);
  });

  it('refuses to register the same object twice in one store', () => {
    const d = Dog.create();
    assert.throws(() => Dog.extend(d, d.toJSON()), /initialized twice/);
  });
});
