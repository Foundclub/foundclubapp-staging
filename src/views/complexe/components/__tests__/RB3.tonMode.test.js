import {
  AccessibilityInfo, Platform, TouchableOpacity, useWindowDimensions,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { demanderLAnnonceDArrivee, prendreLAnnonceDArrivee } from '@/domains/complexe/tonMode';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import TonMode from '@/views/complexe/components/TonMode';

import { parRepere, pressable, textes } from '@/testSupport/temoinComplexe';

// RESA-BASCULE (20/10/2026) — LA PIÈCE « TON MODE » de la planche RB-3 validée par Adel, montée
// avec le VRAI contrôle à onglets (SegmentedControl en 44 px et en « boutons radio ») : les états 1
// à 5 (2, 3, 4 positions ; 2 × 2 ; texte très agrandi ; en cours ; annonces), la phrase de l'état 6
// mot pour mot, les formes du site (empilée dans un menu, une ligne sur l'accueil d'ordinateur).
// Écrit ROUGE (la pièce n'existait pas).

/* eslint-disable global-require */
jest.mock('react-native-reanimated', () => require('@/testSupport/animationDouble').reanimated());
jest.mock('react-native-gesture-handler', () => (
  require('@/testSupport/animationDouble').gestureHandler()
));
/* eslint-enable global-require */

/** @type {Array<() => void>} */
const mockRetours = [];
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (/** @type {() => void} */ effet) => {
    mockRetours.push(effet);
  },
}));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    fontScale: 1, height: 844, scale: 3, width: 390,
  })),
}));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const NOM = 'Le Five de Montrivage';
const P = {
  coach: { cle: 'coach', mode: null },
  complexe: { cle: 'complexe', mode: null },
  dirigeant: { cle: 'dirigeant', mode: null },
  joueur: { cle: 'joueur', mode: null },
  joueurDuStaff: { cle: 'joueur', mode: 'player' },
  parent: { cle: 'parent', mode: 'parent' },
  parentDuCompte: { cle: 'parent', mode: null },
};

const plateformeDOrigine = Platform.OS;
let annonces = /** @type {string[]} */ ([]);
beforeEach(() => {
  mockRetours.length = 0;
  annonces = [];
  jest.spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation((texte) => { annonces.push(texte); });
  /** @type {any} */ (useWindowDimensions).mockReturnValue({
    fontScale: 1, height: 844, scale: 3, width: 390,
  });
  prendreLAnnonceDArrivee();
});
afterEach(() => {
  Platform.OS = plateformeDOrigine;
  jest.restoreAllMocks();
});

/**
 * Monte la pièce.
 * @param {Record<string, any>} props - Les propriétés.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async (props) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <TonMode
        actif={props.actif}
        disposition={props.disposition}
        nomDuComplexe={NOM}
        offre={props.offre}
        onArrivee={props.onArrivee}
        onChoisir={props.onChoisir || jest.fn()}
        positions={props.positions}
        prenoms={props.prenoms}
      />,
    );
  });
  return arbre;
};

// Les rangées : les libellés de chaque contrôle à onglets.
const rangees = (/** @type {any} */ arbre) => arbre.root.findAllByType(SegmentedControl)
  .map((/** @type {any} */ c) => c.props.options.map((/** @type {any} */ o) => o.label));
// Les boutons radio, dans l'ordre : leur nom accessible et s'ils sont cochés.
const radios = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity).filter(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'radio',
).map((/** @type {any} */ n) => `${n.props.accessibilityLabel}${
  n.props.accessibilityState.checked ? ' (coché)' : ''}${
  n.props.accessibilityState.disabled ? ' (inerte)' : ''}`);
const choisir = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

describe('RB-3 état 1 — gérant + joueur : 2 positions', () => {
  it('1a · dans le complexe : « Ton mode », Complexe allumé, « Tu gères … »', async () => {
    const arbre = await monter({ actif: 'complexe', positions: [P.complexe, P.joueur] });
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Joueur', 'Tu gères Le Five de Montrivage.',
    ]);
    expect(rangees(arbre)).toEqual([['Complexe', 'Joueur']]);
    expect(radios(arbre)).toEqual(['Complexe, 1 sur 2 (coché)', 'Joueur, 2 sur 2']);
    const groupe = parRepere(arbre, 'ton-mode');
    expect(groupe.props.accessibilityRole).toBe('radiogroup');
    expect(groupe.props.accessibilityLabel).toBe('Ton mode');
  });

  it('1b · à l accueil : Joueur allumé, « Tu vois l’app comme un joueur. »', async () => {
    const arbre = await monter({ actif: 'joueur', positions: [P.complexe, P.joueur] });
    expect(textes(arbre)).toContain('Tu vois l’app comme un joueur.');
    expect(radios(arbre)).toEqual(['Complexe, 1 sur 2', 'Joueur, 2 sur 2 (coché)']);
  });

  it('un seul mode : pas de contrôle', async () => {
    const arbre = await monter({ actif: 'complexe', positions: [P.complexe] });
    expect(arbre.toJSON()).toBeNull();
  });
});

