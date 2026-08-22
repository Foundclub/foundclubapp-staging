import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// N4 (D6) — LA CARTE « APRÈS LE MATCH », TESTEE SEULE.
//
// 🧨 CE QU ELLE REMPLACE : sept libelles pour un seul bouton, decides par un
// `useMemo` de sept branches. Le coach lisait un mot different a chaque visite
// sans jamais voir OU il en etait.
//
// CE QUI SE VERIFIE ICI — les trois etats du parcours, et ce que chacun dit :
//   · l etape COURANTE se deduit des faits, elle ne se stocke pas ;
//   · 🔒 une verification requise RENVOIE a l etape 2, meme rapport publie —
//     se dire « complet » quand le score officiel a change serait le mensonge
//     que la carte doit empecher ;
//   · le motif d une porte fermee ne disparait pas ;
//   · un seul bouton, sur l etape courante, et il ouvre CETTE etape.
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

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      {
        accessibilityRole: 'button',
        disabled: Boolean(props.disabled),
        onPress: props.onPress,
        testID: props.testID,
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import PostMatchJourneyCard, { resoudreLeParcours } from '../PostMatchJourneyCard';

/** @type {any[]} */
const montes = [];

const monter = (/** @type {any} */ options = {}) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      <PostMatchJourneyCard
        boutonDesactive={options.boutonDesactive ?? false}
        motif={options.motif ?? ''}
        onPressEtape={options.onPressEtape ?? jest.fn()}
        reponsesAttendues={options.reponsesAttendues ?? 0}
        reponsesRecues={options.reponsesRecues ?? 0}
        scoreDisponible={options.scoreDisponible ?? false}
        scoreLibelle={options.scoreLibelle ?? 'Score à compléter'}
        scoreOrigine={options.scoreOrigine ?? ''}
        statsFinalisees={options.statsFinalisees ?? false}
        verificationRequise={options.verificationRequise ?? false}
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
  .findAll((/** @type {any} */ node) => node.props?.testID === id, { deep: false })[0];

const libelleDuBouton = (/** @type {any} */ root) => String(
  parTestID(root, 'post-match-action')?.props?.title || '',
);

// Le score enregistre, tel que l ecran le fabrique deja.
const AVEC_SCORE = { scoreDisponible: true, scoreLibelle: '3 - 1', scoreOrigine: 'manual' };

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

// ---------------------------------------------------------------------------
// LE PARCOURS — la fonction pure, sans rendu
// ---------------------------------------------------------------------------

describe('N4/D6 — ou en est-on du parcours', () => {
  test('sans score, on est a l etape 1 et rien n est fait', () => {
    expect(resoudreLeParcours({
      scoreDisponible: false,
      statsFinalisees: false,
      toutesLesReponses: false,
      verificationRequise: false,
    })).toEqual({ courante: 'score', faites: [] });
  });

  test('score enregistre, stats a faire : etape 2, le score est derriere', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: false,
      toutesLesReponses: false,
      verificationRequise: false,
    })).toEqual({ courante: 'stats', faites: ['score'] });
  });

  test('stats publiees, reponses incompletes : etape 3', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: true,
      toutesLesReponses: false,
      verificationRequise: false,
    })).toEqual({ courante: 'responses', faites: ['score', 'stats'] });
  });

  test('tout est fait : plus d etape courante', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: true,
      toutesLesReponses: true,
      verificationRequise: false,
    })).toEqual({ courante: '', faites: ['score', 'stats', 'responses'] });
  });

  test('🔒 une verification requise RENVOIE a l etape 2, meme rapport publie', () => {
    expect(resoudreLeParcours({
      scoreDisponible: true,
      statsFinalisees: true,
      toutesLesReponses: true,
      verificationRequise: true,
    })).toEqual({ courante: 'stats', faites: ['score'] });
  });
});

// ---------------------------------------------------------------------------
// CE QUE LA CARTE AFFICHE — 3 etats × contenu
// ---------------------------------------------------------------------------

