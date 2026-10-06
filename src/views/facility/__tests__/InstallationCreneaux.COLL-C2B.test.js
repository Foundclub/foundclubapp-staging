import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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

// 📐 COLL-C2B (02/10/2026), planche 3 du design HY521H1 : « P4v2-creneaux-tel » et
// « P4v2-creneaux-ordi » — L ONGLET « CRENEAUX » D UNE INSTALLATION DE LA VILLE, branche sur
// le contrat C2A (admin docs/CONTRAT_CRENEAUX_SAISON.md). Le vrai fr.js ecrit les phrases ;
// le service HTTP est double, les requetes react-query sont les vraies.
//
// Les temoins attendus par le prompt du lot (ROUGES avant : l ecran n existait pas) :
//   1. l onglet Creneaux liste ce que rend §4.1 (jour par jour, « complet » nomme) ;
//   2. « Attribuer » envoie le bon corps, et affiche la place libre de §4.2 PENDANT la saisie ;
//   3. un 409 de capacite ouvre « Attribuer quand meme » (confirmOverCapacity) ;
//   4. Retirer affiche la phrase D67 ; Retablir rappelle §4.7 (et son 409) ;
//   5. le champ Plateau n existe que si `plateaux` est non vide ;
//   6. un membre non gestionnaire n a AUCUN geste d ecriture ;
//   7. aucun nom de personne dans ce qui est affiche a la mairie (secrets semes).

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
// COLL-C4B (02/10) : l ecran a gagne l onglet « Fermetures » ; son service est double ici aussi
// (sans doublure, le client HTTP charge sans .env fait echouer la suite dans une copie de travail).
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  listFacilityClosures: jest.fn(() => Promise.resolve({ data: [], meta: {} })),
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
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity).find((/** @type {any} */ noeud) => noeud.props.testID === id);
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};
const appuyer = async (/** @type {any} */ noeud) => {
  if (!noeud) throw new Error('rien a toucher');
  await act(async () => { noeud.props.onPress(); });
  await attendre();
};
const champ = (/** @type {string} */ libelle) => mockInputProps
  .filter((props) => props.label === libelle).pop();
const saisir = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => { champ(libelle).onChangeText(valeur); });
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

describe('COLL-C2B planche 3 — 1. l onglet Creneaux liste ce que rend §4.1', () => {
  it('la saison, puis jour par jour : club · equipe, heures, le moment complet', async () => {
    const lus = textes(await rendre());
    expect(listFacilitySeasonSlots).toHaveBeenCalledWith('gym-tilleuls', { status: 'active' });
    expect(lus).toContain('Gymnase des Tilleuls');
    expect(lus).toContain('Gymnase · 2 équipes à la fois · 08:00 – 22:00');
    expect(lus).toContain('Saison 2026-2027');
    expect(lus).toContain('du 1 sept. au 30 juin');
    expect(lus).toContain('Mardi');
    expect(lus).toContain('Jeudi · complet 18:00 – 19:30');
    expect(lus.filter((texte) => texte === 'AS Montrivage · U15')).toHaveLength(2);
    expect(lus).toContain('Montrivage FC · Senior B');
    expect(lus).toContain('17:30 – 19:00');
    expect(lus.indexOf('Mardi')).toBeLessThan(lus.indexOf('Jeudi · complet 18:00 – 19:30'));
    expect(mockNavigation.setOptions).toHaveBeenCalledWith({ headerTitle: '' });
  });

  it('aucun creneau : on dit ce qu est un creneau, et « Attribuer le premier »', async () => {
    /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({ data: [], meta: META() });
    const arbre = await rendre();
    expect(textes(arbre)).toContain('Aucun créneau attribué');
    expect(parTexte(arbre, 'Attribuer le premier')).toBeDefined();
  });

  it('l onglet « Planning » ouvre le planning de l installation', async () => {
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Planning'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('PlanningWeekFullscreen', {
      contextDetailLabel: 'Gymnase des Tilleuls',
      facilityId: 'gym-tilleuls',
      // FINITIONS16 18 : le site garde le menu de la Ville sur ce planning.
      espace: 'ville',
      sourceType: 'facility',
    });
  });
});

