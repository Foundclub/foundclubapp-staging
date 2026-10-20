import renderer, { act } from 'react-test-renderer';

import ReserverInvitation from '@/views/reserverTerrain/ReserverInvitation';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { groupe } from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P08, la page d'invitation par lien DANS l'app (planche EP08 ; plan
// E-P08 ; A-P05, A-P06, Q4, RG-LIEN, AT-05 A, AT-09 B) : un compte connecté lit la page du lien
// (`GET /public-reservations/:code`, la liste fermée du serveur) et répond avec son compte
// (`POST /reservations-terrain/lien/:code/reponse`). « Julien t'invite à jouer » (ou « Julien
// cherche des joueurs » pour une collecte), la carte, « 7 présents sur 10 » et les prénoms +
// initiales (AT-09 B), « Je viens » / « Je ne viens pas », l'engagement, « Voir le complexe » ;
// répondu : « Tu es noté présent. Changer » (pour un absent, « C'est noté. » : personne n'est
// prévenu d'un absent) ; refus nommés (âge, banni, complète) ; lien éteint, partie finie.
// La page du SITE (`/r/<code>`, sans compte) est le lot RESA-L7-2.

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockInvitation = /** @type {any} */ ({});
const mockRepondre = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useInvitation: () => mockInvitation,
  useRepondreParLeLien: () => ({ isPending: false, mutateAsync: mockRepondre }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * La page d'un lien (`toPublicView`, serveur RESA-L3).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La page.
 */
const pageDuLien = (autres = {}) => ({
  annonce: null,
  code: 'K7Q2M9',
  collecte: null,
  complexe: { city: 'Montrivage', name: 'Le Five de Montrivage', slug: 'le-five-de-montrivage' },
  date: '2026-10-13',
  endsAt: '2026-10-13T17:00:00.000Z',
  etat: 'ouverte',
  from: '18:00',
  message: null,
  minAge: 16,
  organisateur: 'Julien',
  participants: ['Julien M.', 'Karim B.', 'Sami A.', 'Théo L.', 'Noah R.', 'Mathis R.', 'Lina T.'],
  places: 10,
  presents: 7,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  startsAt: '2026-10-13T16:00:00.000Z',
  terrain: { name: 'Terrain 1', sport: 'Football à 5' },
  to: '19:00',
  ...autres,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverInvitation />);
  });
  return arbre;
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    await noeud.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { code: 'K7Q2M9' };
  mockInvitation = { data: pageDuLien(), isLoading: false };
  mockRepondre.mockResolvedValue(groupe({
    myResponse: 'present', reservation: 'r-1', role: 'participant',
  }));
});

it('la page : l’invitation, la carte, les présents nommés (AT-09 B), les réponses', async () => {
  const vus = lisibles(await monter());
  expect(vus).toEqual(expect.arrayContaining([
    'Julien t’invite à jouer',
    'Foot à 5 · Mardi 13 octobre · 18 h – 19 h',
    'Le Five de Montrivage, Montrivage',
    '60 € le créneau, à régler sur place',
    '7 présents sur 10',
    'Julien M., Karim B., Sami A., Théo L., Noah R., Mathis R., Lina T.',
    'Je viens',
    'Je ne viens pas',
    'Tu t’engages sur l’honneur à venir si tu réponds présent.',
    'Voir le complexe',
  ]));
});

it('une collecte : « Julien cherche des joueurs », nombre requis, date limite', async () => {
  mockInvitation = {
    data: pageDuLien({
      collecte: { collectDeadline: '2026-10-12T16:00:00.000Z', quorum: 10 },
      etat: 'collecte',
      presents: 6,
    }),
  };
  expect(lisibles(await monter())).toEqual(expect.arrayContaining([
    'Julien cherche des joueurs',
    '6 présents sur 10',
    'Il en faut 10 pour réserver. Date limite : lundi 18 h.',
  ]));
});

it('« Je viens » : « Tu es noté présent. », « Voir la partie dans l’app »', async () => {
  const arbre = await monter();
  await toucher(parRepere(arbre, 'invitation-present'));
  expect(mockRepondre).toHaveBeenCalledWith({ code: 'K7Q2M9', reponse: 'present' });
  expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Tu es noté présent.', 'Changer']));
  await toucher(pressable(arbre, 'Voir la partie dans l’app'));
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
    reservationId: 'r-1',
  });
  await toucher(pressable(arbre, 'Changer'));
  expect(lisibles(arbre)).toContain('Je ne viens pas');
});

it('« Je ne viens pas » : « C’est noté. » — personne n’est prévenu d’un absent', async () => {
  mockRepondre.mockResolvedValue(groupe({
    myResponse: 'absent', reservation: 'r-1', role: 'participant',
  }));
  const arbre = await monter();
  await toucher(parRepere(arbre, 'invitation-absent'));
  expect(mockRepondre).toHaveBeenCalledWith({ code: 'K7Q2M9', reponse: 'absent' });
  const vus = lisibles(arbre);
  expect(vus).toContain('C’est noté.');
  expect(vus.join(' ')).not.toMatch(/prévenu/);
});

it('refus nommés : l’âge du complexe, le bannissement (sans raison)', async () => {
  mockRepondre.mockRejectedValueOnce({
    details: { code: 'COMPLEXE_RESERVATION_AGE', minAge: 16 }, status: 403,
  });
  const arbre = await monter();
  await toucher(parRepere(arbre, 'invitation-present'));
  expect(lisibles(arbre)).toContain('Ce complexe accepte les joueurs à partir de 16 ans.');
  mockRepondre.mockRejectedValueOnce({
    details: { code: 'COMPLEXE_RESERVATION_BANNED', reason: 'privé' }, status: 403,
  });
  await toucher(parRepere(arbre, 'invitation-present'));
  expect(lisibles(arbre)).toContain('Tu ne peux pas rejoindre une partie dans ce complexe.');
  expect(lisibles(arbre).join(' ')).not.toMatch(/privé/);
});

it('complète : « La partie est complète. », seul « Je ne viens pas » reste', async () => {
  mockInvitation = {
    data: pageDuLien({ etat: 'complete', message: 'La partie est complète.', presents: 10 }),
  };
  const vus = lisibles(await monter());
  expect(vus).toEqual(expect.arrayContaining(['La partie est complète.', 'Je ne viens pas']));
  expect(vus).not.toContain('Je viens');
});

it('annulée ou passée : la phrase du serveur, plus de réponse', async () => {
  mockInvitation = {
    data: pageDuLien({ etat: 'annulee', message: 'Cette partie a été annulée.' }),
  };
  const vus = lisibles(await monter());
  expect(vus).toContain('Cette partie a été annulée.');
  expect(vus).not.toContain('Je ne viens pas');
});

it('lien éteint ou inconnu : « Ce lien n’est plus valable… »', async () => {
  mockInvitation = {
    data: null,
    error: { details: { code: 'COMPLEXE_RESERVATION_LIEN_INVALIDE' }, status: 404 },
    isLoading: false,
  };
  expect(lisibles(await monter())).toContain(
    'Ce lien n’est plus valable. Demande-en un autre à la personne qui t’a invité.',
  );
});

it('« Voir le complexe » : sa page (E-P02)', async () => {
  const arbre = await monter();
  await toucher(pressable(arbre, 'Voir le complexe'));
  expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverComplexe, {
    slug: 'le-five-de-montrivage',
  });
});
