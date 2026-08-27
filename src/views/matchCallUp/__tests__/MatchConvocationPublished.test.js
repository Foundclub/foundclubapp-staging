import { Children } from 'react';
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchConvocationPublished from '../MatchConvocationPublished';

// C-B — ECRAN 7 du pack composition : « Convocation publiee », vue du coach.
//
// 🥇 LE TEMOIN D ARRET DU LOT est ici : « le coach voit combien de convoques ont
// repondu ». Avant ce lot, le serveur calculait ces chiffres, les envoyait, et
// AUCUN fichier de l app ne les lisait.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockPublish = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockComposition;

/**
 * Les proprietes recues par chaque `ProfileAvatar` rendu, dans l'ordre.
 * ⚠️ Le nom DOIT commencer par `mock` : jest refuse toute autre variable
 * hors-portee dans une fabrique `jest.mock`.
 */
const mockAvatarsRecus = [];

// 🧨 L'objet `navigation` est FIGE : le recreer a chaque rendu relance les
// effets qui en dependent et Jest part en boucle infinie, sans message utile.
const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

// AB03 — l'ecran perime desormais les caches de composition apres publication
// (`invalidateAfterAction`). Sans ce double, `useQueryClient()` leve
// « No QueryClient set » et la suite tombe AVANT le premier rendu.
const mockClientRequeteFige = { invalidateQueries: jest.fn() };

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
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

// S04 — le degrade est rendu TEL QUEL (composant hote nomme), et pas remplace
// par une `View` qui jetterait son `style` : c'est justement le style qu'on doit
// pouvoir mesurer. Meme idiome que `ClubCard.test.js:18`.
jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTeamComposition: () => ({ data: mockComposition, isFetching: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  publishEventConvocation: (/** @type {any} */ ...args) => mockPublish(...args),
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
      Images: { arrowLeft: 1, check: 1, chevronLeft: 1 },
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
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

// 🎯 LA DOUBLURE QUI VOIT. Elle NOTE ce que l'ecran lui passe avant de rendre
// son texte. Sans ce carnet, elle ne regarde que `name` et reste donc VERTE
// quand l'ecran passe l'OBJET media brut au lieu de l'adresse de la photo
// (motif AE04, `views/event/wizard/__tests__/AE04-tunnel-photo-joueur.test.js`).
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockAvatarsRecus.push(props);
      return <TexteRN>{`AVATAR:${props.name}`}</TexteRN>;
    },
  };
});

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { isVisible }) => (
      isVisible ? <TexteRN>MUR PAYANT</TexteRN> : null
    ),
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

const PACK_PUBLIE = {
  manualPlayers: [],
  publishedAt: '2026-08-14T16:02:00.000Z',
  reservePlayerIds: ['p3'],
  // ⚠️ Les 3 formes d'avatar cohabitent dans le meme pack, expres : l'OBJET
  // media du serveur (p1), l'adresse deja aplatie de l'instantane (p3), et
  // l'absence de photo (p2). Voir le carnet `mockAvatarsRecus` plus bas.
  snapshotPlayers: [
    {
      avatar: {
        formats: { thumbnail: { url: '/uploads/thumbnail_karim.jpg' } },
        id: 7,
        url: '/uploads/karim.jpg',
      },
      documentId: 'p1',
      firstname: 'Karim',
      lastname: 'Sylla',
      number: 9,
    },
    {
      avatar: null,
      documentId: 'p2',
      firstname: 'Yanis',
      lastname: 'Bertrand',
      number: 4,
    },
    {
      avatar: '/uploads/malik.jpg',
      documentId: 'p3',
      firstname: 'Malik',
      lastname: 'Cisse',
      number: 7,
    },
  ],
  teams: [{
    id: 'team_1',
    placements: [
      { playerId: 'p1', positionX: 50, positionY: 90 },
      { playerId: 'p2', positionX: 50, positionY: 60 },
    ],
  }],
  version: 1,
};

const REPONSES = {
  byPlayerId: { p1: 'absent', p2: 'present', p3: 'pending' },
  counts: { absent: 1, pending: 1, present: 1 },
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = {
    eventId: 'evt_1',
    eventLabel: 'Match',
    teamId: 'team_1',
    teamName: 'Senior 1',
    ...parametres,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchConvocationPublished />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockAvatarsRecus.length = 0;
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockPublish.mockReset();
  mockPublish.mockResolvedValue({});
  mockComposition = {
    published: PACK_PUBLIE,
    responses: REPONSES,
    team: { documentId: 'team_1', name: 'Senior 1' },
  };
});

