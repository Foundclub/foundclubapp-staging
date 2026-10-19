import {
  etatDeDemandeVille,
  gesteDeLaVille,
} from '@/domains/collectivite/collectiviteRattachement';

// 🏛️ R17-INVITER (19/10/2026, REC17-009) — « on prend la recherche de club comme elle est de base
// sur l'app, et dès qu'on trouve le club on clique sur un bouton pour dire « ce club fait partie
// de ma collectivité », et ça lui envoie une demande » (Adel, Test 17/10).
//
// La recherche habituelle ne rend que des clubs : l'état d'un club AVEC la Ville se lit dans les
// demandes de la Ville (`GET /collectivites/:id/club-requests`), et dans le refus du serveur quand
// la Ville vient d'appuyer (les 409 existants). Ce que ce témoin exige (ROUGE avant le lot : la
// fonction n'existait pas) :
//   G1 — le bon geste pour chaque état, dont « la demande attend le premier dirigeant du club » ;
//   G2 — les refus du serveur, en mots : rattaché ailleurs ; le serveur d'aujourd'hui, qui refuse
//        encore un club sans dirigeant ;
//   G3 — les demandes d'un AUTRE club ne comptent pas.

const ligne = (/** @type {Record<string, unknown>} */ champs) => ({
  attachedElsewhere: false,
  club: { documentId: 'judo-e', name: 'Judo Club E' },
  documentId: 'd1',
  kind: 'proposal',
  state: 'pending',
  ...champs,
});

describe('R17INVIT · G1 — le geste de la Ville sur la carte d’un club', () => {
  it.each([
    [[], 'envoyer'],
    [[ligne({ state: 'attached' })], 'rattache'],
    [[ligne({ kind: 'attach_request', state: 'attached' })], 'rattache'],
    [[ligne({ attachedElsewhere: true, kind: 'attach_request' })], 'ailleurs'],
    [[ligne({ kind: 'attach_request' })], 'aRepondre'],
    [[ligne({})], 'envoyee'],
    [[ligne({ awaitingLeader: true })], 'attendDirigeant'],
    [[ligne({ state: 'refused' })], 'refusee'],
    [[ligne({ state: 'accepted' })], 'envoyer'],
    [[ligne({ kind: 'attach_request', state: 'refused' })], 'envoyer'],
  ])('%j ⇒ %s', (demandes, attendu) => {
    expect(gesteDeLaVille(demandes, 'judo-e')).toBe(attendu);
  });
});

describe('R17INVIT · G2 — les refus du serveur, en mots', () => {
  it('rattaché à une autre collectivité (409) : « ailleurs », même sans demande connue', () => {
    expect(gesteDeLaVille([], 'judo-e', 'COLLECTIVITE_CLUB_ALREADY_ATTACHED')).toBe('ailleurs');
  });

  it('le serveur d’aujourd’hui refuse un club sans dirigeant (409) : « sansDirigeant »', () => {
    expect(gesteDeLaVille([], 'judo-e', 'COLLECTIVITE_CLUB_WITHOUT_LEADER')).toBe('sansDirigeant');
  });

  it('un autre refus ne change pas le geste (le message s’affiche dessous)', () => {
    expect(gesteDeLaVille([], 'judo-e', 'COLLECTIVITE_DEMO_FORBIDDEN')).toBe('envoyer');
  });

  it('une lecture absente ou étrange ne fait rien inventer', () => {
    expect(gesteDeLaVille(undefined, 'judo-e')).toBe('envoyer');
    expect(gesteDeLaVille([null, { kind: 'proposal' }], 'judo-e')).toBe('envoyer');
  });
});

describe('R17INVIT · G3 — seules les demandes de CE club comptent', () => {
  it('la demande d’un autre club ne colore pas la carte', () => {
    const autre = ligne({ club: { documentId: 'tennis-f' }, state: 'attached' });
    expect(gesteDeLaVille([autre], 'judo-e')).toBe('envoyer');
    expect(gesteDeLaVille([autre], 'tennis-f')).toBe('rattache');
  });
});

describe('R17INVIT · G4 — la liste des demandes de la Ville le dit aussi', () => {
  const t = (/** @type {string} */ _cle, /** @type {any} */ defaut) => String(defaut);

  it('sa demande qui attend le premier dirigeant : « Demande enregistrée »', () => {
    const demande = { awaitingLeader: true, kind: 'proposal', state: 'pending' };
    expect(etatDeDemandeVille(t, demande)).toEqual({
      ligne: 'Demande enregistrée : elle attend le premier dirigeant du club.',
      pastille: 'En attente',
      ton: 'neutre',
    });
  });

  it('les autres demandes en attente gardent leur ligne', () => {
    expect(etatDeDemandeVille(t, { kind: 'proposal', state: 'pending' }).ligne)
      .toBe('Envoyée au club : ses dirigeants acceptent ou refusent.');
  });
});
