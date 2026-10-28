/* eslint-disable max-len -- des phrases entières, comparées telles quelles */
import { format } from 'date-fns';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { createReccurrentEventPayload } from '@/domains/event/eventUseCases';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardLogistics from '../EventWizardLogistics';

// 🗓️ DATESDABORD (25/10/2026, décision d'Adel « 6- B ») — LE LIEU D'ABORD, LE MESSAGE À LA DATE :
// l'installation est choisie à l'étape « Lieu » ; à l'étape « Date & horaire », CHAQUE horaire
// touché relit la place de cette installation et dit « Ce créneau est libre. » ou « Attention, ce
// créneau est déjà pris : tu vas devoir envoyer une demande à <gestionnaire> pour faire <le type>.
// … ». Une fermeture de la Ville bloque « Suivant ». Le vrai i18next (fr.js).
// ROUGE avant : l'étape « Date & horaire » ne lisait aucune place.

/** @type {any[]} */
const mockFenetres = [];
/** @type {any[]} */
const mockGabarits = [];
/** @type {any[]} */
const mockHeures = [];
let mockPlace = (/** @type {any} */ fenetre) => ({ data: { blocked: false, saturated: false }, fenetre });
let mockVille = /** @type {any[]} */ ([]);
let mockVacances = /** @type {any} */ (null);
let mockDecision = {
  complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
};

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetClubVilleFacilitiesWithSlots: (/** @type {any} */ club) => ({ data: club ? mockVille : [] }),
  useGetFacilityHolidays: (/** @type {any} */ installation, /** @type {any} */ periode) => ({
    data: installation && periode ? mockVacances : null,
  }),
  useGetFacilityOccupancy: (/** @type {any} */ installation, /** @type {any} */ fenetre) => {
    if (installation) mockFenetres.push({ installation, ...fenetre });
    return {
      data: installation && fenetre?.start ? { data: mockPlace(fenetre).data } : undefined,
      isError: false,
      isFetching: false,
      isLoading: false,
      refetch: () => {},
    };
  },
}));
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => mockDecision,
}));
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
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
      Images: { chevronDown: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DateMock() {
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function HeureMock(
  /** @type {any} */ props,
) {
  mockHeures.push(props);
  return null;
});
jest.mock('@/components/molecules/dayPicker/DayPicker', () => function JoursMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => function BoutonMock() { return null; });

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

const textesSous = (/** @type {any} */ noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

const EQUIPE = {
  club: { documentId: 'club-A', name: 'AS Montrivage', parentMultisport: { documentId: 'cm-1', name: 'Montrivage Omnisports' } },
  documentId: 'u13',
  name: 'U13',
};
const LIBRE = 'Ce créneau est libre.';
const PRIS = 'Attention, ce créneau est déjà pris : tu vas devoir envoyer une demande à AS Montrivage pour faire ton entraînement. Elle partira quand tu créeras l’événement.';
/** @type {any} */
let arbre;
let semer = (/** @type {any} */ action) => action;
/** @type {any} */
let etatDuTunnel = null;
/**
 * Sonde : le `dispatch` du tunnel, pour semer l'équipe, le type et le lieu.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const tunnel = useEventWizard();
  semer = tunnel.dispatch;
  etatDuTunnel = tunnel.state;
  return null;
}
const afficherLEcran = (/** @type {any} */ lieu = { facility: 'gym', location: null }) => {
  mockFenetres.length = 0;
  mockGabarits.length = 0;
  mockHeures.length = 0;
  const navigation = { goBack: () => {}, navigate: () => {}, setParams: () => {} };
  const rendre = (/** @type {any} */ contenu) => createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu);
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { team: EQUIPE, type: { name: 'Entraînement' } }, type: 'SET_META' }));
  act(() => semer({ payload: lieu, type: 'SET_LOCATION' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardLogistics, { navigation, route: { params: {} } })));
  });
};
const dernierGabarit = () => mockGabarits[mockGabarits.length - 1];
const debut = () => mockHeures.filter((p) => /début/i.test(String(p.label))).at(-1);

