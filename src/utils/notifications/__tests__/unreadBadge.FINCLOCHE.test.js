import { formatUnreadBadge } from '../unreadBadge';

// FIN-CLOCHE (02/11/2026) — une seule façon d'écrire un nombre sur une pastille.

describe('formatUnreadBadge', () => {
  test.each([
    [1, '1'],
    [99, '99'],
    [100, '99+'],
    [376, '99+'],
  ])('%s s écrit %s', (compte, attendu) => {
    expect(formatUnreadBadge(compte)).toBe(attendu);
  });

  test.each([[0], [-3], [null], [undefined], ['pas un nombre']])(
    '%s ne s écrit pas',
    (compte) => {
      expect(formatUnreadBadge(compte)).toBe('');
    },
  );
});
