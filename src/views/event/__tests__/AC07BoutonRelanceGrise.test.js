import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import { REMIND_EVENT_MUTATION_KEY } from '@/domains/event/remindReport';

import Button from '@/components/atoms/button/Button';

import EventParticipants from '../components/EventParticipants';

// AC07 (E6) — TEMOIN 4 : « LE BOUTON EST GRISE PENDANT L ENVOI ».
//
// 🧨 POURQUOI CA COMPTE ICI PLUS QU AILLEURS : le bouton « Relancer » declenche
// un envoi de notifications a de vraies personnes, et l anti-spam de 48 h fait
// que le SECOND appui ne partira pas. Un bouton qui reste actif pendant l envoi
// invite donc a un geste qui ne peut qu echouer — et jusqu a ce lot, cet echec
// s affichait comme un succes.
//
// 🔬 LA COUTURE CHOISIE : la prop `isLoading` du `Button` (qui, dans
// `Button.js`, coupe `onPress` ET grise le fond). On ne mesure pas une couleur :
// on mesure que le bouton est rendu inactif tant que la mutation est en vol.
//
// ⚠️ L etat vient d une `mutationKey`, PAS d une prop : `EventDetails.js` est
// gele (AC08 et AC10 y travaillent) et ne pouvait donc rien faire descendre.
// Effet de bord voulu : les DEUX boutons « Relancer » de cet ecran se grisent
// ensemble, puisqu ils declenchent le meme envoi.

// 🧨 D5-b — CE MOCK EST UNE CONDITION DE DEMARRAGE, PAS UN CONFORT.
// Depuis P2, `EventParticipants` importe `licenseQueries`. Le VRAI module
// descend jusqu a `client.native.js`, qui jette AU CHARGEMENT quand `.env` est
// absent — et `.env` est gitignore, donc absent de toute copie de travail.
// Sans ce mock, la suite entiere ne demarre pas : « failed to run », 0 test
// execute. Un compteur de tests VERT ne le verrait meme pas.
jest.mock('@/services/license/licenseQueries', () => ({
  useLicenseAssignments: () => ({ data: undefined, isLoading: false }),
}));

// 🧨 R7-d — CONDITION DE DEMARRAGE, PAS UN CONFORT (meme motif que le mock
// `licenseQueries` ci-dessus). Depuis R7-d, `EventParticipants` monte
// `useAttendanceCallMutations` pour ecrire le pointage « A l heure ». Le vrai
// `eventService` descend jusqu a `client.native.js`, qui jette AU CHARGEMENT
// quand `.env` est absent — et `.env` est gitignore, donc absent de toute
// copie de travail. Sans ce mock : « failed to run », 0 test execute.
jest.mock('@/services/event/eventService', () => ({
  markCoachArrival: jest.fn(),
  markCoachArrivalBulk: jest.fn(),
  resetCoachAttendance: jest.fn(),
  updateCoachLateMinutes: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ key) => key }),
}));

// Le theme est monte avec les VRAIS modules : un Proxy rend les echecs Jest
// illisibles (piege paye au lot paywall). Seul Images est stube, pour ne pas
// dependre de la resolution des assets.
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});

const JOUEUR_SANS_REPONSE = {
  documentId: 'joueur-1',
  firstname: 'Kylian',
  id: 21,
  lastname: 'M',
};

const PROPS = {
  attendanceByUserId: {},
  canEdit: true,
  event: { documentId: 'evt-1' },
  eventStartAt: null,
  handleExportParticipants: jest.fn(),
  handleRemindPlayers: jest.fn(),
  handleShare: jest.fn(),
  handleUpdateParticipation: jest.fn(),
  handleUserPress: jest.fn(),
  nowMs: Date.parse('2026-08-20T18:00:00.000Z'),
  onCoachEditLate: jest.fn(),
  onCoachMarkArrival: jest.fn(),
  participantsSummary: { missing: 0, notAnswered: 1, participating: 0 },
  participationsByStatus: {
    missing: [],
    notAnswered: [JOUEUR_SANS_REPONSE],
    participating: [],
  },
  pendingParticipations: [],
  teamParticipationSections: [],
};

