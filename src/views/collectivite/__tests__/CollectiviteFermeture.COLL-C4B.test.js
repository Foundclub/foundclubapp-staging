/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  closeFacility,
  listFacilityClosures,
  modifyFacilityClosure,
  previewFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';

import CollectiviteFermeture from '../CollectiviteFermeture';

// 🚧 COLL-C4B (02/10/2026), planche 1 du design HY521H1 page 4 : « P4v3-fermer-tel » ecrans 1, 2
// et 3 — FERMER UNE INSTALLATION, BLOQUER UN CRENEAU, branche sur le contrat C2A §13 (admin).
// Le vrai fr.js ecrit les phrases ; le service HTTP est double, les requetes react-query sont les vraies.
//
// Les temoins (ROUGES avant : l ecran n existait pas) :
//   1. pendant la saisie, la carte nomme les seances touchees et les clubs prevenus ;
//   2. « Publier aussi une actualite Fermeture » est COCHEE par defaut, et se decoche ;
//   3. la confirmation redit le lieu, le jour et les clubs, avec deux boutons ;
//   4. « Fermer » envoie le bon corps ; D16 : l ecran DIT que rien n est annule ;
//   5. BLOQUER : un jour, deux heures, pour quoi ; aucune actualite ;
//   6. MODIFIER : le meme ecran, rempli, sans confirmation ni case ;
//   7. un refus du serveur se dit ; aucun nom de personne n est affiche.

// Les ecrans montes ici tournent en ~1 s ; sous la charge d une autre suite, 5 s ne suffisent pas.
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
/** @type {any[]} */
const mockDateProps = [];

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
    // FINITIONS11-COLL (03/10) : le serveur rend le type (`INSTALLATION_FIELDS` de collectivite).
    data: [
      {
        documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', type: 'Gymnase',
      },
      {
        documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal', type: 'Dojo',
      },
      {
        documentId: 'piscine', maxSlots: 1, name: 'Piscine Jean Taris', type: 'Piscine',
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
jest.mock(
  '@/components/molecules/input/Input',
  () => function InputMock(/** @type {any} */ props) {
    mockInputProps.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);

const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr'];
const PERSONNE = { email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1] };
const CARTE_VENDREDI = {
  data: {
    clubs: [
      { documentId: 'club-fc', name: 'Montrivage FC', president: PERSONNE },
      { documentId: 'club-basket', name: 'Montrivage Basket' },
    ],
    clubsCount: 2,
    sessions: [
      {
        club: { documentId: 'club-fc', name: 'Montrivage FC' },
        date: '2026-10-02',
        endTime: '19:30',
        startTime: '18:00',
        team: { name: 'Senior B' },
      },
      {
        club: { documentId: 'club-basket', name: 'Montrivage Basket' },
        date: '2026-10-02',
        endTime: '21:00',
        startTime: '19:30',
        team: { name: 'Seniors Basket' },
      },
    ],
    sessionsCount: 2,
  },
};

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
const date = (/** @type {string} */ libelle) => mockDateProps.filter((props) => props.label === libelle).pop();
const saisir = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => {
    champ(libelle).onChangeText(valeur);
  });
  await attendre();
};
const choisirDate = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => {
    date(libelle).onChange(valeur);
  });
  await attendre();
};

/** @type {any[]} */
const montes = [];
const rendre = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <CollectiviteFermeture />
      </QueryClientProvider>,
    );
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInputProps.length = 0;
  mockDateProps.length = 0;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() };
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue(CARTE_VENDREDI);
  /** @type {any} */ (closeFacility).mockResolvedValue({ data: { documentId: 'fermeture-1' } });
  /** @type {any} */ (modifyFacilityClosure).mockResolvedValue({ data: { documentId: 'fermeture-1' } });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

test('C4B-A1/1 FERMER : la carte nomme les seances touchees et les clubs prevenus, PENDANT la saisie', async () => {
  const arbre = await rendre();
  expect(textes(arbre)).toContain('Fermer une installation');
  expect(textes(arbre)).toContain('Gymnase des Tilleuls');
  expect(previewFacilityClosure).not.toHaveBeenCalled();

  await choisirDate('Du', '02/10/2026');
  expect(date('Au').value).toBe('02/10/2026');
  expect(previewFacilityClosure).toHaveBeenLastCalledWith('gym-tilleuls', {
    endDate: '2026-10-02',
    kind: 'closure',
    startDate: '2026-10-02',
  });
  const lu = textes(arbre);
  expect(lu).toContain('2 séances touchées, 2 clubs prévenus');
  expect(lu).toContain('Montrivage FC · Senior B, 18:00 – 19:30');
  expect(lu).toContain('Montrivage Basket · Seniors Basket, 19:30 – 21:00');
  expect(lu).toContain(
    'Leurs séances ne sont pas annulées : chaque club les déplace ou les annule lui-même.',
  );
  expect(JSON.stringify(lu)).not.toMatch(new RegExp(SECRETS.join('|')));
});

