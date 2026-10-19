/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { clubSlotParts } from '@/domains/seasonSlot/clubInstallations';
import { formeEnMots } from '@/domains/seasonSlot/seasonSlotWhen';

import SeasonSlotDatesBand from '../SeasonSlotDatesBand';
import SeasonSlotWeekGrid from '../SeasonSlotWeekGrid';

// 🧪 R17-QUAND-1, point 6 (REC17-007, planches P10-quand-ordi, P11-quand-v2-ordi, P11-quand-ou-ca-vit
// validées par Adel le 19/10) — LA FORME SE LIT LÀ OÙ LA VILLE ET LE CLUB REGARDENT DÉJÀ :
//   - la semaine type : un créneau qui ne revient pas chaque semaine est HACHURÉ et dit sa forme
//     (« 1 sem. sur 2 ») ; un créneau à des dates choisies n'a pas de colonne ;
//   - la bande « Dates choisies, hors semaine type », sous la grille (au téléphone : le groupe) ;
//   - « Tes créneaux de la Ville » : « U13 · un mercredi sur deux 17:30 – 19:00 », plus « chaque ».
// ROUGE avant : rien de cela n'existait (`formeEnMots`, la bande, les hachures).

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

describe('R17Q1-6 — la forme en mots', () => {
  it('courte (pastilles) et longue (lignes)', () => {
    expect([CHAQUE, UN_SUR_DEUX, TROIS_DATES].map((c) => formeEnMots(t, c, { court: true }))).toEqual(['chaque semaine', '1 sem. sur 2', '3 dates']);
    expect([CHAQUE, UN_SUR_DEUX, TROIS_DATES].map((c) => formeEnMots(t, c))).toEqual(['chaque mardi', 'un mercredi sur deux', 'sam. 7 nov. · mar. 17 nov. · mer. 25 nov.']);
  });

  it('« Tes créneaux de la Ville » : la ligne dit la forme', () => {
    const ligne = (/** @type {any} */ creneau) => {
      const morceaux = clubSlotParts(creneau, t);
      return t('clubInstallations.creneau.ligne', { hours: morceaux.hours, rythme: morceaux.rythme, team: morceaux.team });
    };
    expect(ligne(CHAQUE)).toBe('Senior B · chaque mardi 17:30 – 19:00');
    expect(ligne(UN_SUR_DEUX)).toBe('U13 · un mercredi sur deux 17:30 – 19:00');
    expect(ligne(TROIS_DATES)).toBe('U17 · sam. 7 nov. · mar. 17 nov. · mer. 25 nov. 17:30 – 19:00');
  });
});

describe('R17Q1-6 — la semaine type et la bande des dates choisies', () => {
  it('« 1 sem. sur 2 » hachuré ; « chaque semaine » plein ; les dates choisies sans colonne', () => {
    const arbre = monter(<SeasonSlotWeekGrid capacite={2} creneaux={[CHAQUE, UN_SUR_DEUX, TROIS_DATES]} onCreneau={jest.fn()} />);
    const [cadre] = parTestID(arbre, 'semaine-type-cadre');
    act(() => { cadre.props.onLayout({ nativeEvent: { layout: { height: 400, width: 1000 } } }); });
    expect(parTestID(arbre, 'hachures-deux').length).toBeGreaterThan(0);
    expect(parTestID(arbre, 'hachures-chaque')).toHaveLength(0);
    expect(lus(arbre)).toContain('1 sem. sur 2');
    expect(parTestID(arbre, 'creneau-dates')).toHaveLength(0);
    const deux = parTestID(arbre, 'creneau-deux')[0];
    expect(deux.props.accessibilityLabel).toBe('AS Montrivage · U13, un mercredi sur deux 17:30 – 19:00');
  });

  it('la bande « Dates choisies, hors semaine type » : qui, quand, combien ; rien sans dates choisies', () => {
    const onCreneau = jest.fn();
    const arbre = monter(<SeasonSlotDatesBand creneaux={[CHAQUE, UN_SUR_DEUX, TROIS_DATES]} onCreneau={onCreneau} />);
    expect(lus(arbre)).toEqual(expect.arrayContaining([
      'Dates choisies, hors semaine type',
      '1 créneau',
      'Montrivage Basket · U17 · 17:30 – 19:00',
      'sam. 7 nov. · mar. 17 nov. · mer. 25 nov.',
      '3 dates',
    ]));
    act(() => { parTestID(arbre, 'bande-dates-dates')[0].props.onPress(); });
    expect(onCreneau).toHaveBeenCalledWith(TROIS_DATES);
    const vide = monter(<SeasonSlotDatesBand creneaux={[CHAQUE, UN_SUR_DEUX]} onCreneau={jest.fn()} />);
    expect(vide.toJSON()).toBeNull();
  });
});
