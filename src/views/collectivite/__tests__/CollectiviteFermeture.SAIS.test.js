/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  closeFacility,
  listFacilityClosures,
  modifyFacilityClosure,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';

import CollectiviteFermeture, { PanneauDeFermeture } from '../CollectiviteFermeture';

// ✍️ SAIS (08/10/2026, tournée T20 lot 2 « ERREURS-DE-SAISIE ») — FERMER et BLOQUER au téléphone :
//   1. une seule phrase « La fin doit suivre le début. » (celle d « Attribuer »), posée SOUS les
//      champs qu elle juge — elle tombait sous « Nom » (Fermer) et sous « Pour quoi » (Bloquer) ;
//   2. Bloquer : « Pour quoi » (texte libre) devient les pastilles « Motif » de Fermer + « Nom » ;
//   3. un bouton grise dit ce qui manque ;
//   4. Retour sur une saisie modifiee : « Quitter sans enregistrer ? » (la garde de « Demander »).
// Le vrai fr.js ecrit les phrases ; les champs doubles s affichent « «Libelle» » pour lire l ordre.

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockParams;
/** @type {any[]} */
const mockInputProps = [];
/** @type {Record<string, (evenement: any) => void>} */
const mockEcouteurs = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [
      {
        documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', type: 'Gymnase',
      },
      {
        documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
      },
    ],
  }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);
jest.mock(
  '@/components/atoms/loader/Loader',
  () => function LoaderMock() {
    return null;
  },
);
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: props.testID },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
// Chaque champ double s ecrit « «Libelle» » : l ordre des textes dit OU tombe une phrase.
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    mockInputProps.push(props);
    return reactActuel.createElement(TexteRN, null, `«${props.label}»`);
  };
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function TimePickerInputMock(/** @type {any} */ props) {
    mockInputProps.push({ ...props, onChangeText: props.onChange });
    return reactActuel.createElement(TexteRN, null, `«${props.label}»`);
  };
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function DatePickerInputMock(/** @type {any} */ props) {
    mockInputProps.push({ ...props, onChangeText: props.onChange });
    return reactActuel.createElement(TexteRN, null, `«${props.label}»`);
  };
});
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);

const AUCUNE_SEANCE = {
  data: {
    clubs: [], clubsCount: 0, sessions: [], sessionsCount: 0,
  },
};
const ORDRE = 'La fin doit suivre le début.';

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.testID === id);
const attendre = async () => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => {
    noeud.props.onPress();
  });
  await attendre();
};
const champ = (/** @type {string} */ libelle) => mockInputProps.filter((props) => props.label === libelle).pop();
const saisir = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => {
    champ(libelle).onChangeText(valeur);
  });
  await attendre();
};
// Un Retour joue sur l ecran : `retenir` dit s il a ete retenu.
const retour = async () => {
  const retenir = jest.fn();
  await act(async () => {
    mockEcouteurs.beforeRemove?.({ data: { action: { type: 'GO_BACK' } }, preventDefault: retenir });
  });
  return retenir;
};

/** @type {any[]} */
const montes = [];
const rendre = async (/** @type {any} */ element = <CollectiviteFermeture />) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInputProps.length = 0;
  Object.keys(mockEcouteurs).forEach((cle) => { delete mockEcouteurs[cle]; });
  mockNavigation = {
    addListener: jest.fn((/** @type {string} */ nom, /** @type {(e: any) => void} */ ecouteur) => {
      mockEcouteurs[nom] = ecouteur;
      return () => {};
    }),
    dispatch: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
    setOptions: jest.fn(),
  };
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue(AUCUNE_SEANCE);
  /** @type {any} */ (closeFacility).mockResolvedValue({ data: { documentId: 'fermeture-1' } });
  /** @type {any} */ (modifyFacilityClosure).mockResolvedValue({ data: { documentId: 'fermeture-1' } });
});