describe('COLL-C2B planche 3 — 2. et 3. attribuer, avec la place libre, et le 409', () => {
  const remplir = async (/** @type {any} */ arbre) => {
    await appuyer(parTexte(arbre, 'Attribuer un créneau'));
    await appuyer(parTexte(arbre, 'AS Montrivage'));
    await appuyer(parTexte(arbre, 'U13'));
    await appuyer(parTestID(arbre, 'jour-3'));
    await saisir('Début', '17:30');
    await saisir('Fin', '19:00');
  };

  it('la carte « place libre » se lit pendant la saisie, et le bon corps part', async () => {
    const arbre = await rendre();
    await remplir(arbre);

    expect(previewFacilitySeasonSlot).toHaveBeenLastCalledWith('gym-tilleuls', {
      endTime: '19:00', excludeSlot: undefined, plateau: undefined, startTime: '17:30', weekday: 3,
    });
    const lus = textes(arbre);
    expect(lus).toContain('Mercredi 17:30 – 19:00 : place libre');
    expect(lus).toContain('Personne n’y est.');
    expect(lus).toContain('Montrivage FC · Senior B arrive à 19:00.');
    expect(lus).toContain('AS Montrivage sera prévenu, et verra ce créneau dans son planning.');

    await appuyer(parTexte(arbre, 'Attribuer le créneau'));
    expect(attributeSeasonSlot).toHaveBeenCalledWith('gym-tilleuls', {
      club: 'club-as', endTime: '19:00', startTime: '17:30', team: 'team-u13', weekday: 3,
    });
  });

  it('un 409 de capacite : rien n est ecrit, puis « Attribuer quand meme »', async () => {
    /** @type {any} */ (attributeSeasonSlot)
      .mockRejectedValueOnce({
        details: {
          code: 'SEASON_SLOT_OVER_CAPACITY',
          preview: {
            capacity: 2,
            needsConfirmation: true,
            occupants: [
              { club: { name: 'AS Montrivage' }, team: { name: 'U15' } },
              { club: { name: 'Montrivage FC' }, team: { name: 'Senior B' } },
            ],
            overCapacity: true,
            peak: 2,
            teamsAfter: 3,
          },
        },
        status: 409,
      })
      .mockResolvedValueOnce({ data: { documentId: 'neuf' } });
    const arbre = await rendre();
    await remplir(arbre);
    await appuyer(parTexte(arbre, 'Attribuer le créneau'));

    const lus = textes(arbre);
    expect(lus).toContain('Mercredi 17:30 – 19:00 : complet');
    expect(lus).toContain('Déjà là : AS Montrivage · U15, Montrivage FC · Senior B.');
    expect(lus).toContain('Attribuer met 3 équipes pour 2 places, chaque mercredi de la saison.');
    expect(parTexte(arbre, 'Changer l’heure')).toBeDefined();

    await appuyer(parTexte(arbre, 'Attribuer quand même'));
    expect(attributeSeasonSlot).toHaveBeenLastCalledWith('gym-tilleuls', {
      club: 'club-as',
      confirmOverCapacity: true,
      endTime: '19:00',
      startTime: '17:30',
      team: 'team-u13',
      weekday: 3,
    });
  });
});

