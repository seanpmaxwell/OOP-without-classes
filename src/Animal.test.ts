import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Animal from './Animal.ts';

describe('Animal', () => {
  it('create() fills every field from defaults and generates an id', () => {
    const a = Animal.create();
    assert.deepEqual(a.toJSON(), { id: a.id(), ...Animal.defaults() });
    assert.equal(a.id().length, 36);
  });

  it('create() accepts a partial and keeps the rest from defaults', () => {
    const a = Animal.create({ name: 'Tom', weight: 4 });
    assert.equal(a.name(), 'Tom');
    assert.equal(a.weight(), 4);
    assert.equal(a.age(), Animal.defaults().age);
  });

  it('of() is a positional front for create()', () => {
    const a = Animal.of('Tom', 5);
    assert.equal(a.name(), 'Tom');
    assert.equal(a.age(), 5);
    assert.equal(a.weight(), Animal.defaults().weight);
  });

  it('every instance gets a different id', () => {
    assert.notEqual(Animal.create().id(), Animal.create().id());
  });

  it('defaults() returns a fresh object each call', () => {
    assert.notEqual(Animal.defaults(), Animal.defaults());
    assert.deepEqual(Animal.defaults(), Animal.defaults());
  });

  it('rejects invalid state on every construction path', () => {
    assert.throws(() => Animal.create({ age: -1 }), /Invalid Animal state/);
    assert.throws(() => Animal.create({ name: '   ' }), /Invalid Animal state/);
    assert.throws(() => Animal.create({ weight: Number.NaN }), /Invalid Animal state/);
    assert.throws(() => Animal.from({ id: '1', name: 'x', age: 1 }), /Invalid Animal state/);
    assert.throws(() => Animal.from(null), /Invalid Animal state/);
  });

  it('rename() is the only way to change the name and it enforces the rule', () => {
    const a = Animal.create({ name: 'Tom' });
    a.rename('Max');
    assert.equal(a.name(), 'Max');
    assert.throws(() => a.rename(''), /cannot be blank/);
    assert.equal(a.name(), 'Max');
  });

  it('toJSON() is a snapshot, not the live state', () => {
    const a = Animal.create({ name: 'Tom' });
    const snap = a.toJSON();
    snap.name = 'Changed';
    assert.equal(a.name(), 'Tom');
  });

  it('round-trips through JSON via from()', () => {
    const a = Animal.create({ name: 'Tom', age: 5, weight: 4 });
    const row: unknown = JSON.parse(JSON.stringify(a));
    assert.equal(Animal.is(row), false);
    const b = Animal.from(row);
    assert.equal(Animal.is(b), true);
    assert.deepEqual(b.toJSON(), a.toJSON());
  });

  it('is() accepts only objects this module built', () => {
    const a = Animal.create();
    assert.equal(Animal.is(a), true);
    assert.equal(Animal.is(a.toJSON()), false);
    assert.equal(Animal.is({ ...a }), false);
    assert.equal(Animal.is(null), false);
  });

  it('a spread copy has the functions but no state', () => {
    const copy = { ...Animal.create() };
    assert.throws(() => copy.name(), /before initialization/);
  });

  it('exposes nothing on the instance itself', () => {
    const a = Animal.create();
    assert.deepEqual(Object.getOwnPropertySymbols(a), []);
    for (const value of Object.values(a)) assert.equal(typeof value, 'function');
  });
});