/**
 * Une relance qu on tient EN VOL le temps de la mesure, puis qu on laisse
 * atterrir.
 *
 * 🧹 Le point important est le `poser` : une promesse jamais tenue empeche jest
 * de rendre la main a la fin de la suite. On la denoue avant de demonter.
 * @param {{ poignee: object }} props - La poignee, RECUE EN PROP.
 * @returns {null} - Rien a rendre.
 */
function RelanceEnVol({ poignee }) {
  const mutation = useMutation({
    mutationFn: () => new Promise((resoudre) => {
      // eslint-disable-next-line no-param-reassign -- la poignee est justement le sujet
      poignee.poser = () => resoudre({ remindedCount: 0 });
    }),
    mutationKey: REMIND_EVENT_MUTATION_KEY,
  });
  // eslint-disable-next-line no-param-reassign -- la poignee est justement le sujet
  poignee.demarrer = () => mutation.mutate('evt-1');
  return null;
}

/**
 * Lit la prop `isLoading` des boutons « Relancer » de l ecran.
 * @param {any} arbre - L arbre rendu.
 * @returns {boolean[]} - Un booleen par bouton « Relancer » trouve.
 */
const lireLesBoutonsRelancer = (arbre) => arbre.root
  .findAllByType(Button)
  .filter((/** @type {any} */ noeud) => noeud.props.title === 'eventDetails.actions.remind')
  .map((/** @type {any} */ noeud) => Boolean(noeud.props.isLoading));

/**
 * Attend que TOUS les boutons « Relancer » soient dans l etat voulu.
 * La relance atterrit en plusieurs tours de boucle selon la charge de la
 * machine : parier sur un seul tick rend le temoin instable.
 * @param {any} arbre - L arbre rendu.
 * @param {boolean} attendu - L etat `isLoading` attendu.
 * @returns {Promise<void>} - Rend la main des que l etat est atteint.
 */
const attendreLesBoutons = async (arbre, attendu) => {
  for (let tour = 0; tour < 30; tour += 1) {
    const etats = lireLesBoutonsRelancer(arbre);
    if (etats.length > 0 && etats.every((estGrise) => estGrise === attendu)) return;
    // eslint-disable-next-line no-await-in-loop -- on laisse le rendu se poser, tour par tour
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

describe('AC07/4 — le bouton est grise pendant l envoi', () => {
  test('actif au repos, grise pendant la relance', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    /** @type {{ demarrer: null | (() => void), poser: null | (() => void) }} */
    const poignee = { demarrer: null, poser: null };
    /** @type {any} */
    let arbre;

    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={queryClient}>
          <RelanceEnVol poignee={poignee} />
          {/* eslint-disable-next-line react/jsx-props-no-spreading -- l ecran a 19 props ; les etaler ici noierait le sujet du temoin */}
          <EventParticipants {...PROPS} />
        </QueryClientProvider>,
      );
    });

    // 1. Au repos : le bouton existe et il est ACTIF.
    const auRepos = lireLesBoutonsRelancer(arbre);
    expect(auRepos.length).toBeGreaterThan(0);
    expect(auRepos.every((estGrise) => estGrise === false)).toBe(true);

    // 2. Relance en vol : il est grise.
    await act(async () => { poignee.demarrer(); });
    await attendreLesBoutons(arbre, true);

    const pendantLEnvoi = lireLesBoutonsRelancer(arbre);
    expect(pendantLEnvoi.length).toBe(auRepos.length);
    expect(pendantLEnvoi.every((estGrise) => estGrise === true)).toBe(true);

    // 3. On laisse la relance atterrir AVANT de demonter : sinon jest reste
    //    pendu a une promesse que plus personne ne tient.
    await act(async () => { poignee.poser(); });
    await attendreLesBoutons(arbre, false);
    expect(lireLesBoutonsRelancer(arbre).every((estGrise) => estGrise === false)).toBe(true);

    await act(async () => { arbre.unmount(); });
    queryClient.clear();
  });
});
