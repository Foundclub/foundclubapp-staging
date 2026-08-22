import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// N4 (D5) — LA FEUILLE DE RELANCE, TESTEE SEULE.
//
// Trois cadres, trois etats, et une regle qui les traverse :
//   · 1G — une ligne par equipe AYANT des sans-reponse, celle du bouton presse
//     deja cochee. « Ouvert à tous » n existe pas : la donnee n existe pas.
//   · 1I — le motif anti-spam AVANT l appui, lu dans le cache de mutation
//     (meme lecture qu `EventParticipants`, AE02).
//   · 1H — le compte rendu APRES l appui.
//
// 🔢 LA REGLE QUI TRAVERSE TOUT : le chiffre du pied est celui de L APP, donc
// INDICATIF ; celui du compte rendu est celui du SERVEUR. Les confondre, c est
// re-inventer le defaut qu AC07 a corrige — annoncer « 4 relancees » quand
// l anti-spam en a ecarte 3.
// ==========================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;

    return react.createElement(
      rn.View,
      { testID: 'doublure-feuille' },
      props.headerComponent || null,
      props.children,
      props.footerComponent || null,
    );
  };
});

jest.mock('@/components/atoms/checkbox/Checkbox', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function CheckboxDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'checkbox',
        accessibilityState: { checked: Boolean(props.value) },
        onPress: () => props.onValueChange(!props.value),
        testID: 'doublure-case',
      },
      react.createElement(rn.Text, null, props.value ? 'COCHEE' : 'VIDE'),
    );
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled || props.isLoading),
        onPress: props.onPress,
        testID: props.testID,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import RemindTeamsSheet from '../RemindTeamsSheet';

const EQUIPE_A = 'team-a';
const EQUIPE_B = 'team-b';

const joueurs = (/** @type {number} */ combien) => Array.from(
  { length: combien },
  (_, index) => ({ documentId: `joueur-${index}` }),
);

const SECTIONS = [
  { key: EQUIPE_A, notAnswered: joueurs(4), teamName: 'U15 A' },
  { key: EQUIPE_B, notAnswered: joueurs(3), teamName: 'U15 B' },
];

/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ options = {}) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <RemindTeamsSheet
        equipePreCochee={options.equipePreCochee ?? EQUIPE_A}
        erreur={options.erreur ?? null}
        isReminding={options.isReminding ?? false}
        isVisible={options.isVisible ?? true}
        nowMs={options.nowMs ?? Date.parse('2026-08-23T10:00:00.000Z')}
        onClose={options.onClose ?? jest.fn()}
        onRelancer={options.onRelancer ?? jest.fn()}
        rapport={options.rapport ?? null}
        sections={options.sections ?? SECTIONS}
      />,
    );
  });
  montes.push(arbre);

  return arbre.root;
};

const textOf = (/** @type {any} */ node) => {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  if (node.props?.children !== undefined) return textOf(node.props.children);

  return '';
};

const textes = (/** @type {any} */ root) => root
  .findAllByType(Text)
  .map((/** @type {any} */ node) => textOf(node.props.children).trim())
  .filter(Boolean);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false });

const cases = (/** @type {any} */ root) => root
  .findAll((/** @type {any} */ node) => node.props?.testID === 'doublure-case', { deep: false });

const bouton = (/** @type {any} */ root, /** @type {string} */ id) => parTestID(root, id)[0];

// 🪤 `deep: false` rend le noeud le PLUS EXTERIEUR portant le testID : c est la
// doublure `Button` elle-meme, qui recoit son libelle en PROP (`title`) et non
// en enfant. Lire `textOf` dessus rendrait la chaine vide — et un temoin qui
// compare '' a '' passerait au vert sans rien prouver.
const libelleDuBouton = (/** @type {any} */ root, /** @type {string} */ id) => String(
  bouton(root, id)?.props?.title || '',
);

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

// ---------------------------------------------------------------------------
// 1G — LE CHOIX DES EQUIPES
// ---------------------------------------------------------------------------

