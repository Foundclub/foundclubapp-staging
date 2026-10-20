import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import {
  complexePublic,
  groupe,
  maReservation,
  reservationDeParticipant,
} from '@/testSupport/temoinReserver';

// RESA-L6B-2 (20/10/2026) — E-P07, la réservation qui vit comme une partie (serveur RESA-L3 ;
// planche EP07 états 1 à 4 ; plan E-P07 blocs 1 à 5 ; A-P04, A-P05, A-P06, A-P09, RC-P04, RC-P05,
// AT-04, RG-FIDELITE) :
//   · « Participants · 8/10 » : Tous · Présents · Absents · Sans réponse, prénom + initiale,
//     repliés au-delà de 6 (« Voir les 10 ») ;
//   · le réserveur : « Écrire au complexe » (la conversation de SA réservation), « Inviter par
//     lien », « Il me manque des joueurs » (s'il manque du monde, créneau à venir ; l'annonce
//     déjà publiée s'ouvre), « Discussion du groupe » ;
//   · la fidélité du complexe (« Cette partie comptera pour ta fidélité : … ») ;
//   · la collecte : « En collecte · 7/10 », la jauge, la date limite, « Arrêter la collecte » ;
//   · un participant : « Réservée par Julien M. », « Tu viens ? » Présent / Absent, la discussion ;
//     ni annuler, ni inviter, ni annonce.

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, popToTop: jest.fn(), replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

let mockLecture = /** @type {any} */ ({});
let mockGroupe = /** @type {any} */ ({});
let mockRelation = /** @type {any} */ ({});
const mockAnnuler = jest.fn();
const mockRepondre = jest.fn();
const mockFil = jest.fn();
const mockLien = jest.fn();
const mockPublier = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: mockAnnuler }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useGroupeDeLaReservation: () => mockGroupe,
  useLienDInvitation: () => ({ isPending: false, mutateAsync: mockLien }),
  useMaRelationAuComplexe: () => mockRelation,
  useMaReservation: () => mockLecture,
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: mockFil }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: mockPublier }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: mockRepondre }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
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
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMaReservation />);
  });
  await act(async () => {
    await Promise.resolve();
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
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { reservationId: 'r-1' };
  mockLecture = { data: maReservation(), isLoading: false };
  mockGroupe = { data: groupe(), isLoading: false };
  mockRelation = { data: { canal: { membre: true, membres: 214 }, favori: null, fidelite: null } };
  mockFil.mockResolvedValue({ chat: 'chat-1' });
  mockLien.mockResolvedValue({
    actif: true, code: 'K7Q2M9', url: 'https://foundclub.app/r/K7Q2M9',
  });
  mockRepondre.mockResolvedValue(groupe({ myResponse: 'present', role: 'participant' }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P07 — les participants (bloc 3)', () => {
  it('« Participants · 8/10 », onglets comptés, prénom + initiale, repliés après 6', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Participants · 8/10', 'Tous', 'Présents 8', 'Absents 1', 'Sans réponse 1',
      'Julien M. (toi)', 'Karim B.', 'Voir les 10',
    ]));
    expect(lisibles(arbre)).not.toContain('Noah R.');
    await toucher(pressable(arbre, 'Voir les 10'));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Noah R.', 'Pas répondu', 'Absent']));
  });

  it('un onglet : seulement les siens', async () => {
    const arbre = await monter();
    await toucher(pressable(arbre, 'Absents 1'));
    expect(lisibles(arbre)).toContain('Théo L.');
    expect(lisibles(arbre)).not.toContain('Karim B.');
  });
});