describe('RB-3 état 2 — gérant + compte Parent : l offre sous un filet', () => {
  it('2a · Complexe · Parent, et « Tu pratiques aussi un sport ? »', async () => {
    const onPress = jest.fn();
    const arbre = await monter({
      actif: 'parent', offre: { onPress }, positions: [P.complexe, P.parentDuCompte],
    });
    expect(textes(arbre)).toEqual([
      'TON MODE', 'Complexe', 'Parent', 'Tu vois l’app comme un parent.',
      'Tu pratiques aussi un sport ?', 'Basculer en mode joueur',
    ]);
    await choisir(arbre, 'Basculer en mode joueur');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('2c · après la feuille : Joueur apparaît à sa place, entre Complexe et Parent', async () => {
    const arbre = await monter({
      actif: 'joueur', positions: [P.complexe, P.joueur, P.parent], prenoms: ['Léa'],
    });
    expect(rangees(arbre)).toEqual([['Complexe', 'Joueur', 'Parent']]);
    expect(textes(arbre)).toContain(
      'Tu vois l’app comme un joueur. Léa t’attend dans le mode parent.',
    );
    expect(parRepere(arbre, 'ton-mode-offre')).toBeNull();
  });
});

describe('RB-3 état 3 — gérant + joueur avec un enfant : 3 positions', () => {
  it('3b · Joueur → Parent : sur place, l annonce, le mode parent posé par l hôte', async () => {
    const onChoisir = jest.fn();
    const arbre = await monter({
      actif: 'joueur', onChoisir, positions: [P.complexe, P.joueur, P.parent], prenoms: ['Léa'],
    });
    await choisir(arbre, 'Parent, 3 sur 3');
    expect(onChoisir).toHaveBeenCalledWith(P.parent);
    expect(annonces).toEqual(['Mode parent. Tu vois l’app comme un parent.']);
  });

  it('toucher la position déjà choisie ne fait rien', async () => {
    const onChoisir = jest.fn();
    const arbre = await monter({
      actif: 'joueur', onChoisir, positions: [P.complexe, P.joueur, P.parent],
    });
    await choisir(arbre, 'Joueur, 2 sur 3');
    expect(onChoisir).not.toHaveBeenCalled();
    expect(annonces).toEqual([]);
  });
});

describe('RB-3 état 4 — 4 positions : deux rangées de deux (T2 A)', () => {
  const QUATRE = [P.complexe, P.dirigeant, P.joueurDuStaff, P.parent];

  it('4a · un dirigeant : Complexe · Dirigeant / Joueur · Parent', async () => {
    const arbre = await monter({ actif: 'dirigeant', positions: QUATRE });
    expect(rangees(arbre)).toEqual([['Complexe', 'Dirigeant'], ['Joueur', 'Parent']]);
    expect(radios(arbre)).toEqual([
      'Complexe, 1 sur 4', 'Dirigeant, 2 sur 4 (coché)', 'Joueur, 3 sur 4', 'Parent, 4 sur 4',
    ]);
    expect(textes(arbre)).toContain('Tu vois l’app comme un dirigeant.');
  });

  it('4b · un coach en mode joueur, deux enfants : leurs deux prénoms', async () => {
    const arbre = await monter({
      actif: 'joueur',
      positions: [P.complexe, P.coach, P.joueurDuStaff, P.parent],
      prenoms: ['Anissa', 'Martin'],
    });
    expect(rangees(arbre)).toEqual([['Complexe', 'Coach'], ['Joueur', 'Parent']]);
    expect(textes(arbre)).toContain(
      'Tu vois l’app comme un joueur. Anissa et Martin t’attendent dans le mode parent.',
    );
  });

  it('4c · texte très agrandi : une position par rangée, rien n est coupé', async () => {
    /** @type {any} */ (useWindowDimensions).mockReturnValue({
      fontScale: 2, height: 844, scale: 3, width: 390,
    });
    const arbre = await monter({ actif: 'dirigeant', positions: QUATRE });
    const [piste] = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.props.onLayout === 'function' && typeof n.type !== 'string'
    ));
    await act(async () => {
      piste.props.onLayout({ nativeEvent: { layout: { width: 326 } } });
    });
    expect(rangees(arbre)).toEqual([['Complexe'], ['Dirigeant'], ['Joueur'], ['Parent']]);
  });

  it('un coach : « Tu vois l’app comme un coach. »', async () => {
    const arbre = await monter({
      actif: 'coach', positions: [P.complexe, P.coach, P.joueurDuStaff],
    });
    expect(textes(arbre)).toContain('Tu vois l’app comme un coach.');
  });
});

