/* eslint-disable max-len -- des phrases entieres de la liste, comparees telles quelles */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { normalizePlanningItems } from '@/utils/planning/planningSlots';

import FacilityPlanningList from '../FacilityPlanningList';

// CRDEP2 (22/10/2026, COL-013 point 5) — la vue « Liste » du planning d une installation dit, sur
// un bloc touche par une fermeture, la MEME chose que la grille (PlanningWeekTimelineViewV2) :
//   - un creneau de SAISON (aucune seance posee) « n a pas lieu » ;
//   - une seance dont la Ville a propose une place : « proposition envoyee » ;
//   - une seance sans proposition : « a deplacer ».
// ROUGE sur staging d908c1ce : la Liste ecrit « a deplacer » sur les trois.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs), Spaces: espaces }),
  };
});

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

// La semaine du lundi 5 octobre 2026.
const LUNDI = new Date(2026, 9, 5);
const bloc = (/** @type {any} */ champs) => ({
  closure: null,
  club: { documentId: 'club-A', name: 'Montrivage FC' },
  documentId: null,
  facility: { documentId: 'gym-ville', name: 'Gymnase des Tilleuls' },
  hasExplicitTime: true,
  kind: 'slot',
  team: { name: 'Senior B' },
  title: 'Montrivage FC · Senior B',
  ...champs,
});
// Vendredi 9, 18:00 - 19:30, touchee par la fermeture du jour.
const TOUCHE = {
  closure: { documentId: 'f1', kind: 'closure' },
  endAt: '2026-10-09T17:30:00.000Z',
  endTime: '19:30:00.000',
  startAt: '2026-10-09T16:00:00.000Z',
  startTime: '18:00:00.000',
};
// Le creneau de saison, tel que le planning de l installation le rend (planning-slot.ts:1189).
const CRENEAU = bloc({ ...TOUCHE, origin: 'slot' });
const SEANCE = bloc({
  ...TOUCHE, documentId: 'seance-1', kind: 'event', team: { name: 'U15' }, title: 'Montrivage FC · U15',
});
const PROPOSEE = bloc({
  ...TOUCHE,
  documentId: 'seance-2',
  kind: 'event',
  relocationProposal: { documentId: 'prop-1', status: 'pending' },
  team: { name: 'U17' },
  title: 'Montrivage FC · U17',
});

/** @type {any[]} */
const arbresMontes = [];
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
});
const ligneDe = (/** @type {any} */ arbre, /** @type {string} */ texte) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.accessible === true)
  .find((/** @type {any} */ n) => n.findAllByType(Text).some((/** @type {any} */ e) => e.props.children === texte));
const textesDe = (/** @type {any} */ ligne) => ligne.findAllByType(Text)
  .map((/** @type {any} */ n) => n.props.children);

it('creneau « n a pas lieu », proposition « proposition envoyee », seance « a deplacer »', async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <FacilityPlanningList
        capacite={3}
        debutDeSemaine={LUNDI}
        evenements={normalizePlanningItems([CRENEAU, SEANCE, PROPOSEE])}
        fermeture="22:00"
        ouverture="08:00"
      />,
    );
  });
  arbresMontes.push(arbre);
  expect(textesDe(ligneDe(arbre, 'Montrivage FC · Senior B'))).toContain('n’a pas lieu');
  expect(textesDe(ligneDe(arbre, 'Montrivage FC · U17'))).toContain('proposition envoyée');
  expect(textesDe(ligneDe(arbre, 'Montrivage FC · U15'))).toContain('à déplacer');
  expect(textesDe(ligneDe(arbre, 'Montrivage FC · Senior B'))).not.toContain('à déplacer');
});
