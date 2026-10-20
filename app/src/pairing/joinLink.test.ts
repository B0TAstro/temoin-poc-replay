import { describe, expect, it } from '@jest/globals';

import { buildJoinLink, parseJoinLink } from './joinLink';

describe('join link', () => {
  it('round-trips the relay URL and match id', () => {
    const target = { relay: 'ws://192.168.1.20:8787', matchId: 'VERS' };
    expect(parseJoinLink(buildJoinLink(target))).toEqual(target);
  });

  it('rejects other QR codes', () => {
    expect(parseJoinLink('https://example.com')).toBeNull();
    expect(parseJoinLink('temoin://join?match=VERS')).toBeNull();
    expect(parseJoinLink('temoin://join?relay=http%3A%2F%2Fx&match=VERS')).toBeNull();
  });
});
