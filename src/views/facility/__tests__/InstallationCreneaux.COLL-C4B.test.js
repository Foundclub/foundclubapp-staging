/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  listFacilityClosures,
  reopenFacilityClosure,
} from '@/services/facilityClosure/facilityClosureService';
import {
  attributeSeasonSlot,
  getClubTeamsForSlot,
  getSeasonSlot,
  listFacilitySeasonSlots,
  modifySeasonSlot,
  previewFacilitySeasonSlot,
  restoreSeasonSlot,
  withdrawSeasonSlot,
} from '@/services/seasonSlot/seasonSlotService';

import InstallationCreneaux from '../InstallationCreneaux';

// 🚧 COLL-C4B (02/10/2026), planche 1 du design HY521H1 page 4 : « P4v3-fermer-tel » ecran 6 —
// L ONGLET « FERMETURES » D UNE INSTALLATION DE LA VILLE : chaque fermeture ou blocage, ce qu il
// touche, « Modifier » et « Rouvrir » (le seul moyen de defaire le geste). Harnais repris du temoin
// C2B (memes doublures), plus celle du service des fermetures.
// Les temoins (ROUGES avant : l onglet n existait pas) :
//   1. la liste : pastille, jours, heures, clubs prevenus, mot de la Ville ;
//   2. Modifier, « Fermer l installation », « Bloquer un creneau » ouvrent le formulaire ;
//   3. Rouvrir demande une confirmation, puis rouvre ;
//   4. un membre (canManage faux) lit, sans aucun geste.

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
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockDateProps = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' } }),
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

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));

jest.mock('@/services/seasonSlot/seasonSlotService', () => ({
  attributeSeasonSlot: jest.fn(),
  getClubTeamsForSlot: jest.fn(),
  getSeasonSlot: jest.fn(),
  listFacilitySeasonSlots: jest.fn(),
  modifySeasonSlot: jest.fn(),
  previewFacilitySeasonSlot: jest.fn(),
  restoreSeasonSlot: jest.fn(),
  withdrawSeasonSlot: jest.fn(),
}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));

/** @type {any} */
let mockClubs;
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteClubs: (/** @type {any} */ id) => (id ? mockClubs : { data: undefined }),
  useCollectiviteInstallations: () => ({
    data: [{
      closingTime: '22:00:00.000',
      documentId: 'gym-tilleuls',
      maxSlots: 2,
      name: 'Gymnase des Tilleuls',
      openingTime: '08:00:00.000',
      type: 'Gymnase',
    }],
  }),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/emptyState/EmptyState', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function EmptyStateMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      VueRN,
      null,
      reactActuel.createElement(TexteRN, null, props.title),
      reactActuel.createElement(TexteRN, null, props.description),
      props.actionLabel ? reactActuel.createElement(
        PressableRN,
        { onPress: props.onAction },
        reactActuel.createElement(TexteRN, null, props.actionLabel),
      ) : null,
    );
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => function DatePickerInputMock(/** @type {any} */ props) {
    mockDateProps.push(props);
    return null;
  },
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
    return reactActuel.createElement(VueRN, null, (options || []).map(
      (/** @type {any} */ option) => reactActuel.createElement(
        PressableRN,
        { key: option.value, onPress: () => onChange(option.value) },
        reactActuel.createElement(TexteRN, null, option.label),
      ),
    ));
  };
});

