import {
  MAX_LIGNES,
  mesEnfantsEnBref,
} from '../mesEnfantsEnBref';

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

/**
 * PAR-L7 (13/10, design parent E01 / E02 / E03) — LES ENFANTS EN BREF.
 *
 * « Mon profil » dit d'un enfant son prénom et où il en est (« Anissa · U11 Filles », « Martin ·
 * Demande en attente »), 3 au plus puis « + 2 autres » ; « Mon compte » et l'accueil en lisent
 * le nombre et les prénoms. Ce fichier ne monte rien : il lit les formes que rendent
 * `/declared-children/mine`, `/parent-links/as-parent` et `/club-interest-requests/mine`
 * (staging admin `be552cba`).
 * REC17-001 (17/10) : la carte « Mes enfants » de l'accueil ne nomme plus les enfants ; ses
 * lignes et leurs destinations (`lignesAAfficher`, `lignesDeLaCarte`, `destinationDeLaLigne`)
 * sont retirées avec leurs témoins (`accueilMesEnfantsUneEntree.test.js` garde l'accueil).
 */

const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };

const fiche = (prenom, extra = {}) => ({
  age: 9,
  documentId: `fiche-${prenom.toLowerCase()}`,
  firstname: prenom,
  lastname: 'Haddad',
  ...extra,
});

/**
 * Une ligne telle que « Mon profil » l'écrit.
 * @param {{ prenom: string, etat: string }} ligne - La ligne.
 * @returns {string} - « Anissa · U11 Filles ».
 */
const texte = (ligne) => `${ligne.prenom} · ${ligne.etat}`;

describe('mesEnfantsEnBref — une ligne par enfant, le prénom d abord', () => {
  test('en équipe : le nom de son équipe (« Anissa · U11 Filles »)', () => {
    const bref = mesEnfantsEnBref({
      fiches: [fiche('Anissa', {
        club: FOUNDCLUB, team: { documentId: 'u11f', name: 'U11 Filles' },
      })],
      t,
    });

    expect(bref.lignes.map(texte)).toEqual(['Anissa · U11 Filles']);
    expect(bref.total).toBe(1);
  });

  test('une demande qui attend : « Martin · Demande en attente » ; deux : le nombre', () => {
    const attente = (id) => ({
      declaredChild: { documentId: 'fiche-martin' },
      documentId: id,
      status: 'pending',
      team: { club: FOUNDCLUB, documentId: id, name: id },
    });
    const une = mesEnfantsEnBref({ demandes: [attente('u9')], fiches: [fiche('Martin')], t });
    const deux = mesEnfantsEnBref({
      demandes: [attente('u9'), attente('u10')], fiches: [fiche('Martin')], t,
    });

    expect(une.lignes.map(texte)).toEqual(['Martin · Demande en attente']);
    expect(deux.lignes.map(texte)).toEqual(['Martin · 2 demandes en attente']);
  });

  test('ni équipe ni demande : « Pas encore d’équipe »', () => {
    const bref = mesEnfantsEnBref({ fiches: [fiche('Léa')], t });

    expect(bref.lignes.map(texte)).toEqual(['Léa · Pas encore d’équipe']);
  });

  test('un compte relié vient d abord, comme dans « Mes enfants »', () => {
    const bref = mesEnfantsEnBref({
      comptesRelies: [{ documentId: 'user-hugo', firstname: 'Hugo', lastname: 'Haddad' }],
      fiches: [fiche('Léa')],
      t,
    });

    expect(bref.lignes.map(texte))
      .toEqual(['Hugo · A son compte', 'Léa · Pas encore d’équipe']);
    expect(bref.lignes.map((ligne) => ligne.cle)).toEqual(['compte-user-hugo', 'fiche-fiche-léa']);
    expect(bref.total).toBe(2);
  });

  test(`au-delà de ${MAX_LIGNES} : les ${MAX_LIGNES} premiers, et combien restent`, () => {
    const bref = mesEnfantsEnBref({
      fiches: ['Anissa', 'Martin', 'Léa', 'Noé', 'Ines'].map((prenom) => fiche(prenom)),
      t,
    });

    expect(bref.lignes.map((ligne) => ligne.prenom)).toEqual(['Anissa', 'Martin', 'Léa']);
    expect(bref.reste).toBe(2);
    expect(bref.total).toBe(5);
  });

  test('rien à lire : aucun enfant, aucune erreur', () => {
    // REC17-001-B : le résumé de la carte d'accueil s'ajoute, tout à zéro.
    const SANS_RESUME = {
      comptes: 0, demandesEnAttente: 0, enEquipe: 0, sansEquipe: 0,
    };
    expect(mesEnfantsEnBref({ t })).toEqual({
      lignes: [], reste: 0, resume: SANS_RESUME, total: 0,
    });
    expect(mesEnfantsEnBref({
      comptesRelies: 'illisible', demandes: null, fiches: undefined, t,
    })).toEqual({
      lignes: [], reste: 0, resume: SANS_RESUME, total: 0,
    });
  });
});
