import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Room } from './room.ts';

/** A room with both players connected: host on seat 0, guest on seat 1. */
function fullRoom() {
  const room = new Room('ABCD');
  assert.equal(room.join(0), 0);
  assert.equal(room.join(), 1);
  return room;
}

describe('seats', () => {
  it('gives the guest seat 1 and refuses a third phone', () => {
    const room = fullRoom();
    assert.equal(room.join(), null);
    assert.deepEqual(room.state().connected, [true, true]);
  });

  it('lets a phone take its seat back after a disconnection', () => {
    const room = fullRoom();
    room.leave(1);
    assert.deepEqual(room.state().connected, [true, false]);
    assert.equal(room.join(0), null, 'seat 0 is still connected');
    assert.equal(room.join(1), 1);
  });
});

describe('co-validated points', () => {
  it('only counts a point once the other player confirms', () => {
    const room = fullRoom();
    assert.equal(room.handle(0, { type: 'propose-point', winner: 1 }), null);
    assert.deepEqual(room.state().points, []);
    const pending = room.state().pending;
    assert.equal(pending?.kind, 'point');

    assert.equal(room.handle(1, { type: 'confirm', actionId: pending!.id }), null);
    assert.deepEqual(room.state().points, [1]);
    assert.equal(room.state().pending, null);
  });

  it('does not let the proposer confirm their own point', () => {
    const room = fullRoom();
    room.handle(0, { type: 'propose-point', winner: 0 });
    const id = room.state().pending!.id;
    assert.match(room.handle(0, { type: 'confirm', actionId: id }) ?? '', /other player/);
    assert.deepEqual(room.state().points, []);
  });

  it('refuses a second proposal while one is pending', () => {
    const room = fullRoom();
    room.handle(0, { type: 'propose-point', winner: 0 });
    assert.ok(room.handle(1, { type: 'propose-point', winner: 1 }));
  });

  it('ignores a confirmation for an outdated action', () => {
    const room = fullRoom();
    room.handle(0, { type: 'propose-point', winner: 0 });
    const id = room.state().pending!.id;
    room.handle(0, { type: 'cancel', actionId: id });
    room.handle(1, { type: 'propose-point', winner: 1 });
    assert.ok(room.handle(0, { type: 'confirm', actionId: id }));
    assert.deepEqual(room.state().points, []);
  });
});

describe('disagreement', () => {
  it('marks the point as disputed, then still accepts a confirmation after the replay', () => {
    const room = fullRoom();
    room.handle(0, { type: 'propose-point', winner: 0 });
    const id = room.state().pending!.id;
    assert.equal(room.handle(1, { type: 'dispute', actionId: id }), null);
    assert.equal(room.state().pending?.disputed, true);
    assert.deepEqual(room.state().points, []);

    assert.equal(room.handle(1, { type: 'confirm', actionId: id }), null);
    assert.deepEqual(room.state().points, [0]);
  });

  it('lets either player cancel a disputed point', () => {
    const room = fullRoom();
    room.handle(0, { type: 'propose-point', winner: 0 });
    const id = room.state().pending!.id;
    room.handle(1, { type: 'dispute', actionId: id });
    assert.equal(room.handle(0, { type: 'cancel', actionId: id }), null);
    assert.equal(room.state().pending, null);
    assert.deepEqual(room.state().points, []);
  });
});

describe('undo', () => {
  it('removes the last point once both players agree', () => {
    const room = fullRoom();
    room.handle(0, { type: 'propose-point', winner: 0 });
    room.handle(1, { type: 'confirm', actionId: room.state().pending!.id });
    room.handle(1, { type: 'propose-undo' });
    assert.deepEqual(room.state().points, [0]);
    room.handle(0, { type: 'confirm', actionId: room.state().pending!.id });
    assert.deepEqual(room.state().points, []);
  });

  it('refuses an undo when there is nothing to undo', () => {
    const room = fullRoom();
    assert.ok(room.handle(0, { type: 'propose-undo' }));
  });
});