test('C4B-A1/2 le motif « Travaux » et la case « Publier aussi une actualite Fermeture » sont choisis par defaut', async () => {
  const arbre = await rendre();
  const travaux = parTestID(arbre, 'fermeture-motif-travaux');
  expect(travaux.props.accessibilityState).toEqual({ checked: true });
  const publier = parTestID(arbre, 'fermeture-publier');
  expect(publier.props.accessibilityRole).toBe('checkbox');
  expect(publier.props.accessibilityState).toEqual({ checked: true });
  expect(textes(arbre)).toContain('Pour tous les membres des clubs rattachés.');
  await appuyer(publier);
  expect(parTestID(arbre, 'fermeture-publier').props.accessibilityState).toEqual({ checked: false });
});

test('C4B-A1/3 la confirmation redit le lieu, le jour et les clubs ; « Fermer » envoie le bon corps, puis revient', async () => {
  const arbre = await rendre();
  await choisirDate('Du', '02/10/2026');
  await saisir('Un mot pour les clubs (facultatif)', 'Réfection du sol');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(closeFacility).not.toHaveBeenCalled();
  const lu = textes(arbre);
  // COLL-FIX2 (T10) : avec son article, comme la maquette (P4v3-fermer-tel, état 2).
  expect(lu).toContain('Fermer le Gymnase des Tilleuls le vendredi 2 octobre ?');
  expect(lu).toContain(
    'Montrivage FC et Montrivage Basket seront prévenus. Leurs séances restent à leur charge.',
  );

  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenCalledWith('gym-tilleuls', {
    endDate: '2026-10-02',
    kind: 'closure',
    message: 'Réfection du sol',
    publishActualite: true,
    reason: 'travaux',
    startDate: '2026-10-02',
  });
  expect(mockNavigation.goBack).toHaveBeenCalled();
});

test('C4B-A1/4 decochee, la case n envoie pas d actualite ; plusieurs jours : « ces jours-la »', async () => {
  const arbre = await rendre();
  await choisirDate('Du', '17/10/2026');
  await choisirDate('Au', '25/10/2026');
  await appuyer(parTestID(arbre, 'fermeture-motif-vacances'));
  await appuyer(parTestID(arbre, 'fermeture-publier'));
  // FINITIONS11-COLL (03/10, planche 25) : le type de l installation nomme le lieu.
  expect(textes(arbre)).toContain('Fermer le gymnase ces jours-là');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(textes(arbre)).toContain(
    'Fermer le Gymnase des Tilleuls du samedi 17 octobre au dimanche 25 octobre ?',
  );
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenCalledWith(
    'gym-tilleuls',
    expect.objectContaining({
      endDate: '2026-10-25',
      publishActualite: false,
      reason: 'vacances',
      startDate: '2026-10-17',
    }),
  );
});

test('C4B-A1/5 BLOQUER : un jour, deux heures, pour quoi ; ouvert depuis le planning, deja rempli', async () => {
  mockParams = {
    collectiviteId: 'ville-montrivage',
    date: '2026-10-03',
    endTime: '13:00',
    facilityId: 'gym-tilleuls',
    mode: 'bloquer',
    startTime: '09:00',
  };
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue({
    data: {
      clubs: [{ documentId: 'club-fc', name: 'Montrivage FC' }],
      clubsCount: 1,
      sessions: [
        {
          club: { name: 'Montrivage FC' },
          date: '2026-10-03',
          endTime: '12:00',
          startTime: '10:00',
          team: { name: 'Senior B' },
        },
      ],
      sessionsCount: 1,
    },
  });
  const arbre = await rendre();
  expect(textes(arbre)).toContain('Bloquer un créneau');
  expect(date('Jour').value).toBe('03/10/2026');
  expect(champ('De').value).toBe('09:00');
  expect(champ('À').value).toBe('13:00');
  expect(previewFacilityClosure).toHaveBeenLastCalledWith('gym-tilleuls', {
    endDate: '2026-10-03',
    endTime: '13:00',
    kind: 'block',
    startDate: '2026-10-03',
    startTime: '09:00',
  });
  expect(textes(arbre)).toContain('1 séance touchée, 1 club prévenu');
  expect(textes(arbre)).toContain(
    'Sa séance n’est pas annulée : le club la déplace ou l’annule lui-même.',
  );
  expect(parTestID(arbre, 'fermeture-publier')).toBeUndefined();
  expect(parTestID(arbre, 'fermeture-envoyer').props.disabled).toBe(true);

  await saisir('Pour quoi', 'Forum des associations');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(textes(arbre)).toContain(
    'Bloquer le Gymnase des Tilleuls le samedi 3 octobre, de 09:00 à 13:00 ?',
  );
  // COLL-FIX2 (T10) : UN club prévenu se dit au singulier (« AS Montrivage seront prévenus »).
  expect(textes(arbre)).toContain('Montrivage FC sera prévenu. Ses séances restent à sa charge.');
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(closeFacility).toHaveBeenCalledWith('gym-tilleuls', {
    endDate: '2026-10-03',
    endTime: '13:00',
    kind: 'block',
    label: 'Forum des associations',
    message: null,
    startDate: '2026-10-03',
    startTime: '09:00',
  });
});