afterEach(() => {
  mockVacances = null;
  mockVille = [];
  mockPlace = () => ({ data: { blocked: false, saturated: false } });
  mockDecision = {
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  };
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('DATESDABORD 6- B — « Date & horaire » prévient à chaque horaire, pour l installation choisie', () => {
  test('l installation du club, libre : « Ce créneau est libre. » sous les heures', () => {
    afficherLEcran();
    expect(textesSous(arbre.root)).toContain(LIBRE);
    expect(mockFenetres.at(-1).installation).toBe('gym');
  });

  test('chaque horaire touché relit la place : 18:00 est pris, la phrase le dit et nomme le club et le type', () => {
    mockPlace = (fenetre) => ({
      data: new Date(fenetre.start).getHours() === 18
        ? { blocked: false, requiresApproval: true, saturated: true }
        : { blocked: false, saturated: false },
    });
    afficherLEcran();
    act(() => debut().onChange('18:00'));
    expect(new Date(mockFenetres.at(-1).start).getHours()).toBe(18);
    expect(textesSous(arbre.root)).toContain(PRIS);
    expect(textesSous(arbre.root)).not.toContain(LIBRE);
    act(() => debut().onChange('10:00'));
    expect(textesSous(arbre.root)).toContain(LIBRE);
  });

  test('une installation partagée du club multisport : la demande va au club multisport', () => {
    mockPlace = () => ({ data: { blocked: false, requiresApproval: true, saturated: true } });
    afficherLEcran({ facility: 'gym-cm', facilityShared: true, location: null });
    expect(textesSous(arbre.root).join(' ')).toContain('envoyer une demande à Montrivage Omnisports pour faire ton entraînement');
  });

  test('une fermeture de la Ville : la phrase de la fermeture, et « Suivant » attend', () => {
    mockPlace = () => ({ data: { blocked: true, closure: null, facility: { name: 'Gymnase des Tilleuls' } } });
    afficherLEcran();
    expect(dernierGabarit().isNextDisabled).toBe(true);
    expect(textesSous(arbre.root)).not.toContain(LIBRE);
  });

  test('la mairie décidera : sa phrase, ni « libre » ni « pris »', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran({ facility: 'gym-ville', location: null });
    const textes = textesSous(arbre.root).join(' ');
    expect(textes).toContain('la mairie décidera');
    expect(textes).not.toContain(LIBRE);
    expect(textes).not.toContain('déjà pris');
  });

  // DATESDABORD (26/10, reco b du chef) — sur un gymnase de la Ville, les deux phrases que l'étape
  // « Lieu » disait quand la date venait avant. ROUGE avant : l'étape date ne les disait pas.
  test('un gymnase de la Ville, dans le créneau du club : « Dans ton créneau … »', () => {
    // Un créneau du club chaque jour, toute la journée : la séance tombe dedans, quel que soit le jour.
    mockVille = [{
      clubSeasonSlots: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        documentId: `cr-${weekday}`, endTime: '23:59', startTime: '00:00', validFrom: '2026-01-01', validUntil: '2099-06-30', weekday,
      })),
      documentId: 'gym-ville',
      isVilleSlot: true,
    }];
    mockDecision = {
      complet: false, deLaVille: true, mairie: false, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran({ facility: 'gym-ville', location: null });
    expect(textesSous(arbre.root).join(' ')).toMatch(/^.*Dans ton créneau .* : la séance est validée directement\./);
  });

  test('un gymnase de la Ville, hors des créneaux du club : « Hors de tes créneaux de la Ville à cette heure. »', () => {
    mockVille = [{ clubSeasonSlots: [], documentId: 'gym-ville', isVilleSlot: true }];
    mockDecision = {
      complet: false, deLaVille: true, mairie: false, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    afficherLEcran({ facility: 'gym-ville', location: null });
    expect(textesSous(arbre.root)).toContain('Hors de tes créneaux de la Ville à cette heure.');
  });

  // 🗓️ DATESDABORD (26/10, Adel : « sauf vacances » sur la récurrence) — la case dans « Répéter »,
  // quand la zone de l'installation est connue (le planning, `meta.holidays`) ; « Suivant » la passe
  // au tunnel avec ses périodes, et la série se déplie sans elles (DATESDABORD.serie-sauf-vacances).
  // ROUGE avant : aucune case pour un événement.
  test('chaque semaine, zone connue : « Sauf vacances scolaires » se coche et part avec ses périodes', () => {
    mockVacances = {
      label: 'Zone B',
      periods: [{
        end: '2026-11-01', key: '2026-2027:toussaint', name: 'Toussaint', start: '2026-10-17',
      }],
      zone: 'B',
    };
    afficherLEcran();
    act(() => arbre.root.findByProps({ testID: 'date-et-horaire-chaque-semaine' }).props.onPress());
    const laCase = () => arbre.root.findByProps({ testID: 'date-et-horaire-sauf-vacances' });
    expect(laCase().props.accessibilityState).toEqual({ checked: false });
    act(() => laCase().props.onPress());
    expect(laCase().props.accessibilityState).toEqual({ checked: true });
    expect(String(arbre.root.findByProps({ testID: 'date-et-horaire-resume' }).props.children))
      .toMatch(/, sauf vacances scolaires$/);
    act(() => dernierGabarit().onNext());
    expect(etatDuTunnel.exceptHolidays).toBe(true);
    expect(etatDuTunnel.holidayPeriods).toHaveLength(1);
  });

  // 🌴 VACCLUB (27/10, Adel « 1- B ») — le TERRAIN D'UN CLUB : le serveur rend la zone de la commune
  // du club (`meta.holidays`, VACCLUB-1 côté admin) ; la même case apparaît, et la série dépliée
  // n'a pas les séances des vacances. L'app ne fait aucune différence avec la Ville : le ROUGE de ce
  // lot est côté serveur (le planning du terrain du club rendait `holidays: null`).
  test('le terrain du club, commune connue (Caen, zone B) : la case apparaît et la série la respecte', () => {
    mockVacances = {
      label: 'Zone B',
      periods: [{
        end: '2026-11-01', key: '2026-2027:toussaint', name: 'Toussaint', start: '2026-10-17',
      }],
      zone: 'B',
    };
    afficherLEcran({ facility: 'terrain-du-club', location: null });
    expect(mockFenetres.at(-1).installation).toBe('terrain-du-club');
    act(() => arbre.root.findByProps({ testID: 'date-et-horaire-chaque-semaine' }).props.onPress());
    act(() => arbre.root.findByProps({ testID: 'date-et-horaire-sauf-vacances' }).props.onPress());
    act(() => dernierGabarit().onNext());
    expect(etatDuTunnel.exceptHolidays).toBe(true);
    const seances = createReccurrentEventPayload({
      capacity: 10,
      date: '08/10/2026',
      endTime: '21:00',
      exceptHolidays: etatDuTunnel.exceptHolidays,
      holidayPeriods: etatDuTunnel.holidayPeriods,
      isRecurrent: true,
      recurrenceDays: [4],
      recurrenceEndDate: '12/11/2026',
      recurrenceFrequency: 'week',
      recurrenceInterval: 1,
      recurrenceStartDate: '08/10/2026',
      sessionStatus: 'closed',
      startTime: '19:30',
      time: '19:30',
    }).map((seance) => format(new Date(seance.date), 'yyyy-MM-dd'));
    expect(seances).toEqual(['2026-10-08', '2026-10-15', '2026-11-05', '2026-11-12']);
  });

  test('zone inconnue (club sans commune connue) : pas de case, rien ne part', () => {
    afficherLEcran();
    act(() => arbre.root.findByProps({ testID: 'date-et-horaire-chaque-semaine' }).props.onPress());
    expect(arbre.root.findAllByProps({ testID: 'date-et-horaire-sauf-vacances' })).toHaveLength(0);
    act(() => dernierGabarit().onNext());
    expect(etatDuTunnel.exceptHolidays).toBe(false);
  });

  test('une adresse extérieure : rien à juger, aucune lecture', () => {
    afficherLEcran({ facility: null, location: { label: '12 rue des Lilas', value: 'x' } });
    expect(mockFenetres).toHaveLength(0);
    expect(textesSous(arbre.root)).not.toContain(LIBRE);
    expect(dernierGabarit().isNextDisabled).not.toBe(true);
  });
});