describe('RB-3 état 5 — en cours de bascule, et le lecteur d écran', () => {
  it('5a · « Complexe » : cyan, tourniquet, autres inertes, puis le changement', async () => {
    const onChoisir = jest.fn();
    const arbre = await monter({
      actif: 'joueur', onChoisir, positions: [P.complexe, P.joueur, P.parent],
    });
    act(() => {
      pressable(arbre, 'Complexe, 1 sur 3').props.onPress();
    });
    expect(radios(arbre)).toEqual([
      'Complexe, 1 sur 3 (coché)', 'Joueur, 2 sur 3 (inerte)', 'Parent, 3 sur 3 (inerte)',
    ]);
    expect(parRepere(arbre, 'ton-mode-en-cours')).not.toBeNull();
    expect(textes(arbre)).toContain('Ouverture de ton complexe…');
    expect(parRepere(arbre, 'ton-mode').props.accessibilityState).toEqual({ busy: true });
    expect(annonces).toEqual(['Ouverture de ton complexe.']);
    // Le changement d'espace part au tour suivant, une fois la position cyan peinte.
    expect(onChoisir).not.toHaveBeenCalled();
    await act(async () => {
      await new Promise((fin) => { setTimeout(fin, 0); });
    });
    expect(onChoisir).toHaveBeenCalledWith(P.complexe);

    // Pas de double appui pendant la bascule.
    await choisir(arbre, 'Parent, 3 sur 3');
    expect(onChoisir).toHaveBeenCalledTimes(1);

    // Retour sur l'accueil (le retour du téléphone) : plus rien n'est en cours.
    await act(async () => {
      mockRetours[mockRetours.length - 1]();
    });
    expect(parRepere(arbre, 'ton-mode-en-cours')).toBeNull();
  });

  it('5b · arrivée dans le complexe : « Mode complexe. Tu gères … », puis le nom', async () => {
    demanderLAnnonceDArrivee();
    const onArrivee = jest.fn();
    await monter({ actif: 'complexe', onArrivee, positions: [P.complexe, P.joueur, P.parent] });
    expect(annonces).toEqual(['Mode complexe. Tu gères Le Five de Montrivage.']);
    expect(onArrivee).toHaveBeenCalledTimes(1);

    // Un lancement de l'app directement sur le complexe, lui, n'annonce rien.
    annonces = [];
    await monter({ actif: 'complexe', onArrivee, positions: [P.complexe, P.joueur, P.parent] });
    expect(annonces).toEqual([]);
    expect(onArrivee).toHaveBeenCalledTimes(1);
  });

  it('site : l annonce passe par une zone lue sans être montrée (aria-live)', async () => {
    Platform.OS = 'web';
    const arbre = await monter({
      actif: 'joueur', positions: [P.complexe, P.joueur, P.parent],
    });
    await choisir(arbre, 'Parent, 3 sur 3');
    const zone = parRepere(arbre, 'ton-mode-annonce');
    expect(zone.props.accessibilityLiveRegion).toBe('polite');
    expect(zone.props.children).toBe('Mode parent. Tu vois l’app comme un parent.');
    expect(annonces).toEqual([]);
  });
});

describe('RB-3 — les formes du site', () => {
  it('O1 / O3 · dans un menu : les positions empilées, une par ligne', async () => {
    const arbre = await monter({
      actif: 'complexe', disposition: 'pile', positions: [P.complexe, P.joueur, P.parent],
    });
    expect(rangees(arbre)).toEqual([['Complexe'], ['Joueur'], ['Parent']]);
  });

  it('O2 · accueil sur ordinateur : une ligne, titre et phrase, puis les positions', async () => {
    const arbre = await monter({
      actif: 'joueur',
      disposition: 'ligne',
      positions: [P.complexe, P.joueur, P.parent],
      prenoms: ['Léa'],
    });
    expect(rangees(arbre)).toEqual([['Complexe', 'Joueur', 'Parent']]);
    expect(textes(arbre).slice(0, 2)).toEqual([
      'TON MODE', 'Tu vois l’app comme un joueur. Léa t’attend dans le mode parent.',
    ]);
  });
});
