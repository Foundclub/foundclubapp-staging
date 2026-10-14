import {
  destinationDeLaLigne,
  lignesAAfficher,
  lignesDeLaCarte,
  MAX_LIGNES,
  mesEnfantsEnBref,
  texteDeLaLigne,
} from '../mesEnfantsEnBref';

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

/**
 * PAR-L7 (13/10, design parent E01 / E02 / E03) — LES ENFANTS EN BREF.
 *
 * L'accueil, « Mon compte » et « Mon profil » disent la même chose d'un enfant : son prénom et
 * où il en est (« Anissa · U11 Filles », « Martin · Demande en attente »), 3 au plus puis
 * « + 2 autres ». Ce fichier ne monte rien : il lit les formes que rendent `/declared-children/
 * mine`, `/parent-links/as-parent` et `/club-interest-requests/mine` (staging admin `be552cba`).
 */

const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };

const fiche = (prenom, extra = {}) => ({
  age: 9,
  documentId: `fiche-${prenom.toLowerCase()}`,
  firstname: prenom,
  lastname: 'Haddad',
  ...extra,
});

describe('mesEnfantsEnBref — une ligne par enfant, le prénom d abord', () => {
  test('en équipe : le nom de son équipe (« Anissa · U11 Filles »)', () => {
    const bref = mesEnfantsEnBref({
      fiches: [fiche('Anissa', {
        club: FOUNDCLUB, team: { documentId: 'u11f', name: 'U11 Filles' },
      })],
      t,
    });

    expect(bref.lignes.map(texteDeLaLigne)).toEqual(['Anissa · U11 Filles']);
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

    expect(une.lignes.map(texteDeLaLigne)).toEqual(['Martin · Demande en attente']);
    expect(deux.lignes.map(texteDeLaLigne)).toEqual(['Martin · 2 demandes en attente']);
  });

  test('ni équipe ni demande : « Pas encore d’équipe »', () => {
    const bref = mesEnfantsEnBref({ fiches: [fiche('Léa')], t });

    expect(bref.lignes.map(texteDeLaLigne)).toEqual(['Léa · Pas encore d’équipe']);
  });

  test('un compte relié vient d abord, comme dans « Mes enfants »', () => {
    const bref = mesEnfantsEnBref({
      comptesRelies: [{ documentId: 'user-hugo', firstname: 'Hugo', lastname: 'Haddad' }],
      fiches: [fiche('Léa')],
      t,
    });

    expect(bref.lignes.map(texteDeLaLigne))
      .toEqual(['Hugo · A son compte', 'Léa · Pas encore d’équipe']);
    expect(bref.lignes.map((ligne) => ligne.cible)).toEqual([
      { id: 'user-hugo', type: 'compte' },
      // PAR-L7 E01 (14/10) : une fiche dit aussi si elle a SA page (moins de 13 ans).
      { aSaPage: true, id: 'fiche-léa', type: 'fiche' },
    ]);
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
    expect(mesEnfantsEnBref({ t })).toEqual({ lignes: [], reste: 0, total: 0 });
    expect(mesEnfantsEnBref({
      comptesRelies: 'illisible', demandes: null, fiches: undefined, t,
    })).toEqual({ lignes: [], reste: 0, total: 0 });
  });
});

describe('lignesAAfficher — ce que la carte d accueil écrit sous « Mes enfants »', () => {
  test('une ligne par enfant, puis « + 2 autres » quand il en reste', () => {
    const bref = mesEnfantsEnBref({
      fiches: ['Anissa', 'Martin', 'Léa', 'Noé', 'Ines'].map((prenom) => fiche(prenom)),
      t,
    });

    expect(lignesAAfficher(t, bref)).toEqual([
      'Anissa · Pas encore d’équipe',
      'Martin · Pas encore d’équipe',
      'Léa · Pas encore d’équipe',
      '+ 2 autres',
    ]);
  });

  test('un seul de plus : « + 1 autre » ; aucun de plus : rien après les prénoms', () => {
    const quatre = mesEnfantsEnBref({
      fiches: ['Anissa', 'Martin', 'Léa', 'Noé'].map((prenom) => fiche(prenom)),
      t,
    });
    const un = mesEnfantsEnBref({ fiches: [fiche('Anissa')], t });

    expect(lignesAAfficher(t, quatre).at(-1)).toBe('+ 1 autre');
    expect(lignesAAfficher(t, un)).toEqual(['Anissa · Pas encore d’équipe']);
  });
});

// PAR-L7 (14/10, design parent E01 validé : « une ligne d'enfant → sa fiche ») — OÙ MÈNE UNE
// LIGNE, la même règle que « Mes enfants » : une fiche de moins de 13 ans a SA page ; une fiche
// de 13 ans et plus n'en a pas (la liste porte « Donner un compte ») ; un compte relié ouvre
// son profil. Les routes vivent dans « Mon compte » (ProfileStack).
describe('destinationDeLaLigne / lignesDeLaCarte — chaque ligne ouvre SA fiche', () => {
  const { RouteNames } = jest.requireActual('@/navigation/routeNames');

  test('moins de 13 ans : sa page ; 13+ : la liste ; compte relié : son profil', () => {
    const bref = mesEnfantsEnBref({
      comptesRelies: [{ documentId: 'user-hugo', firstname: 'Hugo' }],
      fiches: [fiche('Anissa', { age: 9 }), fiche('Lina', { age: 14 })],
      t,
    });

    expect(bref.lignes.map((ligne) => destinationDeLaLigne(ligne.cible))).toEqual([
      { params: { userId: 'user-hugo' }, screen: RouteNames.UserDetails },
      { params: { childDocumentId: 'fiche-anissa' }, screen: RouteNames.MyChildren },
      { screen: RouteNames.MyChildren },
    ]);
  });

  test('les lignes de la carte : nommées, chacune s ouvre ; « + 2 autres » reste du texte', () => {
    const ouvrir = jest.fn();
    const bref = mesEnfantsEnBref({
      fiches: ['Anissa', 'Martin', 'Léa', 'Noé', 'Ines'].map((prenom) => fiche(prenom)),
      t,
    });
    const lignes = lignesDeLaCarte(t, bref, ouvrir);

    expect(lignes.map((ligne) => ligne.texte)).toEqual([
      'Anissa · Pas encore d’équipe',
      'Martin · Pas encore d’équipe',
      'Léa · Pas encore d’équipe',
      '+ 2 autres',
    ]);
    expect(lignes[0].accessibilityLabel).toBe('Anissa, Pas encore d’équipe');
    lignes[0].onPress();
    expect(ouvrir).toHaveBeenCalledWith({
      params: { childDocumentId: 'fiche-anissa' }, screen: RouteNames.MyChildren,
    });
    expect(lignes[3].onPress).toBeUndefined();
  });
});