test('C4B-A1/6 MODIFIER : la fermeture relue au serveur, le meme ecran rempli ; ni confirmation ni case', async () => {
  mockParams = {
    closureId: 'fermeture-1',
    collectiviteId: 'ville-montrivage',
    facilityId: 'gym-tilleuls',
  };
  /** @type {any} */ (listFacilityClosures).mockResolvedValue({
    data: [
      {
        collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
        documentId: 'fermeture-1',
        endDate: '2026-10-02',
        facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
        kind: 'closure',
        message: 'Réfection du sol',
        reason: 'travaux',
        startDate: '2026-10-02',
      },
    ],
    meta: { canManage: true },
  });
  const arbre = await rendre();
  expect(listFacilityClosures).toHaveBeenCalledWith('gym-tilleuls', { status: 'active' });
  expect(date('Du').value).toBe('02/10/2026');
  expect(champ('Un mot pour les clubs (facultatif)').value).toBe('Réfection du sol');
  expect(textes(arbre)).toContain('Modifier la fermeture');
  expect(parTestID(arbre, 'fermeture-publier')).toBeUndefined();
  expect(parTestID(arbre, 'fermeture-changer')).toBeUndefined();
  await choisirDate('Au', '03/10/2026');
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  expect(modifyFacilityClosure).toHaveBeenCalledWith('fermeture-1', {
    endDate: '2026-10-03',
    message: 'Réfection du sol',
    reason: 'travaux',
    startDate: '2026-10-02',
  });
  expect(mockNavigation.goBack).toHaveBeenCalled();
});

test('C4B-A1/7 sans installation, on la choisit ; un refus du serveur se dit, l ecran reste', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', mode: 'fermer' };
  /** @type {any} */ (closeFacility).mockRejectedValue({
    response: {
      data: { error: { details: { code: 'FACILITY_CLOSURE_MANAGER_REQUIRED' }, status: 403 } },
      status: 403,
    },
  });
  const arbre = await rendre();
  expect(textes(arbre)).toContain('Choisissez l’installation');
  await appuyer(parTestID(arbre, 'fermeture-installation-dojo'));
  expect(textes(arbre)).toContain('Dojo municipal');
  await choisirDate('Du', '02/10/2026');
  expect(previewFacilityClosure).toHaveBeenLastCalledWith(
    'dojo',
    expect.objectContaining({ startDate: '2026-10-02' }),
  );
  await appuyer(parTestID(arbre, 'fermeture-envoyer'));
  await appuyer(parTestID(arbre, 'fermeture-confirmer'));
  expect(textes(arbre)).toContain('Seule la Ville ferme ou bloque ses installations.');
  expect(mockNavigation.goBack).not.toHaveBeenCalled();
});

// 🧪 FINITIONS11-COLL (03/10), planche 25 (« P4v3-fermer-tel » ecran 1) : le bouton nomme le lieu
// par son TYPE, accorde (le / la) ; sans type connu, « l installation ». ROUGE avant le lot.
test('FIN11-COLL/1 « Fermer le gymnase ce jour-là », « Fermer la piscine ce jour-là » ; sans type, l installation', async () => {
  let arbre = await rendre();
  await choisirDate('Du', '02/10/2026');
  expect(textes(arbre)).toContain('Fermer le gymnase ce jour-là');

  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'piscine', mode: 'fermer' };
  arbre = await rendre();
  await choisirDate('Du', '02/10/2026');
  expect(textes(arbre)).toContain('Fermer la piscine ce jour-là');

  mockParams = {
    collectiviteId: 'ville-montrivage', facilityId: 'ailleurs', facilityName: 'Halle des sports', mode: 'fermer',
  };
  arbre = await rendre();
  await choisirDate('Du', '02/10/2026');
  expect(textes(arbre)).toContain('Fermer l’installation ce jour-là');
});
