import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpSelection from '../MatchCallUpSelection';

// D77 — ECRANS 1 et 2 du pack composition : « Selection des convoques » et
// « Convoquer hors equipe » (le pack dit « meme ecran » : ce sont 3 onglets).
//
// Les 3 regles non negociables que ce fichier tient :
//   1. Un indisponible est AVERTI EN JAUNE et reste COCHABLE — on avertit, on
//      ne bloque pas, « le coach sait mieux ».
//   2. Un joueur hors app sans SMS porte son etiquette PARTOUT ou il apparait.
//   3. Le compteur du bas dit la verite : convoques, titulaires, banc,
//      renforts, hors app.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockSetParams = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockEvent;
/** @type {any} */
let mockClubTeams;
/** @type {any} */
let mockAlert;

// 🧨 L'objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent, et Jest part en boucle infinie SANS message utile
// (piege paye le 2026-08-11).
const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  setParams: mockSetParams,
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      // Double de `t` fidele sur les 2 mecanismes dont l'ecran depend :
      // le pluriel `_one` / `_other` et l'interpolation `{{...}}`.
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent, isFetching: false }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: () => ({ data: mockClubTeams, isFetching: false }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>RETOUR</TexteRN>,
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

const couleursReelles = jest.requireActual('@/theme/colors').default();

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Appuie sur l'element le plus profond dont le texte contient ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(libelle))
    .pop();
  await act(async () => { cible.props.onPress(); });
};

/**
 * La rangee (cochable) qui porte ce nom de joueur.
 * @param {any} arbre
 * @param {string} nom
 * @returns {any}
 */
const rangeeJoueur = (arbre, nom) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button'
    && noeud.props?.accessibilityState?.selected !== undefined
    && aplatirTexte(noeud.props.children).includes(nom))[0];

const joueur = (id, firstname, lastname, extra = {}) => ({
  documentId: id, firstname, lastname, ...extra,
});

const EFFECTIF = [
  joueur('p1', 'Moussa', 'Diallo', { number: 1, position: 'GB' }),
  joueur('p2', 'Hugo', 'Fofana', { number: 6, position: 'DD' }),
  joueur('p3', 'Théo', 'Marchal', { number: 3, position: 'DC' }),
];

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    clubId: 'club_1',
    eventId: 'evt_1',
    players: EFFECTIF,
    sport: 'football',
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpSelection />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockSetParams.mockClear();
  mockEvent = { team: { club: { documentId: 'club_1' }, documentId: 'team_1' } };
  mockClubTeams = {
    pages: [{
      data: [
        { documentId: 'team_1', name: 'Senior 1', players: EFFECTIF },
        {
          documentId: 'team_2',
          name: 'U19',
          players: [
            joueur('r1', 'Bilal', 'Lopez', { number: 14, position: 'MC' }),
            joueur('r2', 'Karim', 'Sylla', {
              number: 8, position: 'MD', unavailabilityReason: 'licence',
            }),
            joueur('r3', 'Enzo', 'Petit', {
              number: 9, position: 'AT', suspensionMatches: 1, unavailabilityReason: 'suspension',
            }),
          ],
        },
      ],
    }],
  };
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// 🧨 On DEMONTE entre deux tests : un arbre orphelin garde ses effets vivants
// et continue de reagir aux doubles partages, ce qui a produit 16 « Maximum
// update depth exceeded » alors que les 18 tests etaient verts (piege D68).
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
});

