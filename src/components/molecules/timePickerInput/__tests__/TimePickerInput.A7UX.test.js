import { createElement } from 'react';
import { Platform, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TimePickerInput from '../TimePickerInput';

// ⏰ A7-UX (20/10, constat d'Adel sur le site, capture A7-UX-choix-heure-site-adel.png) — « le
// défilement d'heure n'est pas UX/UI ». Sur le site, le champ ouvrait la LISTE NATIVE du
// navigateur : deux colonnes grises (heures, minutes de 1 en 1), étrangères au style de FoundClub,
// posées par-dessus « Suivant ». Mesuré au banc (20/10) : le champ ne se touchait que sur 23 px de
// haut, et Échap dans la liste faisait RECULER le tunnel d'une étape (4/6 → 3/6).
//
// Le choix neuf, aux couleurs de FoundClub, DANS la page (rien ne recouvre « Suivant ») : un appui
// sur le champ ouvre les heures de la journée (08 h → 22 h, la nuit sur demande), un appui sur une
// heure ouvre ses minutes de 5 en 5 (les quarts d'heure en première colonne), un appui écrit
// « HH:mm » et referme. Au clavier : on tape « 1730 », les flèches avancent d'un quart d'heure,
// Échap referme la grille SANS remonter au tunnel. Le contrat ne change pas : `onChange` ne reçoit
// que « HH:mm » ou « ».
// ROUGE avant le lot : le site montait un `<input type="time">`.

const mockRoues = [];
// Les libellés de fr.js, interpolés (« 17 h ») : i18next est démarré en français par jest.setup.js.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@react-native-community/datetimepicker', () => function RoueMock(
  /** @type {any} */ props,
) {
  mockRoues.push(props);
  return null;
});
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

/** @type {any[]} */
const arbres = [];
/** @type {string[]} */
let rendues = [];

const monter = (/** @type {any} */ props = {}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(TimePickerInput, {
      label: 'Début',
      onChange: (/** @type {string} */ heure) => rendues.push(heure),
      value: '',
      ...props,
    }));
  });
  arbres.push(arbre);
  return arbre;
};

// Les choix d'une grille ouverte : leur libellé lu par le lecteur d'écran.
const choix = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && typeof n.props?.accessibilityLabel === 'string'
    && n.props?.accessibilityRole === 'button',
  { deep: false },
);
const libelles = (/** @type {any} */ arbre) => choix(arbre).map((n) => n.props.accessibilityLabel);
const unChoix = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const cible = choix(arbre).find((n) => n.props.accessibilityLabel === libelle);
  if (!cible) throw new Error(`aucun choix « ${libelle} » ; vus : ${libelles(arbre).join(', ')}`);
  return cible;
};
const toucher = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  act(() => { unChoix(arbre, libelle).props.onPress(); });
};
const champ = (/** @type {any} */ arbre) => arbre.root.findAllByType(TextInput)[0];
const ouvrir = (/** @type {any} */ arbre) => {
  act(() => { champ(arbre).props.onFocus?.({}); });
};
const touche = (/** @type {string} */ key) => {
  const evenement = {
    key,
    nativeEvent: { key, stopPropagation: jest.fn() },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
  };
  return evenement;
};
// La racine du champ : elle écoute Échap (keyup) pour que la fenêtre du tunnel ne l'entende pas.
const racine = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onKeyUp === 'function',
  { deep: false },
)[0];

