import {
  Alert, ScrollView, StyleSheet, Text, TextInput,
} from 'react-native';
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

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. ⚠️ Cette fabrique est A FORME FIXE (pas de cle isLoading) : les
// temoins d etat de chargement vivent dans MatchCallUpSelection.PERF2.
// chargement.test.js, avec des requetes pilotables — ne pas en ecrire ici.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

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

// AC09 — la fenetre de prevention. On garde le double le plus betement fidele
// possible : elle n'existe dans l'arbre QUE quand elle est ouverte, et son pied
// (les 2 boutons) est rendu avec elle.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <VueRN>
          {children}
          {footerComponent}
        </VueRN>
      ) : null
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

  // D79 — « Suivant » mene desormais a l'ecran 4 (« Partir de… »), qui ouvre
  // ensuite le terrain. La FORME de la selection transmise, elle, n'a pas bouge.
  test('« Suivant » passe la selection a l ecran 4, dans la forme que le board lit', async () => {
    const arbre = await rendre();
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCompositionStart');
    expect(parametres.selectedPlayers).toHaveLength(1);
    expect(parametres.selectedPlayers[0].documentId).toBe('p1');
    // Les parametres d'origine suivent : l'evenement, l'equipe, le sport.
    expect(parametres.eventId).toBe('evt_1');
    expect(parametres.teamId).toBe('team_1');
  });

  // S04 — 🔴 LE DEFAUT QU ADEL A VU : « Nul, car ça ne garde pas les joueurs qui
  // sont sur le terrain. Imaginons que je retire un joueur de la liste : ça doit
  // JUSTE retirer le joueur de la compo et GARDER LE RESTE A SA PLACE. »
  //
  // Une compo deja placee (publiee, enregistree, ou en cours a l'ecran 5) ne
  // repasse plus par « Partir de… » : ce serait redemander d'ou partir alors
  // qu'on part de ce qui est deja pose.
  describe('S04 — modifier la liste ne rebat pas le terrain', () => {
    const COMPO_PLACEE = {
      schemaVersion: 3,
      selectedPlayerIds: ['p1', 'p2', 'p3'],
      teams: [{
        id: 'team_1',
        placements: [
          {
            playerId: 'p1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
          },
          {
            playerId: 'p2', positionX: 11, positionY: 22, slotId: null,
          },
          {
            playerId: 'p3', positionX: 33, positionY: 44, slotId: null,
          },
        ],
      }],
    };

    test('🥇 TEMOIN D ARRET : retirer un convoque rouvre LE TERRAIN, chacun en place', async () => {
      const arbre = await rendre({ existingComposition: COMPO_PLACEE });
      await act(async () => {
        rangeeJoueur(arbre, 'Théo Marchal').props.onPress();
      });
      await appuyerSur(arbre, 'Suivant');

      const [nomEcran, parametres] = mockNavigate.mock.calls[0];
      // ⛔ PAS « MatchCompositionStart » : on ne redemande pas d'ou partir.
      expect(nomEcran).toBe('MatchCompositionBoard');
      expect(parametres.selectedPlayers).toHaveLength(2);
      expect(parametres.startPlacements).toEqual([
        {
          playerId: 'p1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
        },
        {
          playerId: 'p2', positionX: 11, positionY: 22, slotId: null,
        },
      ]);
    });

    test('le terrain rendu par l ecran 5 l emporte sur le pack enregistre', async () => {
      const arbre = await rendre({
        existingComposition: COMPO_PLACEE,
        startPlacements: [{
          playerId: 'p2', positionX: 7, positionY: 8, slotId: null,
        }],
      });
      await appuyerSur(arbre, 'Suivant');

      const [nomEcran, parametres] = mockNavigate.mock.calls[0];
      expect(nomEcran).toBe('MatchCompositionBoard');
      expect(parametres.startPlacements).toEqual([{
        playerId: 'p2', positionX: 7, positionY: 8, slotId: null,
      }]);
    });

    test('⛔ NON-REGRESSION : sans aucun placement, on passe TOUJOURS par l ecran 4', async () => {
      const arbre = await rendre({
        existingComposition: { schemaVersion: 3, selectedPlayerIds: ['p1'] },
      });
      await appuyerSur(arbre, 'Suivant');

      expect(mockNavigate.mock.calls[0][0]).toBe('MatchCompositionStart');
    });
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

  test(
    '🟡 un indisponible est averti EN JAUNE, et sa meta est REMPLACEE par le motif',
    async () => {
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
    },
  );

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

  test('son nom porte « Préviens-le toi-même », en jaune', async () => {
    const arbre = await rendre({ pendingManualPlayer: horsApp });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Hors app');
    expect(texte).toContain('Préviens-le toi-même');

    const etiquette = arbre.root
      .findAllByType(Text)
      .find((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children)
        === 'Préviens-le toi-même');
    const styles = [etiquette.props.style].flat(Infinity).filter(Boolean);
    expect(styles.some((/** @type {any} */ style) => style?.color === couleursReelles.warning500))
      .toBe(true);
  });

  // ⚠️ C-A (2026-08-14) — ce temoin disait l'inverse : « AVEC SMS accepte,
  // l etiquette disparait ». C'etait le defaut, pas la regle. Un ancien joueur
  // encore porteur de `notifyBySms: true` en base ne sera JAMAIS prevenu :
  // aucun service d'envoi n'existe. L'etiquette doit donc rester.
  test('🔒 un ancien joueur marque « SMS accepte » garde son etiquette', async () => {
    const arbre = await rendre({
      pendingManualPlayer: { ...horsApp, notifyBySms: true, phone: '0612345678' },
    });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Préviens-le toi-même');
    expect(texte).not.toContain('0612345678');
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

// D84 — « On ne peut pas faire Suivant quand on a trop de joueurs » (Adel, 12/08).
//
// 🧨 CE QUE LA MESURE A CONTREDIT : la barre du bas etait DEJA hors du
// ScrollView. Le defaut n'etait pas sa place dans l'arbre, c'est que le
// conteneur defilant n'etait pas BORNE : sans `flex: 1`, React Native mesure un
// ScrollView a la hauteur de ses enfants (le defaut de `flexShrink` y vaut 0),
// donc la liste POUSSAIT la barre hors de l'ecran au lieu de defiler dessous.
// Mesure (iPhone 14, 844 pt) : la barre deborde des 6 joueurs, et le bouton
// « Suivant » est ENTIEREMENT hors ecran des 7.
describe('D84 — la barre du bas reste atteignable, quel que soit l effectif', () => {
  const EFFECTIF_LONG = Array.from({ length: 25 }, (_, index) => joueur(
    `long_${index}`,
    `Prenom${index}`,
    `Nom${index}`,
    { number: index + 1, position: 'DC' },
  ));

  /**
   * Tout le texte porte par un noeud de l'arbre JSON, enfants compris.
   * @param {any} noeud
   * @returns {string}
   */
  const texteDuNoeud = (noeud) => {
    if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
    if (typeof noeud !== 'object') return String(noeud);
    return (noeud.children || []).map(texteDuNoeud).join(' ');
  };

  /**
   * Le noeud hote du conteneur defilant, dans l'arbre JSON.
   * @param {any} noeud
   * @returns {any}
   */
  const noeudDefilant = (noeud) => {
    if (!noeud || typeof noeud !== 'object') return null;
    if (String(noeud.type).includes('ScrollView')) return noeud;
    return (noeud.children || []).reduce(
      (/** @type {any} */ trouve, /** @type {any} */ enfant) => trouve || noeudDefilant(enfant),
      null,
    );
  };

  test('🥇 LE CONTENEUR DEFILANT EST BORNE — il ne se mesure pas sur son contenu', async () => {
    const arbre = await rendre({ players: EFFECTIF_LONG });
    const style = StyleSheet.flatten(arbre.root.findByType(ScrollView).props.style) || {};

    // `flex: 1` = il grandit ET il retrecit, en partant de ZERO et non de la
    // hauteur de la liste. C'est LA propriete qui garantit que 25 joueurs
    // defilent au lieu de pousser la barre dehors.
    expect(style.flex).toBe(1);
  });

  test('la barre du bas est HORS du conteneur defilant, avec ses compteurs', async () => {
    const arbre = await rendre({ players: EFFECTIF_LONG });
    const racine = arbre.toJSON();
    const defilant = noeudDefilant(racine);

    expect(defilant).not.toBeNull();
    // Le CTA et les compteurs vivent en dehors : ils ne defilent jamais.
    expect(texteDuNoeud(defilant)).not.toContain('Suivant');
    expect(texteDuNoeud(defilant)).not.toContain('convoqués');
    expect(texteDuNoeud(racine)).toContain('Suivant');
    expect(texteDuNoeud(racine)).toContain('0 convoqués');
  });

  test('⛔ la barre n est PAS une surimpression, et son plancher bas n est pas zero', async () => {
    const arbre = await rendre({ players: EFFECTIF_LONG });
    const racine = arbre.toJSON();
    const barre = racine.children[racine.children.length - 1];
    const style = StyleSheet.flatten(barre.props.style) || {};

    expect(texteDuNoeud(barre)).toContain('Suivant');
    // Posee dans le flux, elle ne peut PAS manger le dernier joueur : rien ne
    // passe dessous. Une barre `absolute` le pourrait — c'est le defaut inverse.
    expect(style.position).not.toBe('absolute');
    // 🛟 Le plancher systeme reste un plancher (l'ecran est `edge-to-edge` :
    // c'est la barre qui porte le retrait bas, personne d'autre).
    expect(style.paddingBottom).toBeGreaterThanOrEqual(12);
  });

  test('le dernier joueur garde sa reserve en bas de la liste', async () => {
    const arbre = await rendre({ players: EFFECTIF_LONG });
    const contenu = StyleSheet.flatten(
      arbre.root.findByType(ScrollView).props.contentContainerStyle,
    ) || {};

    expect(contenu.paddingBottom).toBeGreaterThan(0);
    expect(texteDuNoeud(arbre.toJSON())).toContain('Nom24');
  });

  test('⌨️ CLAVIER : la barre ne peut ni sauter, ni recouvrir le champ de recherche', async () => {
    const arbre = await rendre({ players: EFFECTIF_LONG });
    const blocs = arbre.toJSON().children;
    const rang = (/** @type {(n: any) => boolean} */ predicat) => blocs
      .findIndex((/** @type {any} */ bloc) => predicat(bloc));

    /**
     * Ce bloc porte-t-il le champ de saisie, a n'importe quelle profondeur ?
     * @param {any} noeud
     * @returns {boolean}
     */
    const porteLaRecherche = (noeud) => {
      if (!noeud || typeof noeud !== 'object') return false;
      if (noeud.props?.accessibilityLabel === 'Rechercher un joueur') return true;
      return (noeud.children || []).some(porteLaRecherche);
    };

    const rangRecherche = rang(porteLaRecherche);
    const rangDefilement = rang((bloc) => String(bloc.type).includes('ScrollView'));
    const rangBarre = rang((bloc) => texteDuNoeud(bloc).includes('Suivant'));

    // Champ AU-DESSUS, liste au milieu, barre EN DESSOUS : trois freres d'une
    // meme colonne. Ils ne peuvent pas se recouvrir, clavier ouvert ou non.
    expect(rangRecherche).toBeGreaterThanOrEqual(0);
    expect(rangRecherche).toBeLessThan(rangDefilement);
    expect(rangDefilement).toBeLessThan(rangBarre);

    // Quand le clavier retracte la fenetre, c'est la LISTE qui cede — elle seule
    // retrecit. Le champ et la barre gardent le `flexShrink: 0` de React Native,
    // donc ils ne sont ni comprimes ni deplaces : la barre ne saute pas.
    const styleBarre = StyleSheet.flatten(blocs[rangBarre].props.style) || {};
    const styleRecherche = StyleSheet.flatten(blocs[rangRecherche].props.style) || {};
    expect(styleBarre.flexShrink ?? 0).toBe(0);
    expect(styleRecherche.flexShrink ?? 0).toBe(0);
    expect(StyleSheet.flatten(arbre.root.findByType(ScrollView).props.style).flex).toBe(1);
  });

  test('📑 les compteurs restent justes sur les 3 onglets, effectif long', async () => {
    const arbre = await rendre({ players: EFFECTIF_LONG });
    await act(async () => {
      rangeeJoueur(arbre, 'Prenom0 Nom0').props.onPress();
    });

    // Onglet 1 : 1 coche au football = 1 titulaire, JAMAIS 11.
    expect(texteVisible(arbre)).toContain('1 convoqué');
    expect(texteVisible(arbre)).toContain('1 titulaires · 0 sur le banc');

    await appuyerSur(arbre, 'Autres équipes');
    await act(async () => {
      rangeeJoueur(arbre, 'Bilal Lopez').props.onPress();
    });
    expect(texteVisible(arbre)).toContain('2 convoqués');
    expect(texteVisible(arbre)).toContain('dont 1 renforts · 0 hors app');

    await appuyerSur(arbre, 'Hors app');
    // La barre suit sur le 3e onglet : meme compteur, meme CTA.
    expect(texteVisible(arbre)).toContain('2 convoqués');
    expect(texteVisible(arbre)).toContain('Suivant');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC09 — « On convoque a l'aveugle. » (Adel, 2026-08-20)
//
// « Pour les compositions, quand on fait les convocations, il faut marquer le
//   statut des participants — s'ils ont repondu absent ou present — comme ca on
//   sait AVANT de convoquer qui on convoque, en laissant la possibilite de
//   convoquer les absents. Et si on selectionne des joueurs absents, mettre un
//   pop-up de prevention. »
//
// 🔒 LES DEUX REGLES QUE CE BLOC TIENT, ET QUI NE SE NEGOCIENT PAS :
//   1. Les QUATRE etats se lisent SANS LA COULEUR (present · absent · en
//      attente · sans reponse). Un daltonien doit pouvoir convoquer.
//   2. La fenetre PREVIENT, elle n'INTERDIT PAS. Adel est explicite.
// ═══════════════════════════════════════════════════════════════════════════
describe('AC09 — voir qui a repondu avant de convoquer', () => {
  const SANS_REPONSE = joueur('p4', 'Sami', 'Baki', { number: 4, position: 'MC' });
  const EFFECTIF_AC09 = [...EFFECTIF, SANS_REPONSE];

  /**
   * La charge de l'evenement, avec les 3 relations qui portent les reponses.
   * p1 present · p2 absent · p3 demande en attente · p4 n'a rien repondu.
   * @returns {any}
   */
  const evenementAvecReponses = () => ({
    missings: [{ documentId: 'p2' }],
    participationRequests: [{
      documentId: 'req_p3',
      isActive: true,
      participationStatus: 'pending',
      user: { documentId: 'p3' },
    }],
    participations: [{ documentId: 'p1' }],
    team: { club: { documentId: 'club_1' }, documentId: 'team_1' },
  });

  /**
   * Le texte de l'etiquette d'etat portee par la rangee de ce joueur.
   * @param {any} arbre
   * @param {string} nom
   * @returns {string}
   */
  const etiquetteEtat = (arbre, nom) => {
    const rangee = rangeeJoueur(arbre, nom);
    const etiquettes = rangee.findAllByType(Text)
      .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
      .filter((/** @type {string} */ texte) => /Présent|Absent|En attente|Sans réponse/.test(texte));
    return etiquettes[0] || '';
  };

  beforeEach(() => {
    mockEvent = evenementAvecReponses();
  });

  test('🥇 TEMOIN 1 — chaque joueur de la liste porte son statut', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });

    expect(etiquetteEtat(arbre, 'Moussa Diallo')).toContain('Présent');
    expect(etiquetteEtat(arbre, 'Hugo Fofana')).toContain('Absent');
    expect(etiquetteEtat(arbre, 'Théo Marchal')).toContain('En attente');
    expect(etiquetteEtat(arbre, 'Sami Baki')).toContain('Sans réponse');
  });

  test(
    'TEMOIN 2 — les QUATRE etats sont distingues, « en attente » n est pas « sans reponse »',
    async () => {
      const arbre = await rendre({ players: EFFECTIF_AC09 });

      const etats = [
        etiquetteEtat(arbre, 'Moussa Diallo'),
        etiquetteEtat(arbre, 'Hugo Fofana'),
        etiquetteEtat(arbre, 'Théo Marchal'),
        etiquetteEtat(arbre, 'Sami Baki'),
      ];

      expect(etats.every((etat) => etat.length > 0)).toBe(true);
      expect(new Set(etats).size).toBe(4);
      // ⛔ Le 4e etat n'est PAS ecrase en « sans reponse » : une demande en
      // attente, ce n'est pas un silence.
      expect(etats[2]).not.toEqual(etats[3]);
    },
  );

  test('🚨 TEMOIN 3 — l etat se lit SANS LA COULEUR : un mot, et un signe distinct', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });

    const etats = ['Moussa Diallo', 'Hugo Fofana', 'Théo Marchal', 'Sami Baki']
      .map((nom) => etiquetteEtat(arbre, nom));

    // Le MOT porte l'etat a lui seul.
    etats.forEach((etat) => {
      expect(etat.replace(/[^A-Za-zÀ-ÿ]/g, '').length).toBeGreaterThan(2);
    });

    // Et le signe qui precede le mot differe d'un etat a l'autre : meme sans
    // lire, meme en niveaux de gris, les 4 rangees ne se ressemblent pas.
    const signes = etats.map((etat) => etat.trim().charAt(0));
    expect(new Set(signes).size).toBe(4);
  });

  test('⛔ un joueur HORS APP ne porte aucun statut : il ne peut pas repondre', async () => {
    const arbre = await rendre({
      pendingManualPlayer: {
        documentId: 'manual_1700000000001',
        firstname: 'Yanis',
        id: 'manual_1700000000001',
        isManual: true,
        lastname: 'Bertrand',
      },
      players: EFFECTIF_AC09,
    });

    expect(etiquetteEtat(arbre, 'Yanis Bertrand')).toBe('');
    expect(texteVisible(arbre)).toContain('Préviens-le toi-même');
  });

  test(
    '🕳️ sans charge d evenement, AUCUN etat n est affiche — on ne dit pas du faux',
    async () => {
      mockEvent = undefined;
      const arbre = await rendre({ players: EFFECTIF_AC09 });

      expect(etiquetteEtat(arbre, 'Moussa Diallo')).toBe('');
      expect(etiquetteEtat(arbre, 'Sami Baki')).toBe('');
    },
  );

  test(
    '🥇 TEMOIN 4 — cocher un ABSENT declenche la fenetre de prevention, qui le NOMME',
    async () => {
      const arbre = await rendre({ players: EFFECTIF_AC09 });
      await act(async () => {
        rangeeJoueur(arbre, 'Hugo Fofana').props.onPress();
      });
      await appuyerSur(arbre, 'Suivant');

      const texte = texteVisible(arbre);
      expect(texte).toContain('1 joueur a dit ABSENT');
      expect(texte).toContain('Hugo Fofana');
      // ⛔ Rien n'est parti : on previent AVANT.
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );

  test('la fenetre compte et nomme TOUS les absents coches', async () => {
    mockEvent = {
      ...evenementAvecReponses(),
      missings: [{ documentId: 'p2' }, { documentId: 'p5' }],
    };
    const arbre = await rendre({
      players: [...EFFECTIF_AC09, joueur('p5', 'Ilan', 'Ravel', { number: 5 })],
    });

    await act(async () => {
      rangeeJoueur(arbre, 'Hugo Fofana').props.onPress();
    });
    await act(async () => {
      rangeeJoueur(arbre, 'Ilan Ravel').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    const texte = texteVisible(arbre);
    expect(texte).toContain('2 joueurs ont dit ABSENT');
    expect(texte).toContain('Hugo Fofana');
    expect(texte).toContain('Ilan Ravel');
  });

  test('🔒 TEMOIN 5 — la fenetre PREVIENT et LAISSE PASSER : elle n interdit pas', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });
    await act(async () => {
      rangeeJoueur(arbre, 'Hugo Fofana').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');
    expect(mockNavigate).not.toHaveBeenCalled();

    await appuyerSur(arbre, 'Convoquer quand même');

    // 🔒 L'ABSENT PART AVEC LES AUTRES. C'est la demande d'Adel, mot pour mot :
    // « en laissant la possibilite de convoquer les absents ».
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.selectedPlayers.map((/** @type {any} */ j) => j.documentId).sort())
      .toEqual(['p1', 'p2']);
  });

  test('« Revoir ma selection » referme la fenetre et ne convoque personne', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });
    await act(async () => {
      rangeeJoueur(arbre, 'Hugo Fofana').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');
    await appuyerSur(arbre, 'Revoir ma sélection');

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(texteVisible(arbre)).not.toContain('joueur a dit ABSENT');
    // La selection est intacte : on revient la corriger, on ne la perd pas.
    expect(rangeeJoueur(arbre, 'Hugo Fofana').props.accessibilityState.selected).toBe(true);
  });

  test('TEMOIN 6 — ne cocher que des PRESENTS ne declenche AUCUNE fenetre', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    expect(texteVisible(arbre)).not.toContain('ABSENT');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  test('un « en attente » et un « sans reponse » ne declenchent RIEN non plus', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });
    await act(async () => {
      rangeeJoueur(arbre, 'Théo Marchal').props.onPress();
    });
    await act(async () => {
      rangeeJoueur(arbre, 'Sami Baki').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(texteVisible(arbre)).not.toContain('ABSENT');
  });

  test('🔒 TEMOIN 7 — NON-REGRESSION : la convocation part exactement comme avant', async () => {
    const arbre = await rendre({ players: EFFECTIF_AC09 });
    await act(async () => {
      rangeeJoueur(arbre, 'Moussa Diallo').props.onPress();
    });
    await appuyerSur(arbre, 'Suivant');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCompositionStart');
    expect(parametres.selectedPlayers).toHaveLength(1);
    expect(parametres.selectedPlayers[0].documentId).toBe('p1');
    expect(parametres.eventId).toBe('evt_1');
    expect(parametres.teamId).toBe('team_1');
    expect(parametres.pendingManualPlayer).toBeUndefined();
  });

  test(
    '🔒 et un ABSENT confirme voyage par le MEME chemin qu avant (terrain deja pose)',
    async () => {
      const arbre = await rendre({
        existingComposition: {
          schemaVersion: 3,
          selectedPlayerIds: ['p1'],
          teams: [{
            id: 'team_1',
            placements: [{
              playerId: 'p1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
            }],
          }],
        },
        players: EFFECTIF_AC09,
      });
      await act(async () => {
        rangeeJoueur(arbre, 'Hugo Fofana').props.onPress();
      });
      await appuyerSur(arbre, 'Suivant');
      await appuyerSur(arbre, 'Convoquer quand même');

      const [nomEcran, parametres] = mockNavigate.mock.calls[0];
      expect(nomEcran).toBe('MatchCompositionBoard');
      expect(parametres.startPlacements).toEqual([{
        playerId: 'p1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      }]);
    },
  );

  test(
    '⛔ « Suivant » sans personne coche avertit TOUJOURS, avant toute fenetre d absents',
    async () => {
      const arbre = await rendre({ players: EFFECTIF_AC09 });
      await appuyerSur(arbre, 'Suivant');

      expect(mockAlert).toHaveBeenCalledWith('Attention', 'Sélectionne au moins un joueur.');
      expect(texteVisible(arbre)).not.toContain('ABSENT');
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );
});