// Des secrets SEMES la ou le serveur ne doit rien mettre : s ils s affichent, la mairie lirait
// une personne. Le contrat dit que `attributedBy` ne sort par aucune route ; l ecran ne doit
// de toute facon jamais afficher un champ de personne.
const SECRETS = ['Jeanne', 'SECRET-NOM', 'jeanne.secret@exemple.fr', '0611223344'];
const PERSONNE = {
  email: SECRETS[2], firstname: SECRETS[0], lastname: SECRETS[1], phone: SECRETS[3],
};
const creneau = (/** @type {any} */ champs) => ({
  attributedAt: '2026-09-01T08:00:00.000Z',
  attributedBy: PERSONNE,
  club: { documentId: 'club-as', name: 'AS Montrivage', president: PERSONNE },
  facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' },
  plateau: null,
  previous: null,
  source: 'attribution',
  status: 'active',
  team: { documentId: 'team-u15', name: 'U15', trainers: [PERSONNE] },
  validFrom: '2026-09-01',
  validUntil: '2027-06-30',
  withdrawnAt: null,
  withdrawnFrom: null,
  ...champs,
});
const CRENEAUX = [
  creneau({
    documentId: 'mar-u15', endTime: '19:00', startTime: '17:30', weekday: 2,
  }),
  creneau({
    documentId: 'jeu-u15', endTime: '19:30', startTime: '18:00', weekday: 4,
  }),
  creneau({
    club: { documentId: 'club-fc', name: 'Montrivage FC' },
    documentId: 'jeu-sb',
    endTime: '19:30',
    startTime: '18:00',
    team: { documentId: 'team-sb', name: 'Senior B' },
    weekday: 4,
  }),
];
const META = (/** @type {any} */ champs = {}) => ({
  canManage: true,
  facility: {
    documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls', plateaux: [],
  },
  season: { validFrom: '2026-09-01', validUntil: '2027-06-30' },
  ...champs,
});
const RETIRE = creneau({
  documentId: 'lun-retire',
  endTime: '19:30',
  startTime: '18:00',
  status: 'withdrawn',
  team: { documentId: 'team-u17', name: 'U17' },
  weekday: 1,
  withdrawnFrom: '2026-10-05',
});

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle))
  .pop();
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => { noeud.props.onPress(); });
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
        <InstallationCreneaux />
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
  mockNavigation = { navigate: jest.fn(), setOptions: jest.fn() };
  mockClubs = {
    data: [
      { documentId: 'club-as', email: 'contact@as.fr', name: 'AS Montrivage' },
      { documentId: 'club-fc', name: 'Montrivage FC' },
    ],
  };
  /** @type {any} */ (listFacilitySeasonSlots).mockImplementation(
    (/** @type {string} */ _id, /** @type {any} */ { status }) => Promise.resolve(
      status === 'withdrawn'
        ? { data: [RETIRE], meta: META() }
        : { data: CRENEAUX, meta: META() },
    ),
  );
  /** @type {any} */ (getClubTeamsForSlot).mockResolvedValue([
    { documentId: 'team-u13', name: 'U13' }, { documentId: 'team-u15', name: 'U15' },
  ]);
  /** @type {any} */ (previewFacilitySeasonSlot).mockResolvedValue({
    data: {
      capacity: 2,
      needsConfirmation: false,
      next: {
        club: { name: 'Montrivage FC', secretary: PERSONNE },
        startTime: '19:00',
        team: { name: 'Senior B' },
      },
      occupants: [],
      overCapacity: false,
      peak: 0,
      plateau: null,
      remaining: 2,
      teamsAfter: 1,
    },
  });
  /** @type {any} */ (attributeSeasonSlot).mockResolvedValue({ data: { documentId: 'neuf' } });
  /** @type {any} */ (getSeasonSlot).mockResolvedValue({
    data: { ...CRENEAUX[0], sessionsCount: 7 }, meta: { canManage: true },
  });
  /** @type {any} */ (withdrawSeasonSlot).mockResolvedValue({ data: { status: 'withdrawn' } });
  /** @type {any} */ (restoreSeasonSlot).mockResolvedValue({ data: { status: 'active' } });
  /** @type {any} */ (modifySeasonSlot).mockResolvedValue({ data: {}, meta: { split: false } });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