describe('D77 ecran 1 — selection des convoques', () => {
  test('en-tete, recherche, ligne « Ajouter un joueur » et effectif sont la', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Convoqués');
    expect(texte).toContain('1/2');
    expect(texte).toContain('Ajouter un joueur');
    expect(texte).toContain("Nom, prénom et numéro, pour un joueur sans l'app");
    expect(texte).toContain('EFFECTIF SENIOR 1 · 3');
    expect(texte).toContain('Moussa Diallo');
    expect(texte).toContain('N°1 · GB');
    expect(texte).toContain('Suivant');
  });

  test('rien n est coche au depart, et le compteur reste muet', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('0 convoqués');
    // Masque si zero : pas de « 0 titulaires » en vitrine.
    expect(texte).not.toContain('titulaires ·');
  });

  test('cocher un joueur fait monter le compteur, et il dit la verite', async () => {
    const arbre = await rendre();
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('1 convoqué');
    // 1 coche au football : 1 titulaire, 0 sur le banc. Jamais « 11 titulaires ».
    expect(texte).toContain('1 titulaires · 0 sur le banc');
  });

  test('la recherche filtre l effectif sur le nom', async () => {
    const arbre = await rendre();
    await act(async () => {
      arbre.root.findAllByType(TextInput)[0].props.onChangeText('fofana');
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('Hugo Fofana');
    expect(texte).not.toContain('Moussa Diallo');
  });

  test('la ligne pointillee ouvre l ecran 3 en lui rendant les parametres du retour', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, "Nom, prénom et numéro, pour un joueur sans l'app");

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCallUpManualPlayer');
    expect(parametres.teamName).toBe('Senior 1');
    expect(parametres.returnParams.eventId).toBe('evt_1');
  });

  test('« Suivant » sans personne coche avertit et ne navigue pas', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Suivant');

    expect(mockAlert).toHaveBeenCalledWith('Attention', 'Sélectionne au moins un joueur.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('« Suivant » passe la selection au terrain, dans la forme que le board lit', async () => {
    const arbre = await rendre();
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('TacticalBoardV2');
    expect(parametres.selectedPlayers).toHaveLength(1);
    expect(parametres.selectedPlayers[0].documentId).toBe('p1');
    // Les parametres d'origine suivent : l'evenement, l'equipe, le sport.
    expect(parametres.eventId).toBe('evt_1');
    expect(parametres.teamId).toBe('team_1');
  });

  test('une composition existante pre-coche les joueurs deja convoques', async () => {
    const arbre = await rendre({
      existingComposition: { schemaVersion: 3, selectedPlayerIds: ['p1', 'p3'] },
    });

    expect(texteVisible(arbre)).toContain('2 convoqués');
    expect(rangeeJoueur(arbre, 'Moussa Diallo').props.accessibilityState.selected).toBe(true);
    expect(rangeeJoueur(arbre, 'Hugo Fofana').props.accessibilityState.selected).toBe(false);
  });
});