describe('N4/1G — la feuille propose les equipes, avec leurs sans-reponse', () => {
  test('une ligne par equipe, avec son nom et son nombre', () => {
    const root = monter();

    expect(parTestID(root, `remind-sheet-team-${EQUIPE_A}`)).toHaveLength(1);
    expect(parTestID(root, `remind-sheet-team-${EQUIPE_B}`)).toHaveLength(1);
    expect(textes(root)).toEqual(expect.arrayContaining(['U15 A', '4 sans réponse']));
    expect(textes(root)).toEqual(expect.arrayContaining(['U15 B', '3 sans réponse']));
  });

  test('🎯 l equipe du bouton presse arrive DEJA COCHEE, l autre non', () => {
    const root = monter({ equipePreCochee: EQUIPE_B });
    const [caseA, caseB] = cases(root);

    expect(caseA.props.accessibilityState.checked).toBe(false);
    expect(caseB.props.accessibilityState.checked).toBe(true);
  });

  test('une equipe SANS sans-reponse ne parait pas : il n y a rien a y relancer', () => {
    const root = monter({
      sections: [
        { key: EQUIPE_A, notAnswered: joueurs(2), teamName: 'U15 A' },
        { key: EQUIPE_B, notAnswered: [], teamName: 'U15 B' },
      ],
    });

    expect(parTestID(root, `remind-sheet-team-${EQUIPE_A}`)).toHaveLength(1);
    expect(parTestID(root, `remind-sheet-team-${EQUIPE_B}`)).toHaveLength(0);
  });

  test('personne a relancer : la feuille le dit, elle ne montre pas une liste vide', () => {
    const root = monter({
      sections: [{ key: EQUIPE_A, notAnswered: [], teamName: 'U15 A' }],
    });

    expect(textes(root)).toEqual(expect.arrayContaining([
      'Tout le monde a répondu : il n’y a personne à relancer.',
    ]));
  });

  test('🔢 le pied compte les personnes des equipes COCHEES, et se dit indicatif', () => {
    const root = monter({ equipePreCochee: EQUIPE_A });

    expect(libelleDuBouton(root, 'remind-sheet-confirm')).toContain('Relancer 4');
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Chiffre indicatif : le serveur écarte les personnes déjà relancées.',
    ]));
  });

  test('cocher la 2e equipe ajoute ses sans-reponse au total du pied', () => {
    const root = monter({ equipePreCochee: EQUIPE_A });

    act(() => { cases(root)[1].props.onPress(); });

    expect(libelleDuBouton(root, 'remind-sheet-confirm')).toContain('Relancer 7');
  });

  test('🎯 relancer envoie les clefs des equipes COCHEES, et elles seules', () => {
    const onRelancer = jest.fn();
    const root = monter({ equipePreCochee: EQUIPE_A, onRelancer });

    act(() => { cases(root)[1].props.onPress(); });
    act(() => { bouton(root, 'remind-sheet-confirm').props.onPress(); });

    expect(onRelancer).toHaveBeenCalledWith([EQUIPE_A, EQUIPE_B]);
  });

  test('aucune equipe cochee : le bouton est ferme', () => {
    const root = monter({ equipePreCochee: '' });

    expect(bouton(root, 'remind-sheet-confirm').props.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 1I — LE MOTIF ANTI-SPAM, AVANT L APPUI
// ---------------------------------------------------------------------------

describe('N4/1I — la feuille previent AVANT d envoyer', () => {
  test('une prochaine relance dans le FUTUR s affiche', () => {
    const root = monter({
      nowMs: Date.parse('2026-08-23T10:00:00.000Z'),
      rapport: { nextReminderAt: '2026-08-25T12:00:00.000Z', parEquipe: [] },
    });

    expect(parTestID(root, 'remind-sheet-antispam')).toHaveLength(1);
  });

  test('🪤 une date DEPASSEE n a plus rien a dire : rien ne s affiche', () => {
    const root = monter({
      nowMs: Date.parse('2026-08-26T10:00:00.000Z'),
      rapport: { nextReminderAt: '2026-08-25T12:00:00.000Z', parEquipe: [] },
    });

    expect(parTestID(root, 'remind-sheet-antispam')).toHaveLength(0);
  });

  test('sans relance passee, il n y a rien a montrer', () => {
    const root = monter({ rapport: null });

    expect(parTestID(root, 'remind-sheet-antispam')).toHaveLength(0);
  });

  test('🔒 un compte rendu d hier n ouvre PAS la feuille sur le compte rendu', () => {
    const root = monter({
      rapport: { parEquipe: [], remindedCount: 9 },
    });

    // Le drapeau interne : tant que CETTE ouverture n a rien envoye, la feuille
    // montre le CHOIX. Sans lui, rouvrir afficherait « 9 personnes relancees »
    // et l on ne pourrait plus rien relancer du tout.
    expect(parTestID(root, 'remind-sheet-teams')).toHaveLength(1);
    expect(parTestID(root, 'remind-sheet-report')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 1H — LE COMPTE RENDU, AVEC LES CHIFFRES DU SERVEUR
// ---------------------------------------------------------------------------

describe('N4/1H — apres l envoi, la feuille rend compte', () => {
  const relancer = (/** @type {any} */ root) => {
    act(() => { bouton(root, 'remind-sheet-confirm').props.onPress(); });
  };

  test('🔢 le chiffre affiche est celui du SERVEUR, pas celui du pied', () => {
    // Le pied annoncait 4 (le compte de l app). Le serveur n en a relance
    // qu UNE : l anti-spam a ecarte les 3 autres. C est 1 qui doit s afficher.
    const root = monter({
      equipePreCochee: EQUIPE_A,
      rapport: { blockedCount: 3, parEquipe: [], remindedCount: 1 },
    });
    expect(libelleDuBouton(root, 'remind-sheet-confirm')).toContain('Relancer 4');

    relancer(root);

    expect(parTestID(root, 'remind-sheet-report')).toHaveLength(1);
    expect(textes(root)).toEqual(expect.arrayContaining(['1 personne relancee']));
  });

  test('🚨 quand RIEN n est parti, la feuille ne dit jamais « envoye »', () => {
    const root = monter({
      equipePreCochee: EQUIPE_A,
      rapport: { blockedCount: 4, parEquipe: [], remindedCount: 0 },
    });

    relancer(root);

    const lus = textes(root).join(' ');
    expect(lus).toContain('Personne n a ete relance');
    expect(lus).not.toContain('envoye');
  });

  test('la ventilation nomme chaque equipe appelee, et son echec s il y en a un', () => {
    const root = monter({
      equipePreCochee: EQUIPE_A,
      rapport: {
        parEquipe: [
          { echec: false, remindedCount: 3, teamId: EQUIPE_A, teamName: 'U15 A' },
          { echec: true, remindedCount: 0, teamId: EQUIPE_B, teamName: 'U15 B' },
        ],
        remindedCount: 3,
      },
    });

    relancer(root);

    const lus = textes(root);
    expect(lus).toEqual(expect.arrayContaining(['U15 A', '3 relancé·e·s']));
    expect(lus).toEqual(expect.arrayContaining(['U15 B', 'échec']));
  });

  test('une seule equipe : pas de ventilation, la phrase suffit', () => {
    const root = monter({
      equipePreCochee: EQUIPE_A,
      rapport: {
        parEquipe: [{ echec: false, remindedCount: 2, teamId: EQUIPE_A, teamName: 'U15 A' }],
        remindedCount: 2,
      },
    });

    relancer(root);

    expect(textes(root)).toEqual(expect.arrayContaining(['2 personnes relancees']));
    expect(textes(root)).not.toEqual(expect.arrayContaining(['2 relancé·e·s']));
  });

  test('🚨 une relance en panne le dit, et dit que personne n a ete prevenu', () => {
    const root = monter({ equipePreCochee: EQUIPE_A, erreur: new Error('502') });

    relancer(root);

    const lus = textes(root).join(' ');
    expect(lus).toContain('La relance n’a pas pu partir');
    expect(lus).toContain('Personne n’a été prévenu');
  });
});
