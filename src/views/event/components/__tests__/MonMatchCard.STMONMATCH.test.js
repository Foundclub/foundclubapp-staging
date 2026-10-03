/* eslint-disable max-len -- les libellés du design se lisent en entier. */
import { createElement } from 'react';
import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// 🎯 ST-MONMATCH (écran 12, design des statistiques validé le 02/10, parcours 4
// « Le joueur répond », planche « Mon match, sur la page du match ») — UNE SEULE
// CARTE « MON MATCH » au lieu de « Mes stats » et « Mon retour coach ».
//
// Les sept états de la planche :
//   1 · à répondre — une phrase qui nomme l'entraîneur, « Donner mon retour » ; pas de
//       carte vide « En attente » ;
//   2 · brouillon — ce qui est déjà rempli, ce qui reste, « Reprendre ma réponse » ;
//   3 · envoyée, et le retour de Karim — les chiffres envoyés ENFIN visibles, les deux
//       notes, puis le retour NOMMÉ et dit privé (« Toi et tes parents ») ;
//   4 · envoyée, pas encore de retour — une ligne, plus une carte « En attente » ;
//   5 · arrivé par la notification — le retour EN PREMIER, surligné, « Nouveau » ;
//   6 · présent sans jouer — « Là sans jouer » au lieu de chiffres à zéro ;
//   7 · l'entraîneur — rien (témoin sur la fiche : EventDetailsFINITIONS0928, STATS-FIX2 · 4).
//
// La doublure de `t` délègue au VRAI i18next démarré sur `fr.js` (jest.setup.js) : un
// libellé qui n'existe pas dans `fr.js` se voit ici.
// ==========================================================================

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (
      /** @type {string} */ cle,
      /** @type {any} */ repliOuOptions,
      /** @type {any} */ options,
    ) => {
      const i18n = jest.requireActual('i18next');
      if (typeof repliOuOptions === 'string') {
        return i18n.t(cle, { defaultValue: repliOuOptions, ...(options || {}) });
      }
      return i18n.t(cle, repliOuOptions);
    },
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
      },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});

// eslint-disable-next-line import/first
import MonMatchCard from '../MonMatchCard';

/** @type {any[]} */
const montes = [];

afterEach(() => {
  montes.splice(0).forEach((arbre) => act(() => arbre.unmount()));
});

const rendre = (/** @type {any} */ props) => {
  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      createElement(MonMatchCard, {
        entraineur: 'Karim', onRepondre: jest.fn(), sport: 'football', ...props,
      }),
    );
  });
  montes.push(arbre);
  return arbre.root;
};

const texteDe = (/** @type {any} */ noeud) => {
  if (noeud === null || noeud === undefined || noeud === false) return '';
  if (typeof noeud === 'string' || typeof noeud === 'number') return String(noeud);
  if (Array.isArray(noeud)) return noeud.map(texteDe).join('');
  return texteDe(noeud?.props?.children);
};

const textes = (/** @type {any} */ root) => root.findAllByType(Text)
  .map((/** @type {any} */ n) => texteDe(n).replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const parTestID = (/** @type {any} */ root, /** @type {string} */ id) => root
  .findAll((/** @type {any} */ n) => n.props?.testID === id, { deep: false });

const appuyerSur = (/** @type {any} */ root, /** @type {string} */ libelle) => {
  const cible = root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && textes(n).includes(libelle))[0];
  if (!cible) throw new Error(`Aucun geste « ${libelle} »`);
  act(() => { cible.props.onPress(); });
};

const ENVOYEE = {
  minutesPlayed: 90,
  participation: 'played',
  quantitativeState: 'completed',
  selfRating: 8,
  sportPayload: { assists: 0, cleanSheet: false, goals: 1 },
  status: 'submitted',
  submittedAt: '2026-10-01T20:28:00.000Z',
  teamRating: 7,
};
const RETOUR = {
  comment: 'Bon pressing, mais replacement trop lent sur les transitions. À revoir en vidéo.',
  rating: 7,
  submittedAt: '2026-10-01T20:39:00.000Z',
};