describe('E-P07 — le réserveur (blocs 2 et 4)', () => {
  it('« Écrire au complexe » : la conversation de SA réservation (AT-04)', async () => {
    const arbre = await monter();
    await toucher(pressable(arbre, 'Écrire au complexe'));
    expect(mockFil).toHaveBeenCalledWith({ fil: 'complexe', reservationId: 'r-1' });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-1' });
  });

  it('« Discussion du groupe » : le fil du groupe (RG-FIL)', async () => {
    const arbre = await monter();
    await toucher(pressable(arbre, 'Discussion du groupe'));
    expect(mockFil).toHaveBeenCalledWith({ fil: 'discussion', reservationId: 'r-1' });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, { chatId: 'chat-1' });
  });

  it('la discussion fermée à un mineur sans garde : la phrase du serveur', async () => {
    mockFil.mockRejectedValueOnce({
      details: { code: 'MINOR_DIRECT_CHAT_FORBIDDEN' },
      message: 'La discussion du groupe ne t’est pas ouverte : ni ton parent ni un encadrant de '
        + 'ton club ne peut la rejoindre.',
      status: 403,
    });
    const arbre = await monter();
    await toucher(pressable(arbre, 'Discussion du groupe'));
    expect(lisibles(arbre)).toContain('La discussion du groupe ne t’est pas ouverte : ni ton '
      + 'parent ni un encadrant de ton club ne peut la rejoindre.');
    expect(mockNavigate).not.toHaveBeenCalledWith(RouteNames.Conversation, expect.anything());
  });

  it('« Inviter par lien » : la feuille du lien, avec « Désactiver le lien »', async () => {
    const arbre = await monter();
    await toucher(pressable(arbre, 'Inviter par lien'));
    expect(mockLien).toHaveBeenCalledWith({ actif: true, reservationId: 'r-1' });
    expect(lisibles(arbre)).toContain('Désactiver le lien');
  });

  it('« Il me manque des joueurs » : la feuille de l’annonce (E-P09 A)', async () => {
    const arbre = await monter();
    await toucher(pressable(arbre, 'Il me manque des joueurs'));
    expect(lisibles(arbre)).toEqual(expect.arrayContaining(['Combien ?', 'Publier l’annonce']));
  });

  it('une annonce déjà publiée : la carte l’ouvre (E-P09 B)', async () => {
    mockGroupe = { data: groupe({ annonce: { documentId: 'a-1', status: 'ouverte' } }) };
    const arbre = await monter();
    await toucher(pressable(arbre, 'Il me manque des joueurs'));
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverAnnonce, { annonceId: 'a-1' });
  });

  it('complète : pas d’« Il me manque des joueurs »', async () => {
    mockGroupe = { data: groupe({ counts: { absents: 0, presents: 10, sansReponse: 0 } }) };
    expect(lisibles(await monter())).not.toContain('Il me manque des joueurs');
  });

  it('« ouvrir: annonce » (depuis E-P05) : la feuille de l’annonce d’emblée', async () => {
    mockParams = { ouvrir: 'annonce', reservationId: 'r-1' };
    expect(lisibles(await monter())).toContain('Publier l’annonce');
  });
});

it('la fidélité du complexe : ce que la partie fera compter (RG-FIDELITE)', async () => {
  mockRelation = {
    data: {
      canal: null,
      favori: null,
      fidelite: {
        count: 8, disponible: false, restant: 2, reward: '1 partie offerte', threshold: 10,
      },
    },
  };
  expect(lisibles(await monter())).toContain(
    'Cette partie comptera pour ta fidélité : encore 2 réservations avant « 1 partie offerte »',
  );
});

describe('E-P07 — en collecte (état 2)', () => {
  beforeEach(() => {
    mockLecture = { data: maReservation({ canCancel: false, status: 'en_collecte' }) };
    mockGroupe = {
      data: groupe({
        collecte: {
          collectDeadline: '2026-10-15T16:00:00.000Z',
          failure: null,
          presents: 7,
          quorum: 10,
          reachedAt: null,
        },
        counts: { absents: 1, presents: 7, sansReponse: 2 },
        status: 'en_collecte',
      }),
    };
  });

  it('« En collecte · 7/10 », la jauge, la date limite, le créneau libre', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'En collecte · 7/10',
      'Date limite : jeudi 18 h · le créneau reste libre jusque-là',
    ]));
    expect(parRepere(arbre, 'ma-reservation-jauge')).not.toBeNull();
  });

  it('« Arrêter la collecte » : les inscrits prévenus, puis la confirmation', async () => {
    mockAnnuler.mockResolvedValue(maReservation({ cancelledBy: 'reserveur', status: 'annulee' }));
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Les 6 inscrits seront prévenus.');
    await toucher(pressable(arbre, 'Arrêter la collecte'));
    await toucher(pressable(arbre, 'Oui, arrêter'));
    expect(mockAnnuler).toHaveBeenCalledWith('r-1');
  });
});

