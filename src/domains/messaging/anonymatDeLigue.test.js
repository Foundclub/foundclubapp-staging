import identiteDansLeFil, {
  contactsPartageables, personneDansLeFil, prenomDansLeFil,
} from './anonymatDeLigue';

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

describe('personneDansLeFil — la personne à dessiner (ANONSITE)', () => {
  test('un adversaire avant le match : ni nom ni photo', () => {
    const karim = { ...KARIM, avatar: { url: '/karim.png' } };
    expect(personneDansLeFil({ chat: filDeLigue(), moiId: 'moi', personne: karim })).toEqual({
      anonyme: true, avatar: null, documentId: 'karim', firstname: 'Joueur Adverse', lastname: '',
    });
  });

  test('un coéquipier : la personne telle quelle', () => {
    const lea = { documentId: 'lea', firstname: 'Léa' };
    expect(personneDansLeFil({ chat: filDeLigue(), moiId: 'moi', personne: lea })).toBe(lea);
  });
});

describe('ANONSERVEUR — le serveur masque aussi ; l aperçu et le partage de contact', () => {
  test('une personne déjà masquée par le serveur (drapeau) garde le nom qu il a donné', () => {
    const masque = {
      anonyme: true, avatar: null, documentId: 'cap', firstname: 'Capitaine Adverse', lastname: '',
    };
    // Une liste de fils ne porte pas les équipes du match : seul le drapeau dit « capitaine ».
    const filDeLaListe = { league_match: { date: '2099-06-10T16:00:00.000Z' }, type: 'league_match' };
    expect(identiteDansLeFil({ chat: filDeLaListe, moiId: 'moi', personne: masque }))
      .toEqual({ anonyme: true, nom: 'Capitaine Adverse' });
  });

  test('prenomDansLeFil : « Joueur Adverse » pour l adversaire, le prénom sinon', () => {
    expect(prenomDansLeFil({ chat: filDeLigue(), moiId: 'moi', personne: KARIM })).toBe('Joueur Adverse');
    expect(prenomDansLeFil({ chat: filDeLigue({ myTeamMembers: [KARIM] }), moiId: 'moi', personne: KARIM }))
      .toBe('Karim');
    expect(prenomDansLeFil({ chat: { type: 'group' }, moiId: 'moi', personne: KARIM })).toBe('Karim');
  });

  test('contactsPartageables : ni moi, ni un adversaire masqué', () => {
    const lea = { documentId: 'lea', firstname: 'Léa' };
    const moi = { documentId: 'moi', firstname: 'Adel' };
    expect(contactsPartageables({ chat: filDeLigue(), moiId: 'moi', personnes: [moi, KARIM, lea] }))
      .toEqual([lea]);
    expect(contactsPartageables({ chat: { type: 'group' }, moiId: 'moi', personnes: [moi, KARIM, lea] }))
      .toEqual([KARIM, lea]);
  });
});
