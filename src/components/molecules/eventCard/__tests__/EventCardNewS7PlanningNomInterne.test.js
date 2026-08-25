import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import EventCardNew from '../EventCardNew';

// Lot S7 (recette 2.6.27) — LA 4e COPIE DE LA REGLE « QUI EST L ADVERSAIRE ».
//
// 🧨 CE QUE LA RECETTE D ADEL A TROUVE, APRES R2 : la fiche de l evenement est
// reparee, un match contre une equipe d un AUTRE club aussi — mais la carte
// « Mon planning » vole ENCORE le nom quand l equipe invitee est du MEME club.
//
// 🔎 LE MECANISME, MESURE LE 25/08 : `resolveTeamFocusedPrimaryTitle` (profil
// `teamFocused`, dont le seul usage est `ParticipantEventList.js:448`) cherche
// l adversaire en QUATRE temps. R2 a vide le 3e (`eventTitle`) pour un match
// interne, et le 4e prend alors le relais : il parcourt la liste BRUTE des
// `invitedTeams` en ne comparant que des NOMS. C est la regle d AVANT R2,
// recopiee une 4e fois — celle-la n avait jamais ete corrigee.
//
// ⚠️ `item.matchContext` (le 2e temps) n existe PAS ici : les cartes de
// « Mon planning » viennent de `useGetEvents`, pas de l API planning.
//
// ⛔ CE FILET N EST PAS QU UN TEMOIN DE BUG : `resolveTeamFocusedPrimaryTitle`
// n avait AUCUN test (E6). Les temoins « C » ci-dessous CARACTERISENT le
// comportement d aujourd hui — ils doivent rester verts APRES le correctif.

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => false,
    haveIAlreadyJoined: () => false,
  }),
}));

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventCardNew {...props} />);
  });
  return tree;
};

/**
 * Toutes les chaines rendues par un `Text`, dans l ordre de l ecran.
 * @param {any} tree Arbre rendu.
 * @returns {string[]} Les chaines, dans l ordre.
 */
const lignesDe = (tree) => tree.root.findAllByType(Text)
  .map((noeud) => {
    const enfants = noeud.props.children;
    return typeof enfants === 'string' ? enfants : '';
  })
  .filter((valeur) => valeur.trim().length > 0);

const CLUB = { documentId: 'club-1', name: 'FC Marseille Nord' };
const AUTRE_CLUB = { documentId: 'club-2', name: 'US Blaisoise' };

/**
 * Le TITRE et le SOUS-TITRE de l entete, reperes par leur voisinage.
 *
 * ⚠️ On ne prend PAS un index fixe : l entete est precedee de la pastille de
 * type, de la date courte et des initiales du club, et cet ordre-la n est pas
 * le sujet du lot. Le sous-titre du profil planning vaut toujours
 * « <equipe> • <club> » (`EventCardNew.js:521-525`) : on le repere par le nom
 * du club, et le titre est la ligne juste avant.
 * @param {any} tree Arbre rendu.
 * @returns {{ sousTitre: string, titre: string }} L entete de la carte.
 */
const enteteDe = (tree) => {
  const lignes = lignesDe(tree);
  const rangSousTitre = lignes.findIndex((ligne) => ligne.includes(` • ${CLUB.name}`));
  return {
    sousTitre: rangSousTitre > 0 ? lignes[rangSousTitre] : '',
    titre: rangSousTitre > 0 ? lignes[rangSousTitre - 1] : '',
  };
};

const NOTRE_EQUIPE = {
  activities: [{ name: 'Football' }],
  category: { name: 'U15' },
  club: CLUB,
  documentId: 'team-a',
  name: 'U15 A',
  section: { name: 'Masculine' },
};

/** L autre equipe DU MEME club — le cas du bug S7. */
const EQUIPE_DU_MEME_CLUB = { club: CLUB, documentId: 'team-b', name: 'U15 B' };
/** Une equipe d un AUTRE club — le vrai adversaire, deja correct depuis R2. */
const EQUIPE_D_EN_FACE = { club: AUTRE_CLUB, documentId: 'team-x', name: 'US Blaisoise U15' };

const evenement = (/** @type {any} */ surcharges = {}) => ({
  capacity: 14,
  club: CLUB,
  date: '2099-08-26T17:00:00',
  documentId: 'evt-s7',
  endTime: '19:00:00',
  invitedTeams: [],
  locationDetails: 'Stade Vélodrome, 13008 Marseille',
  missings: [],
  participations: [],
  sessionStatus: 'open',
  startTime: '17:00:00',
  team: NOTRE_EQUIPE,
  type: { name: 'Match' },
  ...surcharges,
});