describe('COLL-C2B planche 3 — 4. gerer, modifier, retirer (D67), retablir (§4.7)', () => {
  it('gerer : la periode, les entrainements poses, puis Modifier et Retirer', async () => {
    const arbre = await rendre();
    await appuyer(parTestID(arbre, 'creneau-mar-u15'));
    expect(getSeasonSlot).toHaveBeenCalledWith('mar-u15');
    const lus = textes(arbre);
    expect(lus).toContain('Chaque mardi, 17:30 – 19:00 · Gymnase des Tilleuls');
    expect(lus).toContain('1 sept. 2026 – 30 juin 2027');
    expect(lus).toContain('7 cette saison');
    expect(parTexte(arbre, 'Modifier le créneau')).toBeDefined();
  });

  it('retirer dit la phrase D67, et part sans toucher aux seances', async () => {
    const arbre = await rendre();
    await appuyer(parTestID(arbre, 'creneau-mar-u15'));
    await appuyer(parTexte(arbre, 'Retirer le créneau'));
    const lus = textes(arbre);
    expect(lus).toContain('Retirer le créneau du mardi ?');
    expect(lus).toContain(
      'Ses entraînements déjà posés sur ce créneau restent : le club les garde ou les '
        + 'annule lui-même.',
    );
    expect(lus).toContain('Une erreur ? Vous pourrez rétablir le créneau depuis la liste.');
    expect(lus).toContain('Le club est prévenu.');

    await appuyer(parTexte(arbre, 'Retirer le créneau'));
    // COLL-C2B-BIS (03/10) — le retrait part avec SA date (« À partir du », aujourd hui par défaut ;
    // témoin dédié : SeasonSlotManage.COLL-C2B-BIS.retrait.test.js). Avant : `{}`, le même jour.
    expect(withdrawSeasonSlot).toHaveBeenCalledWith('mar-u15', {
      effectiveFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('modifier : « a partir du », le meme formulaire, PUT sur le creneau', async () => {
    const arbre = await rendre();
    await appuyer(parTestID(arbre, 'creneau-mar-u15'));
    await appuyer(parTexte(arbre, 'Modifier le créneau'));
    expect(textes(arbre)).toContain('Modifier le créneau');
    expect(champ('Début').value).toBe('17:30');
    await act(async () => { mockDateProps[mockDateProps.length - 1].onChange('13/10/2026'); });
    await saisir('Début', '18:30');
    await saisir('Fin', '20:00');
    await appuyer(parTexte(arbre, 'Enregistrer'));
    expect(modifySeasonSlot).toHaveBeenCalledWith('mar-u15', {
      effectiveFrom: '2026-10-13', endTime: '20:00', startTime: '18:30', weekday: 2,
    });
  });

  it('les creneaux retires se retablissent ; un 409 propose « Retablir quand meme »', async () => {
    /** @type {any} */ (restoreSeasonSlot)
      .mockRejectedValueOnce({
        details: { code: 'SEASON_SLOT_OVER_CAPACITY', preview: { capacity: 2, teamsAfter: 3 } },
        status: 409,
      })
      .mockResolvedValueOnce({ data: { status: 'active' } });
    const arbre = await rendre();
    expect(listFacilitySeasonSlots).toHaveBeenCalledWith('gym-tilleuls', { status: 'withdrawn' });
    const lus = textes(arbre);
    expect(lus).toContain('Créneaux retirés');
    expect(lus).toContain('Lundi 18:00 – 19:30 · retiré à partir du lun. 5 oct.');

    await appuyer(parTexte(arbre, 'Rétablir'));
    expect(restoreSeasonSlot).toHaveBeenCalledWith('lun-retire', {});
    expect(textes(arbre)).toContain('Le rétablir met 3 équipes pour 2 places.');
    await appuyer(parTexte(arbre, 'Rétablir quand même'));
    expect(restoreSeasonSlot).toHaveBeenLastCalledWith('lun-retire', { confirmOverCapacity: true });
  });
});

describe('COLL-C2B planche 3 — 5. le champ Plateau, seulement avec des plateaux nommes', () => {
  it('sans plateaux : aucun champ « Plateau »', async () => {
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Attribuer un créneau'));
    expect(textes(arbre)).not.toContain('Plateau');
    expect(textes(arbre)).not.toContain('Indifférent');
  });

  it('avec des plateaux : « Indifferent » par defaut, le numero du plateau part', async () => {
    /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
      data: CRENEAUX,
      meta: META({
        facility: {
          documentId: 'gym-tilleuls',
          maxSlots: 2,
          name: 'Gymnase des Tilleuls',
          plateaux: ['Plateau A', 'Plateau B'],
        },
      }),
    });
    const arbre = await rendre();
    await appuyer(parTexte(arbre, 'Attribuer un créneau'));
    expect(textes(arbre)).toContain('Plateau');
    expect(textes(arbre)).toContain('Indifférent');
    await appuyer(parTexte(arbre, 'AS Montrivage'));
    await appuyer(parTestID(arbre, 'jour-3'));
    await saisir('Début', '17:30');
    await saisir('Fin', '19:00');
    await appuyer(parTexte(arbre, 'Plateau A'));
    await appuyer(parTexte(arbre, 'Attribuer le créneau'));
    expect(attributeSeasonSlot).toHaveBeenLastCalledWith('gym-tilleuls', expect.objectContaining({
      plateau: 1,
    }));
  });
});

describe('COLL-C2B planche 3 — 6. un membre non gestionnaire n a AUCUN geste d ecriture', () => {
  it('ni Attribuer, ni Modifier, ni Retirer, ni la liste des retires', async () => {
    /** @type {any} */ (listFacilitySeasonSlots).mockResolvedValue({
      data: CRENEAUX, meta: META({ canManage: false }),
    });
    /** @type {any} */ (getSeasonSlot).mockResolvedValue({
      data: { ...CRENEAUX[0], sessionsCount: 7 }, meta: { canManage: false },
    });
    const arbre = await rendre();
    expect(parTexte(arbre, 'Attribuer un créneau')).toBeUndefined();
    expect(listFacilitySeasonSlots)
      .not.toHaveBeenCalledWith('gym-tilleuls', { status: 'withdrawn' });
    expect(textes(arbre)).not.toContain('Créneaux retirés');
    await appuyer(parTestID(arbre, 'creneau-mar-u15'));
    expect(parTexte(arbre, 'Modifier le créneau')).toBeUndefined();
    expect(parTexte(arbre, 'Retirer le créneau')).toBeUndefined();
  });
});

describe('COLL-C2B planche 3 — 7. aucun nom de personne a la mairie', () => {
  it('liste, fiche d un creneau, place libre : aucun secret seme ne s affiche', async () => {
    const arbre = await rendre();
    const vus = [...textes(arbre)];
    await appuyer(parTestID(arbre, 'creneau-jeu-sb'));
    vus.push(...textes(arbre));
    await appuyer(parTexte(arbre, 'Fermer'));
    await appuyer(parTexte(arbre, 'Attribuer un créneau'));
    await appuyer(parTexte(arbre, 'AS Montrivage'));
    await appuyer(parTestID(arbre, 'jour-3'));
    await saisir('Début', '17:30');
    await saisir('Fin', '19:00');
    vus.push(...textes(arbre));
    const lu = vus.join(' | ');
    SECRETS.forEach((secret) => expect(lu).not.toContain(secret));
  });
});

// 🗓️ FINITIONS12-COLL (03/10) — point 8 : un créneau RETIRÉ « à partir du 1er juin » disparaissait
// déjà de la liste active (tournée T11, C23). Le serveur le garde désormais dans les actifs jusqu'à
// la veille, avec `effectiveUntil` ; la ligne écrit SA fin. ROUGE avant le lot.
describe('FINITIONS12-COLL point 8 — retiré plus tard : listé jusque-là, avec sa fin', () => {
  it('retiré à partir du 1er juin : « 17:30 – 19:00 · du 1 sept. au 31 mai »', async () => {
    /** @type {any} */ (listFacilitySeasonSlots).mockImplementation(
      (/** @type {string} */ _id, /** @type {any} */ { status }) => Promise.resolve(
        status === 'withdrawn'
          ? { data: [RETIRE], meta: META() }
          : {
            data: [creneau({
              documentId: 'mar-u15',
              effectiveUntil: '2027-05-31',
              endTime: '19:00',
              startTime: '17:30',
              status: 'withdrawn',
              weekday: 2,
              withdrawnFrom: '2027-06-01',
            })],
            meta: META(),
          },
      ),
    );
    const lus = textes(await rendre());
    expect(lus).toContain('17:30 – 19:00 · du 1 sept. au 31 mai');
  });
});
