import identiteDansLeFil from './anonymatDeLigue';

const KARIM = { documentId: 'karim', firstname: 'Karim', lastname: 'Benali' };
const filDeLigue = (/** @type {Record<string, any>} */ plus = {}) => ({
  league_match: {
    date: '2099-06-10T16:00:00.000Z', team_a: {}, team_b: { captain: { documentId: 'cap' } },
  },
  myTeamMembers: [{ documentId: 'lea' }],
  type: 'league_match',
  ...plus,
});

describe('identiteDansLeFil — anonymat d un fil de ligue (Q4-06)', () => {
  test('un adversaire avant le match : anonyme', () => {
    expect(identiteDansLeFil({ chat: filDeLigue(), moiId: 'moi', personne: KARIM }))
      .toEqual({ anonyme: true, nom: 'Joueur Adverse' });
  });

  test('le capitaine adverse : « Capitaine Adverse »', () => {
    const cap = { documentId: 'cap' };
    expect(identiteDansLeFil({ chat: filDeLigue(), moiId: 'moi', personne: cap }).nom)
      .toBe('Capitaine Adverse');
  });

  test('moi, un coéquipier, après le match, ou un autre fil : le vrai nom', () => {
    const vrai = { anonyme: false, nom: 'Karim Benali' };
    expect(identiteDansLeFil({ chat: filDeLigue(), moiId: 'karim', personne: KARIM }))
      .toEqual(vrai);
    expect(identiteDansLeFil({
      chat: filDeLigue({ myTeamMembers: [KARIM] }), moiId: 'moi', personne: KARIM,
    })).toEqual(vrai);
    expect(identiteDansLeFil({
      chat: filDeLigue(), maintenant: new Date('2100-01-01'), moiId: 'moi', personne: KARIM,
    })).toEqual(vrai);
    expect(identiteDansLeFil({ chat: { type: 'team' }, moiId: 'moi', personne: KARIM }))
      .toEqual(vrai);
  });
});