const FERMETURE = {
  documentId: 'f1',
  endDate: '2026-10-02',
  endTime: null,
  kind: 'closure',
  label: null,
  message: 'Réfection du sol',
  notifiedClubsCount: 2,
  reason: 'travaux',
  startDate: '2026-10-02',
  startTime: null,
  status: 'active',
};
const BLOCAGE = {
  documentId: 'f2',
  endDate: '2026-10-03',
  endTime: '13:00',
  kind: 'block',
  label: 'Forum des associations',
  message: null,
  notifiedClubsCount: 1,
  reason: null,
  startDate: '2026-10-03',
  startTime: '09:00',
  status: 'active',
};
const fermetures = (/** @type {boolean} */ canManage) => {
  /** @type {any} */ (listFacilityClosures).mockResolvedValue({
    data: [FERMETURE, BLOCAGE],
    meta: { bandeau: null, canManage, facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' } },
  });
};

describe('COLL-C4B planche 1 — l onglet « Fermetures »', () => {
  it('1. chaque fermeture : pastille, jours, heures, clubs prevenus, mot de la Ville', async () => {
    fermetures(true);
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    expect(listFacilityClosures).toHaveBeenCalledWith('gym-tilleuls', { status: 'active' });
    const lus = textes(arbre);
    expect(lus).toContain('Fermeture · travaux');
    expect(lus).toContain('ven. 2 oct.');
    expect(lus).toContain('Toute la journée · 2 clubs prévenus');
    expect(lus).toContain('« Réfection du sol »');
    expect(lus).toContain('Blocage · Ville');
    expect(lus).toContain('sam. 3 oct.');
    expect(lus).toContain('09:00 – 13:00 · Forum des associations · 1 club prévenu');
    expect(lus).toContain('Rouvrir prévient les mêmes clubs.');
  });

  it('2. Modifier, « Fermer l installation » et « Bloquer un creneau » ouvrent le formulaire', async () => {
    fermetures(true);
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    await appuyer(parTexte(arbre, 'Fermer l’installation'));
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteFermeture', {
      collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', facilityName: 'Gymnase des Tilleuls', mode: 'fermer',
    });
    await appuyer(parTexte(arbre, 'Bloquer un créneau'));
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteFermeture', {
      collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', facilityName: 'Gymnase des Tilleuls', mode: 'bloquer',
    });
    const modifier = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
        .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === 'Modifier'));
    expect(modifier).toHaveLength(2);
    await appuyer(modifier[0]);
    expect(mockNavigation.navigate).toHaveBeenLastCalledWith('CollectiviteFermeture', {
      closureId: 'f1', collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', facilityName: 'Gymnase des Tilleuls',
    });
  });

  it('3. Rouvrir demande une confirmation, puis rouvre (un etat, jamais une suppression)', async () => {
    fermetures(true);
    /** @type {any} */ (reopenFacilityClosure).mockResolvedValue({ data: { ...FERMETURE, status: 'reopened' } });
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    const rouvrir = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
        .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === 'Rouvrir'));
    await appuyer(rouvrir[0]);
    expect(reopenFacilityClosure).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Rouvrir ? Les mêmes clubs seront prévenus.');
    const oui = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
        .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === 'Rouvrir'));
    await appuyer(oui[0]);
    expect(reopenFacilityClosure).toHaveBeenCalledWith('f1');
  });

  it('4. un membre (canManage faux) lit les fermetures, sans aucun geste', async () => {
    fermetures(false);
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    const lus = textes(arbre);
    expect(lus).toContain('Fermeture · travaux');
    expect(lus).toContain('Toute la journée');
    expect(lus).not.toContain('Modifier');
    expect(lus).not.toContain('Rouvrir');
    expect(lus).not.toContain('Fermer l’installation');
    expect(lus.join(' ')).not.toMatch(/prévenu/);
  });

  it('5. la fiche porte un bandeau tant que la fermeture dure ou approche (planche 4)', async () => {
    /** @type {any} */ (listFacilityClosures).mockResolvedValue({
      data: [FERMETURE],
      meta: { bandeau: FERMETURE, canManage: true, facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' } },
    });
    const lus = textes(await rendre());
    // FINITIONS11-COLL (03/10, planche 25) : le type de l installation nomme le lieu.
    expect(lus).toContain('Le gymnase est fermé le vendredi 2 octobre');
    expect(lus).toContain('Travaux. Mot de la Ville : « Réfection du sol ».');
  });

  it('6. rien ne dure ni n approche : aucun bandeau', async () => {
    fermetures(true);
    const lus = textes(await rendre());
    expect(lus.join(' ')).not.toMatch(/est fermée/);
  });
});

// 🎨 VILLE-T18A (07/10, tournée T18 point 3, G57b) — l onglet « Fermetures » : la date d un blocage
// s affichait « jeu. 8 » (« oct. » perdu : la boîte épousait sa largeur mesurée, piège Android 16) ;
// et « Rouvrir ? Les mêmes clubs seront prévenus. » sur un blocage qui n avait prévenu AUCUN club.
describe('VILLE-T18A (3) la carte d une fermeture : sa date entière, « Rouvrir » sans club', () => {
  it('la date s étire jusqu au bord droit (elle ne se coupe plus)', async () => {
    fermetures(true);
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    const date = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim() === 'sam. 3 oct.');
    const style = jest.requireActual('react-native').StyleSheet.flatten(date.props.style);
    expect(style).toEqual(expect.objectContaining({ flexGrow: 1, textAlign: 'right' }));
  });

  it('un blocage qui n a prévenu aucun club : « Rouvrir ? Aucun club n’est à prévenir. »', async () => {
    /** @type {any} */ (listFacilityClosures).mockResolvedValue({
      data: [{ ...BLOCAGE, notifiedClubsCount: 0 }],
      meta: { bandeau: null, canManage: true, facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' } },
    });
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    const rouvrir = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
        .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === 'Rouvrir'));
    await appuyer(rouvrir[0]);
    const lus = textes(arbre);
    expect(lus).toContain('Rouvrir ? Aucun club n’est à prévenir.');
    expect(lus).not.toContain('Rouvrir ? Les mêmes clubs seront prévenus.');
  });

  it('FINITIONS-VILLE (T20) : aucun club prévenu nulle part ⇒ pas de pied « Rouvrir prévient les mêmes clubs. »', async () => {
    /** @type {any} */ (listFacilityClosures).mockResolvedValue({
      data: [{ ...FERMETURE, notifiedClubsCount: 0 }],
      meta: { bandeau: null, canManage: true, facility: { documentId: 'gym-tilleuls', name: 'Gymnase des Tilleuls' } },
    });
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Fermetures'));
    const lus = textes(arbre);
    expect(lus).toContain('Toute la journée · Aucun club prévenu');
    expect(lus).not.toContain('Rouvrir prévient les mêmes clubs.');
  });
});