describe('D77 ecran 2 — convoquer hors equipe', () => {
  test('les 3 onglets sont la, en pleine largeur', async () => {
    const arbre = await rendre();
    // `deep: false` : sans lui, le role porte par le bouton se retrouve aussi
    // sur les vues qu'il rend, et on en compte 15 au lieu de 3.
    const onglets = arbre.root
      .findAll(
        (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'tab',
        { deep: false },
      );

    expect(onglets).toHaveLength(3);
    expect(onglets.map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children)))
      .toEqual(['Senior 1', 'Autres équipes', 'Hors app']);
  });

  test('l onglet « Autres equipes » montre les renforts, avec leur equipe d origine', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Autres équipes');

    const texte = texteVisible(arbre);
    expect(texte).toContain('RENFORTS DU CLUB · 3');
    expect(texte).toContain('Bilal Lopez');
    // Le chip de l'equipe d'origine.
    expect(texte).toContain('U19');
    // L'equipe du match elle-meme n'est PAS un renfort.
    expect(texte).not.toContain('Moussa Diallo');
  });

  test('🟡 un indisponible est averti EN JAUNE, et sa meta est REMPLACEE par le motif', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Autres équipes');

    const texte = texteVisible(arbre);
    expect(texte).toContain('Licence non validée');
    expect(texte).toContain('Suspendu 1 match');
    // Le motif remplace la meta : le numero du joueur suspendu a disparu.
    expect(texte).not.toContain('N°8 · MD');

    const motif = arbre.root
      .findAllByType(Text)
      .find((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children)
        === 'Licence non validée');
    const styles = [motif.props.style].flat(Infinity).filter(Boolean);
    expect(styles.some((/** @type {any} */ style) => style?.color === couleursReelles.warning500))
      .toBe(true);
  });

  test('🚨 ET IL RESTE COCHABLE — on avertit, on ne bloque pas', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Autres équipes');

    const rangee = rangeeJoueur(arbre, 'Karim Sylla');
    expect(rangee.props.accessibilityState.selected).toBe(false);

    await act(async () => { rangee.props.onPress(); });

    expect(rangeeJoueur(arbre, 'Karim Sylla').props.accessibilityState.selected).toBe(true);
    expect(texteVisible(arbre)).toContain('1 convoqué');
  });

  test('le compteur du bas distingue les renforts et les joueurs hors app', async () => {
    const arbre = await rendre();
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });
    await appuyerSur(arbre, 'Autres équipes');
    await act(async () => {
      rangeeJoueur(arbre, 'Bilal Lopez').props.onPress();
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('2 convoqués');
    expect(texte).toContain('dont 1 renforts · 0 hors app');
  });

  test('sans autre equipe dans le club, l onglet le dit au lieu de rester vide', async () => {
    mockClubTeams = {
      pages: [{ data: [{ documentId: 'team_1', name: 'Senior 1', players: EFFECTIF }] }],
    };
    const arbre = await rendre();
    await appuyerSur(arbre, 'Autres équipes');

    expect(texteVisible(arbre)).toContain('Aucune autre équipe dans le club');
  });
});

describe('D77 — le joueur hors app et son etiquette', () => {
  const horsApp = {
    documentId: 'manual_1700000000000',
    firstname: 'Yanis',
    id: 'manual_1700000000000',
    isManual: true,
    lastname: 'Bertrand',
    number: '23',
  };

  test('il arrive de l ecran 3, est coche seul, et l onglet « Hors app » s ouvre', async () => {
    const arbre = await rendre({ pendingManualPlayer: horsApp });
    const texte = texteVisible(arbre);

    expect(texte).toContain('DÉJÀ AJOUTÉS · 1');
    expect(texte).toContain('Yanis Bertrand');
    expect(texte).toContain('1 convoqué');
    // Le parametre est consomme puis efface : un re-rendu ne l'ajoute pas 2 fois.
    expect(mockSetParams).toHaveBeenCalledWith({ pendingManualPlayer: undefined });
  });

  test('SANS SMS, son nom porte « Pas de SMS — préviens-le toi-même », en jaune', async () => {
    const arbre = await rendre({ pendingManualPlayer: horsApp });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Hors app');
    expect(texte).toContain('Pas de SMS — préviens-le toi-même');

    const etiquette = arbre.root
      .findAllByType(Text)
      .find((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children)
        === 'Pas de SMS — préviens-le toi-même');
    const styles = [etiquette.props.style].flat(Infinity).filter(Boolean);
    expect(styles.some((/** @type {any} */ style) => style?.color === couleursReelles.warning500))
      .toBe(true);
  });

  test('AVEC SMS accepte, l etiquette disparait et le numero revient', async () => {
    const arbre = await rendre({
      pendingManualPlayer: { ...horsApp, notifyBySms: true, phone: '0612345678' },
    });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Pas de SMS');
    expect(texte).toContain('N°23');
  });

  test('il voyage avec les autres convoques, dans la MEME liste', async () => {
    const arbre = await rendre({ pendingManualPlayer: horsApp });
    await appuyerSur(arbre, 'Suivant');

    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.selectedPlayers).toHaveLength(1);
    expect(parametres.selectedPlayers[0].id).toBe('manual_1700000000000');
    expect(parametres.selectedPlayers[0].isManual).toBe(true);
  });
});