const carteDePlanning = (/** @type {any} */ surcharges = {}) => renderCard({
  displayProfile: 'teamFocused',
  item: evenement(surcharges),
});

describe('S7 - la carte « Mon planning » et l equipe invitee du meme club', () => {
  beforeEach(() => {
    mockUserData.mockReturnValue({ documentId: 'moi', role: { name: USER_ROLES.player } });
  });

  // -- C. CARACTERISATION (E6) : ce que la carte fait AUJOURD HUI -----------
  test('C1 — sans invitation, un match porte NOTRE equipe en titre', () => {
    expect(enteteDe(carteDePlanning()).titre).toBe('U15 A');
  });

  test('C2 — un entrainement porte NOTRE equipe en titre', () => {
    expect(enteteDe(carteDePlanning({ type: { name: 'Entraînement' } })).titre).toBe('U15 A');
  });

  test('C3 — le sous-titre porte l equipe ET le club', () => {
    expect(enteteDe(carteDePlanning()).sousTitre).toBe('U15 A • FC Marseille Nord');
  });

  test('C4 — une equipe invitee d un AUTRE club EST le titre (correct depuis R2)', () => {
    expect(enteteDe(carteDePlanning({ invitedTeams: [EQUIPE_D_EN_FACE] })).titre)
      .toBe('US Blaisoise U15');
  });

  test('C5 — la carte PAR DEFAUT liste TOUTES les equipes invitees', () => {
    // 🔒 Garde-fou du lot : `invitedTeamNames` sert AUSSI a cette liste-la
    // (`EventCardNew.js:786`). Le correctif S7 ne doit pas l amputer — une
    // equipe interne conviee reste une equipe conviee, et ca se dit.
    const tree = renderCard({
      item: evenement({ invitedTeams: [EQUIPE_DU_MEME_CLUB, EQUIPE_D_EN_FACE] }),
    });

    expect(lignesDe(tree).join('\n')).toContain('équipes invitées: U15 B, US Blaisoise U15');
  });

  // -- LE TEMOIN DU BUG ----------------------------------------------------
  test('S7 — une equipe invitee du MEME club ne vole PAS le titre', () => {
    expect(enteteDe(carteDePlanning({ invitedTeams: [EQUIPE_DU_MEME_CLUB] })).titre)
      .not.toBe('U15 B');
  });

  test('S7 bis — le titre retombe sur NOTRE equipe, comme sans invitation', () => {
    expect(enteteDe(carteDePlanning({ invitedTeams: [EQUIPE_DU_MEME_CLUB] })).titre)
      .toBe('U15 A');
  });

  test('S7 ter — une interne ET un vrai adversaire : c est l adversaire qui gagne', () => {
    expect(enteteDe(carteDePlanning({
      invitedTeams: [EQUIPE_DU_MEME_CLUB, EQUIPE_D_EN_FACE],
    })).titre).toBe('US Blaisoise U15');
  });

  test('S7 quater — sans club connu, rien ne change (ancien parc)', () => {
    // Charge utile d avant R2 : l equipe invitee n a pas de club. On ne DEVINE
    // pas — le comportement d aujourd hui reste, exactement comme dans R2.
    expect(enteteDe(carteDePlanning({
      invitedTeams: [{ documentId: 'team-b', name: 'U15 B' }],
    })).titre).toBe('U15 B');
  });

  // -- D4 : LE DOUBLON VISUEL, MESURE PLUTOT QUE SUPPOSE -------------------
  test('S7 D4 — le match interne se comporte EXACTEMENT comme un entrainement', () => {
    // 🧭 Le doublon redoute (l equipe en titre ET en tete du sous-titre) n est
    // pas cree par S7 : il EXISTE DEJA pour un entrainement et pour un match
    // sans invitation (temoins C1, C2, C3). Le correctif range le match interne
    // dans cette meme famille, il n ajoute aucun cas nouveau a l ecran.
    const interne = enteteDe(carteDePlanning({ invitedTeams: [EQUIPE_DU_MEME_CLUB] }));
    const entrainement = enteteDe(carteDePlanning({ type: { name: 'Entraînement' } }));
    const sansInvitation = enteteDe(carteDePlanning());

    expect(interne).toEqual(entrainement);
    expect(interne).toEqual(sansInvitation);
  });

  test('S7 D4 bis — un VRAI adversaire, lui, ne repete jamais notre equipe', () => {
    const entete = enteteDe(carteDePlanning({ invitedTeams: [EQUIPE_D_EN_FACE] }));

    expect(entete.titre).toBe('US Blaisoise U15');
    expect(entete.sousTitre.startsWith(entete.titre)).toBe(false);
  });
});