describe('N4/D6 — etape 1 : le score', () => {
  test('l en-tete dit ou on en est, en toutes lettres', () => {
    const root = monter();

    expect(textes(root)).toEqual(expect.arrayContaining(['APRÈS LE MATCH', 'Étape 1 sur 3']));
  });

  test('les trois etapes sont TOUJOURS visibles, meme celles a venir', () => {
    const root = monter();

    expect(parTestID(root, 'post-match-step-score')).toBeTruthy();
    expect(parTestID(root, 'post-match-step-stats')).toBeTruthy();
    expect(parTestID(root, 'post-match-step-responses')).toBeTruthy();
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Score',
      'Statistiques de l’équipe',
      'Buteurs, passeurs, temps de jeu',
      'Retours des joueurs',
    ]));
  });

  test('sans score, l etape 1 dit qu il reste a l enregistrer', () => {
    const root = monter();

    expect(textes(root)).toEqual(expect.arrayContaining(['À enregistrer']));
    expect(libelleDuBouton(root)).toBe('Enregistrer le score');
  });

  test('🎯 le bouton ouvre l etape COURANTE, nommee', () => {
    const onPressEtape = jest.fn();
    const root = monter({ onPressEtape });

    act(() => { parTestID(root, 'post-match-action').props.onPress(); });

    expect(onPressEtape).toHaveBeenCalledWith('score');
  });
});

describe('N4/D6 — etape 2 : les statistiques', () => {
  test('🔢 le score enregistre s affiche AVEC son origine', () => {
    const root = monter(AVEC_SCORE);

    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1 · saisi à la main']));
    expect(textes(root)).toEqual(expect.arrayContaining(['Étape 2 sur 3']));
  });

  test('un score officiel le dit autrement', () => {
    const root = monter({ ...AVEC_SCORE, scoreOrigine: 'external_sync' });

    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1 · score officiel']));
  });

  test('une origine inconnue n invente rien : le score, tout seul', () => {
    const root = monter({ ...AVEC_SCORE, scoreOrigine: '' });

    expect(textes(root)).toEqual(expect.arrayContaining(['3 - 1']));
  });

  test('le bouton propose de saisir les stats, et ouvre CETTE etape', () => {
    const onPressEtape = jest.fn();
    const root = monter({ ...AVEC_SCORE, onPressEtape });

    expect(libelleDuBouton(root)).toBe('Saisir les stats');
    act(() => { parTestID(root, 'post-match-action').props.onPress(); });

    expect(onPressEtape).toHaveBeenCalledWith('stats');
  });

  test('🔒 verification requise : le bouton dit « Mettre à jour »', () => {
    const root = monter({ ...AVEC_SCORE, statsFinalisees: true, verificationRequise: true });

    expect(libelleDuBouton(root)).toBe('Mettre à jour');
    expect(textes(root)).toEqual(expect.arrayContaining(['Étape 2 sur 3']));
  });
});

describe('N4/D6 — etape 3 : les retours des joueurs', () => {
  test('🔢 le compteur porte SES DEUX nombres', () => {
    const root = monter({
      ...AVEC_SCORE,
      reponsesAttendues: 12,
      reponsesRecues: 4,
      statsFinalisees: true,
    });

    expect(textes(root)).toEqual(expect.arrayContaining(['4 sur 12 ont répondu']));
    expect(textes(root)).toEqual(expect.arrayContaining(['Étape 3 sur 3']));
    expect(libelleDuBouton(root)).toBe('Voir les retours');
  });

  test('personne d attendu : la carte le dit plutot que d afficher « 0 sur 0 »', () => {
    const root = monter({ ...AVEC_SCORE, statsFinalisees: true });

    expect(textes(root)).toEqual(expect.arrayContaining(['Personne n’a encore répondu']));
  });

  test('tout le monde a repondu : le parcours est complet, et le bouton donne acces', () => {
    const root = monter({
      ...AVEC_SCORE,
      reponsesAttendues: 12,
      reponsesRecues: 12,
      statsFinalisees: true,
    });

    expect(textes(root)).toEqual(expect.arrayContaining(['C’est complet']));
    expect(libelleDuBouton(root)).toBe('Voir les stats du match');
  });
});

describe('N4/D6 — une porte fermee dit POURQUOI', () => {
  test('⛔ le motif s affiche, et le bouton est ferme', () => {
    const root = monter({
      boutonDesactive: true,
      motif: 'Les stats seront disponibles à la fin du match.',
    });

    expect(parTestID(root, 'post-match-action').props.disabled).toBe(true);
    expect(textes(root)).toEqual(expect.arrayContaining([
      'Les stats seront disponibles à la fin du match.',
    ]));
  });

  test('porte ouverte : aucun motif ne traine', () => {
    const root = monter({ motif: 'Les stats seront disponibles à la fin du match.' });

    expect(parTestID(root, 'post-match-motif')).toBeUndefined();
    expect(parTestID(root, 'post-match-action').props.disabled).toBe(false);
  });
});