afterEach(() => {
  jest.restoreAllMocks();
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

test('SAIS-2/1 FERMER : « Au » avant « Du » ⇒ « La fin doit suivre le début. » juste SOUS les dates, avant « Motif »', async () => {
  const arbre = await rendre();
  await saisir('Du', '10/10/2030');
  await saisir('Au', '05/10/2030');
  const lu = textes(arbre);
  expect(lu).not.toContain('La fin suit le début.');
  expect(lu).toContain(ORDRE);
  expect(lu.indexOf('«Au»')).toBeLessThan(lu.indexOf(ORDRE));
  expect(lu.indexOf(ORDRE)).toBeLessThan(lu.indexOf('Motif'));
  // CRFERM (planche P4v4) : le nom est replié derrière ce lien, sous le motif.
  expect(lu.indexOf(ORDRE)).toBeLessThan(lu.indexOf('Ajouter un nom ou un mot pour les clubs'));
});

test('SAIS-2/2 BLOQUER : « À » avant « De » ⇒ la MÊME phrase, juste SOUS les heures', async () => {
  mockParams = {
    collectiviteId: 'ville-montrivage', date: '2030-10-03', endTime: '09:00', facilityId: 'gym-tilleuls', mode: 'bloquer', startTime: '13:00',
  };
  const arbre = await rendre();
  const lu = textes(arbre);
  expect(lu).not.toContain('L’heure de fin suit l’heure de début.');
  expect(lu).toContain(ORDRE);
  expect(lu.indexOf('«À»')).toBeLessThan(lu.indexOf(ORDRE));
  expect(lu.indexOf(ORDRE)).toBeLessThan(lu.indexOf('Motif'));
});

test('SAIS-2/3 BLOQUER : « Pour quoi » devient les pastilles « Motif » de Fermer et un « Nom » ; le motif seul part comme nom', async () => {
  mockParams = {
    collectiviteId: 'ville-montrivage', date: '2030-10-03', endTime: '13:00', facilityId: 'gym-tilleuls', mode: 'bloquer', startTime: '09:00',
  };
  let arbre = await rendre();
  expect(champ('Pour quoi')).toBeUndefined();
  await appuyer(parTestID(arbre, 'fermeture-deplier')); // CRFERM : nom et mot repliés
  expect(champ('Nom (facultatif)')).toBeDefined();
  expect(champ('Nom (facultatif)').placeholder).toBe('Forum des associations');
  // Aucun motif n est choisi a la place de la Ville : le bouton attend.
  expect(parTestID(arbre, 'fermeture-motif-manifestation').props.accessibilityState).toEqual({ checked: false });
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(true);
  await appuyer(parTestID(arbre, 'fermeture-motif-manifestation'));
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(false);
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenLastCalledWith('gym-tilleuls', {
    endDate: '2030-10-03',
    endTime: '13:00',
    kind: 'block',
    label: 'Manifestation',
    message: null,
    reason: 'manifestation',
    startDate: '2030-10-03',
    startTime: '09:00',
  });

  mockInputProps.length = 0;
  arbre = await rendre();
  await appuyer(parTestID(arbre, 'fermeture-motif-manifestation'));
  await appuyer(parTestID(arbre, 'fermeture-deplier'));
  await saisir('Nom (facultatif)', ' Forum des associations ');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenLastCalledWith('gym-tilleuls', expect.objectContaining({
    kind: 'block', label: 'Forum des associations', reason: 'manifestation',
  }));
});

test('SAIS-2/4 un blocage d AVANT (un nom, aucun motif) se modifie tel quel', async () => {
  mockParams = { closureId: 'blocage-1', collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' };
  /** @type {any} */ (listFacilityClosures).mockResolvedValue({
    data: [{
      collectivite: { documentId: 'ville-montrivage' },
      documentId: 'blocage-1',
      endDate: '2030-10-03',
      endTime: '13:00:00.000',
      facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
      kind: 'block',
      label: 'Forum',
      reason: null,
      startDate: '2030-10-03',
      startTime: '09:00:00.000',
    }],
    meta: { canManage: true },
  });
  const arbre = await rendre();
  expect(champ('Nom (facultatif)').value).toBe('Forum');
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(false);
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(modifyFacilityClosure).toHaveBeenCalledWith('blocage-1', expect.objectContaining({
    endTime: '13:00', label: 'Forum', reason: null, startTime: '09:00',
  }));
});

test('SAIS-2/5 un bouton grisé dit ce qui manque, dans l ordre de l écran', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'bloquer' };
  let arbre = await rendre();
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(true);
  expect(textes(arbre)).toContain('Choisissez le jour.');
  await saisir('Jour', '03/10/2030');
  expect(textes(arbre)).toContain('Choisissez les heures.');
  await saisir('De', '09:00');
  await saisir('À', '13:00');
  expect(textes(arbre)).toContain('Choisissez un motif.');
  await appuyer(parTestID(arbre, 'fermeture-motif-autre'));
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(false);
  expect(textes(arbre).filter((ligne) => ligne.startsWith('Choisissez'))).toEqual([]);

  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  arbre = await rendre();
  expect(textes(arbre)).toContain('Choisissez les dates.');

  // CRFERM (planche P4v4, état 1) : sans installation, une seule question, pas de bouton grisé.
  mockParams = { collectiviteId: 'ville-montrivage', mode: 'fermer' };
  arbre = await rendre();
  expect(textes(arbre)).toContain('Quelle installation fermez-vous ?');
  expect(textes(arbre)).not.toContain('Choisissez l’installation.');
  expect(parTestID(arbre, 'fermeture-envoyer')).toBeUndefined();

  // Une erreur dite ne se double pas d un « Choisissez ».
  mockParams = {
    collectiviteId: 'ville-montrivage', date: '2030-10-03', endTime: '09:00', facilityId: 'gym-tilleuls', mode: 'bloquer', startTime: '13:00',
  };
  arbre = await rendre();
  expect(textes(arbre).filter((ligne) => ligne.startsWith('Choisissez'))).toEqual([]);
});

test('SAIS-2/6 Retour : libre sans saisie ; une saisie modifiée demande « Quitter sans enregistrer ? » ; « Quitter » sort', async () => {
  const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const arbre = await rendre();
  expect(await retour()).not.toHaveBeenCalled();

  await saisir('Du', '10/10/2030');
  const retenu = await retour();
  expect(retenu).toHaveBeenCalled();
  expect(alerte).toHaveBeenCalledWith(
    'Quitter sans enregistrer ?',
    'Ce que vous avez saisi sera perdu.',
    expect.any(Array),
  );
  const boutons = /** @type {any[]} */ (alerte.mock.calls.at(-1)?.[2]);
  expect(boutons.map((bouton) => bouton.text)).toEqual(['Rester', 'Quitter']);
  await act(async () => { boutons[1].onPress(); });
  expect(mockNavigation.dispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
  expect(arbre).toBeDefined();
});

test('SAIS-2/7 une fermeture ENVOYÉE sort sans question (le remplacement par la fiche n est pas retenu)', async () => {
  const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  /** @type {jest.Mock[]} */
  const retenues = [];
  // Comme la vraie navigation : remplacer l ecran le retire, donc emet `beforeRemove`.
  mockNavigation.replace = jest.fn(() => {
    const retenir = jest.fn();
    retenues.push(retenir);
    mockEcouteurs.beforeRemove?.({ data: { action: { type: 'REPLACE' } }, preventDefault: retenir });
  });
  const arbre = await rendre();
  await saisir('Du', '10/10/2030');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenCalled();
  expect(mockNavigation.replace).toHaveBeenCalled();
  expect(retenues[0]).not.toHaveBeenCalled();
  expect(alerte).not.toHaveBeenCalled();
});

// SAIS lot 1 (T20) — une date vide le dit (captures T04a, T06a : boîtes VIDES) ; la Ville vouvoie.
// CRFERM (13/10, planche P4v4 et COL-008) : « Choisissez un jour » passait sur deux lignes ; la date
// vide attend « Choisir », court, sur une ligne.
test('SAIS-1/ville une date vide dit « Choisir » (Fermer : Du, Au ; Bloquer : Jour)', async () => {
  await rendre();
  expect(champ('Du').placeholder).toBe('Choisir');
  expect(champ('Au').placeholder).toBe('Choisir');
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'bloquer' };
  await rendre();
  expect(champ('Jour').placeholder).toBe('Choisir');
});

test('SAIS-2/8 dans le panneau d ordinateur, aucune garde : le planning a sa croix', async () => {
  await rendre(
    <PanneauDeFermeture
      collectiviteId="ville-montrivage"
      facilityId="gym-tilleuls"
      mode="fermer"
      onCancel={jest.fn()}
      onDone={jest.fn()}
    />,
  );
  await saisir('Du', '10/10/2030');
  expect(mockNavigation.addListener).not.toHaveBeenCalledWith('beforeRemove', expect.anything());
});
