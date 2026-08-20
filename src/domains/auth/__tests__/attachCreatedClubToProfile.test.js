import {
  attachCreatedClubToProfile,
  hasClubAccess,
  isClubMember,
  resolveMyClubDocumentId,
} from '../authUseCases';

// Filet AA04 ② (E6) — « J'ETAIS ENTRAINEUR, J'AI CREE UN CLUB — SAUF QU'AU LIEU
// DE M'AFFILIER DIRECTEMENT DANS LE CLUB, CA A CREE LE CLUB ET CA M'A MIS SUR
// LA PAGE DETAILS DU CLUB OU J'AI DU DIRE "JE FAIS PARTIE DE CE CLUB" »
// (Adel, 2026-08-20).
//
// 🔒 ET SON GARDE-FOU, qui compte autant que le defaut : creer un club ne doit
// JAMAIS devenir un moyen de se rattacher a un club qu'on n'a pas cree.

/**
 * Le profil d'un entraineur tout neuf, tel que `/firebase-auth/me` le rend
 * AVANT que le club n'existe — et, cache serveur oblige, encore APRES.
 * @returns {any} Le profil.
 */
const entraineurSansClub = () => ({
  clubAffiliations: [],
  clubMembershipRequests: [],
  clubs: [],
  documentId: 'moi',
  myTeams: [],
  role: { name: 'Entraineur', type: 'coach' },
  trainedTeams: [],
});

const clubQueJeViensDeCreer = { documentId: 'club-neuf', name: 'FC de la Duchere' };

describe('AA04 ④ — celui qui cree un club en fait partie sans rien demander', () => {
  it('le profil relu sans le club le connait quand meme', () => {
    const profilPerime = entraineurSansClub();
    expect(isClubMember(profilPerime, 'club-neuf')).toBe(false);

    const profil = attachCreatedClubToProfile(profilPerime, clubQueJeViensDeCreer);

    expect(isClubMember(profil, 'club-neuf')).toBe(true);
    expect(hasClubAccess(profil, 'club-neuf')).toBe(true);
  });

  it('« mon club » repond, donc « creer mon equipe » a un club a qui la donner', () => {
    const profil = attachCreatedClubToProfile(entraineurSansClub(), clubQueJeViensDeCreer);

    expect(resolveMyClubDocumentId(entraineurSansClub())).toBeNull();
    expect(resolveMyClubDocumentId(profil)).toBe('club-neuf');
  });

  it('le profil d origine n est pas modifie sur place', () => {
    const profilPerime = entraineurSansClub();

    attachCreatedClubToProfile(profilPerime, clubQueJeViensDeCreer);

    expect(profilPerime.club).toBeUndefined();
  });
});

describe('AA04 🔒 — on ne se rattache PAS a un club existant sans verification', () => {
  it('un profil qui a deja un club n est pas deplace ailleurs', () => {
    const dejaAffilie = { ...entraineurSansClub(), club: { documentId: 'club-a-moi' } };

    const profil = attachCreatedClubToProfile(dejaAffilie, { documentId: 'club-des-autres' });

    expect(profil.club.documentId).toBe('club-a-moi');
    expect(isClubMember(profil, 'club-des-autres')).toBe(false);
  });

  it('un rattachement porte par `clubs` ou `clubAffiliations` protege autant', () => {
    const parLaListe = { ...entraineurSansClub(), clubs: [{ documentId: 'club-a-moi' }] };
    const parAffiliation = {
      ...entraineurSansClub(),
      clubAffiliations: [{ club: { documentId: 'club-a-moi' } }],
    };

    expect(
      isClubMember(
        attachCreatedClubToProfile(parLaListe, { documentId: 'club-des-autres' }),
        'club-des-autres',
      ),
    ).toBe(false);
    expect(
      isClubMember(
        attachCreatedClubToProfile(parAffiliation, { documentId: 'club-des-autres' }),
        'club-des-autres',
      ),
    ).toBe(false);
  });

  it('sans identifiant de club, rien n est rattache', () => {
    expect(attachCreatedClubToProfile(entraineurSansClub(), null).club).toBeUndefined();
    expect(attachCreatedClubToProfile(entraineurSansClub(), {}).club).toBeUndefined();
    expect(attachCreatedClubToProfile(entraineurSansClub(), { documentId: '  ' }).club)
      .toBeUndefined();
  });

  it('sans profil, la fonction rend ce qu on lui a donne', () => {
    expect(attachCreatedClubToProfile(null, clubQueJeViensDeCreer)).toBeNull();
    expect(attachCreatedClubToProfile(undefined, clubQueJeViensDeCreer)).toBeUndefined();
  });
});