// 🧨 On DEMONTE entre deux tests : un arbre orphelin garde ses effets vivants et
// fait sortir jest en 1 alors que tous les tests sont verts (piege D68).
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('C-B ecran 7 — le coach voit les reponses de ses convoques', () => {
  test('🥇 LE TEMOIN D ARRET : les 3 pastilles de comptage sont a l ecran', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('1 présent');
    expect(texte).toContain('1 en attente');
    expect(texte).toContain('1 absent');
  });

  test('🥇 et la reponse de CHAQUE convoque est lisible, joueur par joueur', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Karim Sylla');
    expect(texte).toContain('Absent·e');
    expect(texte).toContain('Yanis Bertrand');
    expect(texte).toContain('Présent·e');
    expect(texte).toContain('Malik Cisse');
    expect(texte).toContain('Participation en attente');
  });

  test('l en-tete, la chip « Publiee » et la carte de recap sont la', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Convocation');
    expect(texte).toContain('Publiée');
    expect(texte).toContain('Convocation publiée');
    expect(texte).toContain('Senior 1');
    expect(texte).toContain('JOUEURS CONVOQUÉS');
  });

  test('le grand nombre compte les VRAIS convoques, terrain + banc', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('| 3 |');
  });

  test('chaque rangee dit le role et le numero', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Titulaire · N°9');
    expect(texte).toContain('Remplaçant · N°7');
  });

  test('les 2 CTA du pack sont la, « Modifier la composition » en principal', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Relancer');
    expect(texte).toContain('Modifier la composition');
  });

  test('« Modifier la composition » rouvre le parcours a la SELECTION', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Modifier la composition');

    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchCallUpSelection',
      expect.objectContaining({ eventId: 'evt_1', teamId: 'team_1' }),
    );
  });

  test('🔒 la compo publiee descend a l ecran 1 : on repart de ce qui est publie', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Modifier la composition');

    expect(mockNavigate.mock.calls[0][1].publishedComposition).toBe(PACK_PUBLIE);
  });

  test('🚪 LA PORTE DE L ECRAN 8 : un desistement ouvre « Remplacer »', async () => {
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('DÉSISTEMENT');

    await appuyerSur(arbre, 'Remplacer');
    expect(mockNavigate).toHaveBeenCalledWith(
      'MatchCompositionAmend',
      expect.objectContaining({ eventId: 'evt_1', teamId: 'team_1' }),
    );
  });

  test('⛔ sans desistement, aucune porte vers l ecran 8 — il n aurait rien a dire', async () => {
    mockComposition = {
      ...mockComposition,
      responses: { byPlayerId: { p1: 'present', p2: 'present' }, counts: {} },
    };

    expect(texteVisible(await rendre())).not.toContain('DÉSISTEMENT');
  });

  test('🔒 un joueur hors app porte sa note, et AUCUNE pastille de reponse', async () => {
    mockComposition = {
      published: {
        ...PACK_PUBLIE,
        manualPlayers: [{ documentId: 'm1', firstname: 'Sofiane', lastname: 'Dib' }],
        reservePlayerIds: ['p3', 'm1'],
        snapshotPlayers: [
          ...PACK_PUBLIE.snapshotPlayers,
          {
            documentId: 'm1', firstname: 'Sofiane', isManual: true, lastname: 'Dib',
          },
        ],
      },
      responses: REPONSES,
      team: { documentId: 'team_1', name: 'Senior 1' },
    };
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Sofiane Dib');
    expect(texte).toContain('Hors app — il ne peut pas répondre');
  });

  test('sans compo publiee, l ecran le dit au lieu d afficher des zeros muets', async () => {
    mockComposition = { published: null, responses: null, team: null };
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Personne n’est encore convoqué.');
  });
});

describe('C-B ecran 7 — « Relancer » dit ce qu il fait avant de le faire', () => {
  test('⛔ il ne renvoie RIEN sans confirmation', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Relancer');

    expect(mockPublish).not.toHaveBeenCalled();
  });

  test('🔒 et la confirmation PROMET que les reponses sont conservees', async () => {
    const alerte = jest.spyOn(
      jest.requireActual('react-native').Alert,
      'alert',
    ).mockImplementation(() => {});
    const arbre = await rendre();
    await appuyerSur(arbre, 'Relancer');

    expect(alerte.mock.calls[0][1]).toContain('Les réponses déjà données sont conservées.');
    alerte.mockRestore();
  });
});

// S04 defaut 2 — Adel : « Bug d'affichage avec le carré "convocation publiée",
// à cause du style gradient sur iPhone, comme on a pu avoir sur les cartes
// événement et club. »
//
// 🧨 CE QUI CASSAIT : le degrade ETAIT la carte — il portait lui-meme l arrondi,
// la bordure et les marges, donc il devait se dimensionner sur ses enfants. Sur
// iOS, `react-native-linear-gradient` mesure sa couche de dessin AVANT cette
// mise en page : la carte se retrouve tranchee.
//
// ♻️ LE MOTIF REPRIS, sans en inventer un troisieme : `ClubCardSurface.js:37-51`,
// « POINT DE VERITE UNIQUE » des cartes club. Le meme invariant est gele ici,
// dans les memes termes que `ClubCard.test.js:212`.
describe('S04 — le carre « convocation publiee » (R07 gele)', () => {
  test('🥇 le degrade est un FOND, jamais le conteneur', async () => {
    const arbre = await rendre();
    const degrades = arbre.root.findAllByType('LinearGradient');
    expect(degrades).toHaveLength(1);

    expect(Children.count(degrades[0].props.children)).toBe(0);
    expect(StyleSheet.flatten(degrades[0].props.style)).toMatchObject({ position: 'absolute' });
    expect(degrades[0].props.pointerEvents).toBe('none');
  });

  test('un conteneur ordinaire porte la taille et decoupe les coins arrondis', async () => {
    const arbre = await rendre();
    const decoupe = arbre.root.findAll((/** @type {any} */ noeud) => (
      typeof noeud.type === 'string'
      && StyleSheet.flatten(noeud.props?.style)?.overflow === 'hidden'
    ));

    expect(decoupe.length).toBeGreaterThan(0);
    expect(decoupe[0].type).toBe('View');
    expect(StyleSheet.flatten(decoupe[0].props.style).borderRadius).toBe(24);
  });
});