describe('E-P07 — un participant (état 3)', () => {
  beforeEach(() => {
    mockLecture = { data: reservationDeParticipant() };
    mockGroupe = {
      data: groupe({
        myResponse: 'sans_reponse',
        participants: groupe().participants.map((p) => ({ ...p, isMe: p.label === 'Noah R.' })),
        role: 'participant',
      }),
    };
  });

  it('« Réservée par Julien M. », « Tu viens ? », ni annuler, ni inviter, ni annonce', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'RÉSERVATION',
      'Réservée par Julien M.',
      'Tu viens ?',
      'Présent',
      'Absent',
      'Tu t’engages sur l’honneur à venir si tu réponds présent.',
      'Discussion du groupe',
    ]));
    expect(vus).not.toContain('Annuler la réservation');
    expect(vus).not.toContain('Inviter par lien');
    expect(vus).not.toContain('Il me manque des joueurs');
    expect(vus).not.toContain('Le délai est passé : appelle le complexe.');
    expect(vus).not.toContain('Écrire au complexe');
  });

  it('« Présent » : la réponse part ; refusé (complète), la phrase', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'ma-reservation-present'));
    expect(mockRepondre).toHaveBeenCalledWith({ reponse: 'present', reservationId: 'r-1' });
    mockRepondre.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_COMPLETE' }, status: 409,
    });
    await toucher(parRepere(arbre, 'ma-reservation-present'));
    expect(lisibles(arbre)).toContain('La partie est complète.');
  });

  it('une réservation d’équipe : « Pour U15 Valbrune · réservée par Mathis R. »', async () => {
    mockLecture = { data: reservationDeParticipant({ bookerLabel: 'Mathis R.' }) };
    mockGroupe = { data: groupe({ equipe: { name: 'U15 Valbrune' }, role: 'participant' }) };
    expect(lisibles(await monter())).toContain('Pour U15 Valbrune · réservée par Mathis R.');
  });

  it('annulée par le réserveur (N-33) : l’en-tête d’E-P13 variante 7', async () => {
    mockParams = { change: 'annulee-par-reserveur', reservationId: 'r-1' };
    mockLecture = { data: reservationDeParticipant({ status: 'annulee' }) };
    expect(lisibles(await monter())).toEqual(expect.arrayContaining([
      'Partie annulée',
      'Julien M. a annulé la partie de vendredi 18 h.',
    ]));
  });
});

it('collecte arrêtée, créneau pris (N-23) : le texte A-P08 au « tu »', async () => {
  mockLecture = { data: maReservation({ canCancel: false, status: 'non_aboutie' }) };
  mockGroupe = {
    data: groupe({
      collecte: {
        collectDeadline: '2026-10-15T16:00:00.000Z',
        failure: 'creneau_pris',
        presents: 7,
        quorum: 10,
        reachedAt: null,
      },
      status: 'non_aboutie',
    }),
  };
  expect(lisibles(await monter())).toEqual(expect.arrayContaining([
    'Réservation non aboutie',
    'Désolé, ta réservation n’a pas pu aboutir : quelqu’un a réservé le créneau avant que tu '
      + 'réunisses assez de joueurs.',
  ]));
});

it('le témoin de la doublure : le complexe public porte son adresse', () => {
  expect(complexePublic().address.label).toBe('12 allée des Sports, Montrivage');
});
