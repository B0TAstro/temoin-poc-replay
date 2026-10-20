/**
 * The QR code shown by the host phone is a deep link: `temoin://join?relay=ws://…&match=ABCD`.
 * Scanned in the app, or with the iPhone Camera app, it opens the join screen of Témoin.
 */
export type JoinTarget = { relay: string; matchId: string };

export function buildJoinLink({ relay, matchId }: JoinTarget): string {
  return `temoin://join?relay=${encodeURIComponent(relay)}&match=${encodeURIComponent(matchId)}`;
}

export function parseJoinLink(link: string): JoinTarget | null {
  const match = /^temoin:\/\/join\?(.*)$/.exec(link.trim());
  if (!match) return null;
  const params = new Map(
    match[1].split('&').map((pair) => {
      const [key, value = ''] = pair.split('=');
      return [key, decodeURIComponent(value)] as const;
    }),
  );
  const relay = params.get('relay');
  const matchId = params.get('match');
  if (!relay?.startsWith('ws://') && !relay?.startsWith('wss://')) return null;
  if (!matchId) return null;
  return { relay, matchId };
}
