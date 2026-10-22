import {
  libelleDeLaCarte,
  mesEnfantsEnBref,
  pastilleDeLaCarte,
} from '../mesEnfantsEnBref';

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

/**
 * REC17-001-B (choix d'Adel « carte B » du 22/10, planche 14 du parcours parent) — LA CARTE
 * « MES ENFANTS » DE L'ACCUEIL DIT L'ESSENTIEL, SANS PRÉNOM.
 *
 * Une seule porte (REC17-001 du 19/10), avec le nombre d'enfants et UNE pastille, la plus
 * urgente : « n demande(s) en attente » (orange), sinon « n sans équipe » (bleu), sinon « Tous en
 * équipe » (vert) ; sans enfant, « Ajoute ton enfant ». La règle de l'état d'un enfant est celle
 * de l'écran « Mes enfants » (`etatDeLEnfant`) : jamais « en attente » ici et « en équipe » là.
 * ROUGE avant le lot : ni résumé, ni pastille, ni libellé.
 */

const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };

const fiche = (/** @type {string} */ prenom, extra = {}) => ({
  documentId: `fiche-${prenom.toLowerCase()}`,
  firstname: prenom,
  ...extra,
});
const enEquipe = (/** @type {string} */ prenom) => fiche(prenom, {
  club: FOUNDCLUB, team: { documentId: `eq-${prenom}`, name: 'U11' },
});
const attente = (/** @type {string} */ prenom, /** @type {string} */ id) => ({
  declaredChild: { documentId: `fiche-${prenom.toLowerCase()}` },
  documentId: id,
  status: 'pending',
  team: { club: FOUNDCLUB, documentId: id, name: id },
});
const COMPTE = { documentId: 'user-hugo', firstname: 'Hugo' };

describe('REC17-001-B — le résumé des enfants (règle de « Mes enfants »)', () => {
  test('1 ROUGE-AVANT — compte les demandes en attente, les sans équipe, les en équipe', () => {
    const bref = mesEnfantsEnBref({
      comptesRelies: [COMPTE],
      demandes: [attente('Romain', 'u9'), attente('Romain', 'u10')],
      fiches: [fiche('Romain'), fiche('Greg'), enEquipe('Anissa')],
      t,
    });
    expect(bref.resume).toEqual({
      comptes: 1, demandesEnAttente: 2, enEquipe: 1, sansEquipe: 1,
    });
    expect(bref.total).toBe(4);
  });
});

describe('REC17-001-B — UNE pastille, la plus urgente', () => {
  test('2 ROUGE-AVANT — une demande attend : « 1 demande en attente », orange', () => {
    const bref = mesEnfantsEnBref({
      demandes: [attente('Romain', 'u9')], fiches: [fiche('Romain'), fiche('Greg')], t,
    });
    expect(pastilleDeLaCarte(bref, t)).toEqual({ texte: '1 demande en attente', ton: 'attente' });
  });

  test('3 ROUGE-AVANT — deux demandes : le pluriel', () => {
    const bref = mesEnfantsEnBref({
      demandes: [attente('Romain', 'u9'), attente('Romain', 'u10')], fiches: [fiche('Romain')], t,
    });
    expect(pastilleDeLaCarte(bref, t)?.texte).toBe('2 demandes en attente');
  });

  test('4 ROUGE-AVANT — aucune demande, un enfant sans équipe : « 1 sans équipe », bleu', () => {
    const bref = mesEnfantsEnBref({ fiches: [fiche('Greg'), enEquipe('Anissa')], t });
    expect(pastilleDeLaCarte(bref, t)).toEqual({ texte: '1 sans équipe', ton: 'compte' });
  });

  test('5 ROUGE-AVANT — tous en équipe : « Tous en équipe », vert', () => {
    const bref = mesEnfantsEnBref({ fiches: [enEquipe('Anissa'), enEquipe('Martin')], t });
    expect(pastilleDeLaCarte(bref, t)).toEqual({ texte: 'Tous en équipe', ton: 'ok' });
  });

  test('6 PROTEGE — un enfant a son compte : son équipe inconnue, pas de « Tous »', () => {
    const bref = mesEnfantsEnBref({ comptesRelies: [COMPTE], fiches: [enEquipe('Anissa')], t });
    expect(pastilleDeLaCarte(bref, t)).toBeNull();
  });

  test('7 PROTEGE — sans enfant : pas de pastille (la carte dit « Ajoute ton enfant »)', () => {
    expect(pastilleDeLaCarte(mesEnfantsEnBref({ t }), t)).toBeNull();
  });
});

describe('REC17-001-B — ce qu entend le lecteur d écran', () => {
  test('8 ROUGE-AVANT — « Mes enfants, 2 enfants, 1 demande en attente »', () => {
    const bref = mesEnfantsEnBref({
      demandes: [attente('Romain', 'u9')], fiches: [fiche('Romain'), fiche('Greg')], t,
    });
    expect(libelleDeLaCarte({ ...bref, connu: true }, t))
      .toBe('Mes enfants, 2 enfants, 1 demande en attente');
  });

  test('9 ROUGE-AVANT — sans enfant : « Mes enfants, Ajoute ton enfant »', () => {
    expect(libelleDeLaCarte({ ...mesEnfantsEnBref({ t }), connu: true }, t))
      .toBe('Mes enfants, Ajoute ton enfant');
  });

  test('10 PROTEGE — pas encore lu : « Mes enfants », rien de plus', () => {
    expect(libelleDeLaCarte({ ...mesEnfantsEnBref({ t }), connu: false }, t)).toBe('Mes enfants');
  });
});
