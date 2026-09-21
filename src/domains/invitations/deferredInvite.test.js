import {
  buildInviteUrlFromInstallReferrer,
  parseInviteInstallReferrer,
} from '@/domains/invitations/deferredInvite';

const CODE = 'AbCdEfGhIjKlMnOpQrStUv12';

describe('INVIT3 — reprise apres installation Android', () => {
  it('retrouve uniquement sujet, identifiant et code opaque', () => {
    expect(parseInviteInstallReferrer(
      `fc_invite=1&subject=team&id=team-senior&c=${CODE}`,
    )).toEqual({ code: CODE, id: 'team-senior', subject: 'team' });
  });

  it('refuse un referrer marketing ou un sujet inconnu', () => {
    expect(parseInviteInstallReferrer('utm_source=campaign&utm_medium=email')).toBeNull();
    expect(parseInviteInstallReferrer('fc_invite=1&subject=coach&id=42')).toBeNull();
  });

  it('transforme le referrer officiel en lien canonique relu par le socle INVIT2', () => {
    expect(buildInviteUrlFromInstallReferrer(
      `fc_invite=1&subject=team&id=team%2Fsenior&c=${CODE}`,
    )).toBe(`https://foundclub.app/i/team/team%2Fsenior?c=${CODE}`);
  });
});