const osDOrigine = Platform.OS;
beforeEach(() => {
  rendues = [];
  mockRoues.length = 0;
  Platform.OS = 'web';
});
afterEach(() => {
  act(() => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
  Platform.OS = osDOrigine;
});

describe('A7-UX — sur le site, le choix de l heure aux couleurs de FoundClub', () => {
  test('🔴 plus de liste native du navigateur : aucun <input type="time">', () => {
    const arbre = monter({ value: '09:30' });

    const listesNatives = arbre.root.findAll(
      (/** @type {any} */ n) => n.type === 'input' && n.props.type === 'time',
    );
    expect(listesNatives).toHaveLength(0);
    expect(mockRoues).toHaveLength(0);
  });

  test('🔴 le champ se tape, porte son libellé, et montre l heure saisie', () => {
    const arbre = monter({ value: '09:30' });

    expect(champ(arbre).props.value).toBe('09:30');
    expect(champ(arbre).props.accessibilityLabel).toBe('Début');
  });

  test('🔴 ouvrir montre les heures de la journée, 08 h → 22 h, l heure saisie choisie', () => {
    const arbre = monter({ value: '09:30' });
    expect(libelles(arbre)).toEqual([]);

    ouvrir(arbre);

    expect(libelles(arbre).filter((l) => / h$/.test(l))).toEqual([
      '08 h', '09 h', '10 h', '11 h', '12 h', '13 h', '14 h', '15 h',
      '16 h', '17 h', '18 h', '19 h', '20 h', '21 h', '22 h',
    ]);
    expect(unChoix(arbre, '09 h').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
    expect(unChoix(arbre, '10 h').props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
  });

  test('🔴 « Autres heures » ouvre la nuit et le petit matin (23 h, 00 h → 07 h)', () => {
    const arbre = monter();
    ouvrir(arbre);

    toucher(arbre, 'Autres heures');

    expect(libelles(arbre)).toEqual(expect.arrayContaining(['23 h', '00 h', '07 h']));
    expect(libelles(arbre)).not.toContain('Autres heures');
  });

  test('🔴 deux appuis : 17 h, puis 17:30 — l heure part en HH:mm et la grille se referme', () => {
    const arbre = monter();
    ouvrir(arbre);

    toucher(arbre, '17 h');
    expect(libelles(arbre).filter((l) => /^17:/.test(l))).toEqual([
      '17:00', '17:05', '17:10', '17:15', '17:20', '17:25',
      '17:30', '17:35', '17:40', '17:45', '17:50', '17:55',
    ]);
    toucher(arbre, '17:30');

    expect(rendues).toEqual(['17:30']);
    expect(libelles(arbre)).toEqual([]);
  });

  test('🔴 « Autre heure » revient aux heures sans rien écrire', () => {
    const arbre = monter();
    ouvrir(arbre);
    toucher(arbre, '17 h');

    toucher(arbre, 'Autre heure');

    expect(libelles(arbre)).toContain('08 h');
    expect(rendues).toEqual([]);
  });

  test('🔴 au clavier : « 1730 » écrit 17:30 ; incomplet, rien ; vider écrit « »', () => {
    const arbre = monter();

    act(() => { champ(arbre).props.onChangeText('17'); });
    act(() => { champ(arbre).props.onChangeText('173'); });
    expect(rendues).toEqual([]);
    act(() => { champ(arbre).props.onChangeText('1730'); });
    act(() => { champ(arbre).props.onChangeText('9h05'); });
    act(() => { champ(arbre).props.onChangeText(''); });

    expect(rendues).toEqual(['17:30', '09:05', '']);
  });

  // C04 Q1-01 (25/10) : touche par touche, « 1230 » devenait 01:23 (la 3e touche réécrivait).
  test('🔴 C04 Q1-01 : taper 1230, 2015, 2100 touche par touche écrit la bonne heure', () => {
    const arbre = monter();
    const taperTouches = (/** @type {string} */ touches) => {
      touches.split('').forEach((c) => {
        act(() => { champ(arbre).props.onChangeText(`${champ(arbre).props.value}${c}`); });
      });
      const derniere = rendues[rendues.length - 1];
      act(() => { champ(arbre).props.onChangeText(''); });
      return derniere;
    };

    expect([taperTouches('1230'), taperTouches('12:30'), taperTouches('2015'), taperTouches('2100'),
      taperTouches('930')]).toEqual(['12:30', '12:30', '20:15', '21:00', '09:30']);
  });

  test('🔴 au clavier : les flèches avancent ou reculent d un quart d heure', () => {
    const arbre = monter({ value: '17:30' });

    act(() => { champ(arbre).props.onKeyPress(touche('ArrowUp')); });
    act(() => { champ(arbre).props.onKeyPress(touche('ArrowDown')); });

    expect(rendues).toEqual(['17:45', '17:15']);
  });

  test('🔴 Échap referme la grille et NE remonte PAS au tunnel (qui reculerait d une étape)', () => {
    const arbre = monter();
    ouvrir(arbre);
    const echap = touche('Escape');

    act(() => { racine(arbre).props.onKeyUp(echap); });

    expect(libelles(arbre)).toEqual([]);
    expect(echap.stopPropagation).toHaveBeenCalled();
  });

  test('🔴 grille fermée, Échap n est pas retenu : le tunnel garde son geste', () => {
    const arbre = monter();
    const echap = touche('Escape');

    act(() => { racine(arbre).props.onKeyUp(echap); });

    expect(echap.stopPropagation).not.toHaveBeenCalled();
  });

  test('🔴 la Fin connaît le Début (« apres ») : les heures d avant ne se choisissent pas', () => {
    const arbre = monter({ apres: '17:30', label: 'Fin' });
    ouvrir(arbre);

    expect(unChoix(arbre, '16 h').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(unChoix(arbre, '17 h').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
    toucher(arbre, '17 h');
    expect(unChoix(arbre, '17:30').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
    expect(unChoix(arbre, '17:35').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
  });

  test('🔴 une seule grille ouverte à la fois : ouvrir la Fin referme le Début', () => {
    const debut = monter({ label: 'Début' });
    const fin = monter({ label: 'Fin' });
    ouvrir(debut);
    expect(libelles(debut)).toContain('08 h');

    ouvrir(fin);

    expect(libelles(debut)).toEqual([]);
    expect(libelles(fin)).toContain('08 h');
  });
});

// ⏰ A7-UX-2 (22/10, Adel « P4 oui ») — LES HEURES PLEINES DANS LA GRILLE DU SITE. Le formulaire
// passe les plages pleines du jour (`pleines`, en minutes) : une heure toute pleine dit
// « complet »,
// une heure en partie pleine dit « en partie », à l'œil ET au lecteur d'écran ; elles restent
// touchables (« Attribuer quand même », D74). Aux minutes, chaque case pleine dit « complet ».
// ROUGE avant : la grille ne savait rien des places.
describe('A7-UX-2 — les heures pleines du jour dans la grille', () => {
  const PLEINES = [{ end: (20 * 60) + 30, start: 19 * 60 }];

  test('🔴 19 h pleine : « complet » ; 20 h à moitié : « en partie » ; 18 h libre', () => {
    const arbre = monter({ pleines: PLEINES });
    ouvrir(arbre);

    expect(libelles(arbre))
      .toEqual(expect.arrayContaining(['18 h', '19 h, complet', '20 h, en partie']));
    expect(unChoix(arbre, '19 h, complet').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: false }),
    );
  });

  test('🔴 minutes de 20 h : 20:00 à 20:25 « complet », 20:30 libre ; le choix part', () => {
    const arbre = monter({ pleines: PLEINES });
    ouvrir(arbre);
    toucher(arbre, '20 h, en partie');

    expect(libelles(arbre))
      .toEqual(expect.arrayContaining(['20:00, complet', '20:25, complet', '20:30']));
    toucher(arbre, '20:00, complet');
    expect(rendues).toEqual(['20:00']);
  });
});
