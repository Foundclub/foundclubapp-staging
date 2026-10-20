/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { clubSlotParts } from '@/domains/seasonSlot/clubInstallations';
import { formeEnMots } from '@/domains/seasonSlot/seasonSlotWhen';

import SeasonSlotWeekGrid from '../SeasonSlotWeekGrid';

// 🌴 R17-QUAND-2 (REC17-007 Q3, planches P11-quand-ou-ca-vit 1-3 et P11-quand-v2-ordi A, validées
// par Adel le 19/10) — « SAUF VACANCES » SE LIT LÀ OÙ LA VILLE ET LE CLUB REGARDENT DÉJÀ : la fiche
// d'un club (« chaque semaine, sauf vacances »), « Tes créneaux de la Ville », la semaine type
// (pastille « sauf vacances »). ROUGE avant : la forme ne disait rien des vacances.

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});
const t = (/** @type {any[]} */ ...args) => (i18nextTemoin.default || i18nextTemoin).t(...args);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
});

const SAISON = { validFrom: '2026-09-01', validUntil: '2027-06-30' };
const CHAQUE = {
  club: { documentId: 'fc', name: 'Montrivage FC' }, documentId: 'chaque', endTime: '19:00', startTime: '17:30', team: { name: 'Senior B' }, weekday: 2, ...SAISON,
};
const UN_SUR_DEUX = {
  anchorDate: '2026-10-21', club: { documentId: 'as', name: 'AS Montrivage' }, documentId: 'deux', endTime: '19:00', everyWeeks: 2, recurrence: 'weekly', startTime: '17:30', team: { name: 'U13' }, weekday: 3, ...SAISON,
};
const TROIS_DATES = {
  club: { documentId: 'bk', name: 'Montrivage Basket' }, dates: ['2026-11-07', '2026-11-17', '2026-11-25'], documentId: 'dates', endTime: '19:00', recurrence: 'dates', startTime: '17:30', team: { name: 'U17' }, validFrom: '2026-11-07', validUntil: '2026-11-25', weekday: null,
};

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
});
const monter = (/** @type {any} */ element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  montes.push(arbre);
  return arbre;
};
const texte = (/** @type {any} */ n) => [].concat(n.props.children).join('');
const lus = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text).map(texte);
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id);

const SAUF = {
  ...CHAQUE, documentId: 'sauf', exceptHolidays: true, holidayDates: ['2026-10-20'],
};
const DEUX_SAUF = { ...UN_SUR_DEUX, exceptHolidays: true, holidayDates: [] };

describe('R17Q2 — « sauf vacances » se lit', () => {
  it('la forme en mots : courte et longue', () => {
    expect(formeEnMots(t, SAUF, { court: true })).toBe('chaque semaine, sauf vacances');
    expect(formeEnMots(t, SAUF)).toBe('chaque mardi, sauf vacances');
    expect(formeEnMots(t, DEUX_SAUF)).toBe('un mercredi sur deux, sauf vacances');
    expect(formeEnMots(t, TROIS_DATES)).toBe('sam. 7 nov. · mar. 17 nov. · mer. 25 nov.');
    expect(formeEnMots(t, CHAQUE)).toBe('chaque mardi');
  });

  it('« Tes créneaux de la Ville » : la ligne le dit', () => {
    const morceaux = clubSlotParts(SAUF, t);
    expect(t('clubInstallations.creneau.ligne', { hours: morceaux.hours, rythme: morceaux.rythme, team: morceaux.team }))
      .toBe('Senior B · chaque mardi, sauf vacances 17:30 – 19:00');
  });

  it('la semaine type : la pastille « sauf vacances », sans hachures (le créneau revient chaque semaine)', () => {
    const arbre = monter(<SeasonSlotWeekGrid capacite={2} creneaux={[SAUF, UN_SUR_DEUX]} onCreneau={jest.fn()} />);
    const [cadre] = parTestID(arbre, 'semaine-type-cadre');
    act(() => { cadre.props.onLayout({ nativeEvent: { layout: { height: 400, width: 1000 } } }); });
    expect(lus(arbre)).toEqual(expect.arrayContaining(['sauf vacances', '1 sem. sur 2']));
    expect(parTestID(arbre, 'hachures-sauf')).toHaveLength(0);
    expect(parTestID(arbre, 'creneau-sauf')[0].props.accessibilityLabel).toBe('Montrivage FC · Senior B, chaque mardi, sauf vacances 17:30 – 19:00');
  });
});