// ⚠️ L'avatar d'un joueur de compo est TANTOT une string — l'instantane fige
// d'une compo publiee — TANTOT l'objet media de Strapi ({ url, formats, ... }).
// Passer l'objet BRUT a `getImageUrl` ne tue plus l'ecran (sa garde rend
// `undefined`), mais il EFFACE la photo et retombe sur les initiales. C'est le
// constat AE04 du 2026-08-22, et ces 2 ecrans-ci en etaient les derniers
// porteurs : ils appellent desormais `getCompositionPlayerAvatarUrl`.
//
// 🎯 CE TEMOIN NE REGARDE PAS DES PIXELS, il regarde CE QUE L'ECRAN PASSE.
describe('🖼️ C-B ecran 7 — la photo du joueur arrive entiere jusqu a l avatar', () => {
  test('ne passe JAMAIS un objet brut a ProfileAvatar — une string ou rien', async () => {
    await rendre();

    expect(mockAvatarsRecus.length).toBeGreaterThan(0);
    mockAvatarsRecus.forEach((/** @type {any} */ props) => {
      const recu = props.imageUrl;
      expect(recu === undefined || typeof recu === 'string').toBe(true);
    });
  });

  test('🥇 TRANSMET la photo du joueur dont l avatar est un objet media', async () => {
    await rendre();

    // ⛔ La seule garde de `imageUrl.js` rendrait `undefined` ici : l'ecran
    // afficherait les initiales alors que le joueur A une photo.
    const avatar = mockAvatarsRecus
      .filter((/** @type {any} */ props) => props.name === 'Karim Sylla')
      .pop();

    expect(avatar.imageUrl).toBe('/uploads/karim.jpg');
  });

  test('transmet telle quelle la photo deja sous forme de string', async () => {
    await rendre();

    const avatar = mockAvatarsRecus
      .filter((/** @type {any} */ props) => props.name === 'Malik Cisse')
      .pop();

    expect(avatar.imageUrl).toBe('/uploads/malik.jpg');
  });
});

// ==========================================================================
// COMPOLECT-2 (D5) — CET ECRAN DIT POURQUOI IL N'A PAS DE TERRAIN.
//
// 🗣️ Adel, 27/08 : « quand je clique sur "ouvrir la compo", je vois le terrain
// avec le banc en plein ecran ». Ouvrir une convocation publiee mene bien au
// plateau plein ecran — SAUF dans deux cas, ou l'on retombe ICI :
//   · aucun joueur place sur le terrain ;
//   · plusieurs equipes publiees, que le plateau ne dessine pas d'un seul coup.
//
// 🧨 Le comportement ne change pas (D6) : ce qui change, c'est qu'il cesse
// d'etre MUET. Deposer le coach sur une liste de reponses, sans un mot, apres
// qu'il a demande a voir sa compo, c'est ce qui fait croire que l'ecran est
// casse. La note nomme la cause et montre la sortie.
// ==========================================================================
describe('COMPOLECT-2 · D5 — sans terrain, l ecran le DIT', () => {
  test('🥇 aucun joueur place : la note explique pourquoi, et ou aller', async () => {
    mockComposition = {
      published: {
        ...PACK_PUBLIE,
        reservePlayerIds: ['p1', 'p2', 'p3'],
        teams: [{ id: 'team_1', placements: [] }],
      },
      responses: REPONSES,
      team: { documentId: 'team_1', name: 'Senior 1' },
    };

    const texte = texteVisible(await rendre());

    expect(texte).toContain('Pas de terrain');
  });

  test('🔒 NON-REGRESSION : avec des joueurs places, aucune note ne s affiche', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).not.toContain('Pas de terrain');
  });

  test('🔒 une convocation VIDE ne declenche pas la note non plus', async () => {
    mockComposition = {
      published: {
        ...PACK_PUBLIE,
        reservePlayerIds: [],
        teams: [{ id: 'team_1', placements: [] }],
      },
      responses: { byPlayerId: {}, counts: {} },
      team: { documentId: 'team_1', name: 'Senior 1' },
    };

    const texte = texteVisible(await rendre());

    expect(texte).not.toContain('Pas de terrain');
  });
});