describe('ST-MONMATCH écran 12 — « Mon match », état par état', () => {
  test('1 · à répondre : une carte, « À répondre », la phrase qui nomme Karim, « Donner mon retour »', () => {
    const root = rendre({ reponse: null });
    const lus = textes(root);

    expect(lus.filter((texte) => texte === 'Mon match')).toHaveLength(1);
    expect(lus).toEqual(expect.arrayContaining([
      'Ma réponse',
      'À répondre',
      'Dis si tu as joué, tes chiffres et tes deux notes. Karim les lira.',
      'Donner mon retour',
    ]));
    // Sans retour de l'entraîneur, pas de carte vide « En attente » (design, état 1).
    expect(lus.join(' | ')).not.toMatch(/En attente|Pas encore partagé|Retour individuel|Mes stats|Mon retour coach/);
    expect(parTestID(root, 'st-monmatch-retour')).toHaveLength(0);
  });

  test('1 bis · sans prénom d entraîneur, la phrase reste vraie', () => {
    const lus = textes(rendre({ entraineur: '', reponse: null }));

    expect(lus).toContain('Dis si tu as joué, tes chiffres et tes deux notes. Ton entraîneur les lira.');
  });

  test('2 · brouillon : ce qui est rempli, ce qui reste, « Reprendre ma réponse »', () => {
    const root = rendre({
      reponse: {
        ...ENVOYEE, selfRating: null, status: 'draft', submittedAt: null, teamRating: null,
      },
    });
    const lus = textes(root);

    expect(lus).toEqual(expect.arrayContaining(['Brouillon', 'Reprendre ma réponse']));
    expect(lus).toEqual(expect.arrayContaining(['90', 'minutes', '1', 'but', '0', 'passe', '—', 'ma note']));
    expect(lus).toContain('Il te reste ta note et celle de l\'équipe.');
    expect(lus).not.toContain('Envoyée');
  });

  test('3 · envoyée, et le retour de Karim : les chiffres envoyés, les deux notes, le retour nommé et dit privé', () => {
    const root = rendre({ reponse: ENVOYEE, retourDuCoach: RETOUR });
    const lus = textes(root);

    expect(lus).toEqual(expect.arrayContaining(['Envoyée', 'Modifier ma réponse']));
    expect(lus.some((texte) => /^Le 1 oct\.? à \d{2}:\d{2}$/.test(texte))).toBe(true);
    // Les cinq cases du design : 90 minutes · 1 but · 0 passe · 8 ma note · 7 l'équipe.
    expect(lus).toEqual(expect.arrayContaining(['90', 'minutes', '1', 'but', '0', 'passe', '8', 'ma note', '7', 'l\'équipe']));
    expect(lus).toEqual(expect.arrayContaining([
      'Le retour de Karim', 'Toi et tes parents', '7/10', RETOUR.comment,
    ]));
    // Le retour vit DANS la carte « Mon match », sous la réponse.
    const ordre = lus.indexOf('Ma réponse') < lus.indexOf('Le retour de Karim');
    expect(ordre).toBe(true);
    expect(lus).not.toContain('Nouveau');
  });

  test('4 · envoyée, pas encore de retour : une ligne, plus de carte « En attente »', () => {
    const lus = textes(rendre({ reponse: ENVOYEE }));

    expect(lus).toContain('Karim n\'a pas encore écrit de retour pour toi. Tu seras prévenu·e.');
    expect(lus.join(' | ')).not.toMatch(/En attente|Pas encore partagé/);
  });

  test('5 · arrivé par la notification : le retour EN PREMIER, surligné, « Nouveau »', () => {
    const root = rendre({ arriveParLeRetour: true, reponse: ENVOYEE, retourDuCoach: RETOUR });
    const lus = textes(root);

    expect(lus).toEqual(expect.arrayContaining(['Nouveau', 'Visible par toi et tes parents.', '7/10']));
    expect(lus.indexOf('Le retour de Karim')).toBeLessThan(lus.indexOf('Ma réponse'));
    const [retour] = parTestID(root, 'st-monmatch-retour');
    expect(retour).toBeTruthy();
    // Surligné : un bord de 2 px, plus vif que celui d'une carte ordinaire.
    expect(StyleSheet.flatten(retour.props.style).borderWidth).toBe(2);
    // Le retour ne se lit qu'UNE fois.
    expect(lus.filter((texte) => texte === RETOUR.comment)).toHaveLength(1);
  });

  test('6 · présent sans jouer : « Là sans jouer », les deux notes, aucun chiffre à zéro', () => {
    const lus = textes(rendre({
      reponse: {
        ...ENVOYEE, minutesPlayed: 0, participation: 'present_no_play', quantitativeState: 'not_applicable', selfRating: 6, sportPayload: {},
      },
    }));

    expect(lus).toEqual(expect.arrayContaining(['Là sans jouer', '6', 'ma note', '7', 'l\'équipe', 'Modifier ma réponse']));
    expect(lus).not.toContain('minutes');
    expect(lus).not.toContain('but');
  });

  test('les trois gestes ouvrent le questionnaire du joueur', () => {
    const onRepondre = jest.fn();
    appuyerSur(rendre({ onRepondre, reponse: null }), 'Donner mon retour');
    appuyerSur(rendre({
      onRepondre, reponse: { ...ENVOYEE, status: 'draft' },
    }), 'Reprendre ma réponse');
    appuyerSur(rendre({ onRepondre, reponse: ENVOYEE }), 'Modifier ma réponse');

    expect(onRepondre).toHaveBeenCalledTimes(3);
  });

  test('un retour du coach SANS réponse du joueur reste lisible (ST-RETOURS, défaut 5)', () => {
    const lus = textes(rendre({ reponse: null, retourDuCoach: RETOUR }));

    expect(lus).toEqual(expect.arrayContaining(['À répondre', 'Le retour de Karim', '7/10', RETOUR.comment]));
  });

  test('basket : les chiffres du basket, accordés', () => {
    const lus = textes(rendre({
      reponse: {
        ...ENVOYEE,
        minutesPlayed: 32,
        sportPayload: {
          assists: 1, points: 12, rebounds: 4, threePointsMade: 2,
        },
      },
      sport: 'basketball',
    }));

    expect(lus).toEqual(expect.arrayContaining(['32', 'minutes', '12', 'points', '1', 'passe', '4', 'rebonds']));
    expect(lus).not.toContain('but');
  });
});
