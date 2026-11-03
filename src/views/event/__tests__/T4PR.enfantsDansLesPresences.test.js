import fs from 'node:fs';
import path from 'node:path';

import renderer, { act } from 'react-test-renderer';

import { EventChildRegistrationsForOrganizer } from '../components/EventChildRegistration';
import { EventChildResponsesForOrganizer } from '../components/EventChildResponses';

// T4-PARENT-RETOURS (03/11/2026, M0090, décision d'Adel « 6- A ») — le parent répond pour son enfant,
// le coach doit le lire là où il regarde ses présences, pas sous toute la liste. Un compte que le
// serveur refuse ne lit pas une erreur : il n'a simplement pas ce bloc.
const mockResponses = { current: {} };
const mockRegistrations = { current: {} };

jest.mock('@/services/eventChildResponse/eventChildResponseQueries', () => ({
  useAnswerForChild: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useChildEventResponsesForOrganizer: () => mockResponses.current,
  useMyChildEventResponses: () => ({ data: [] }),
}));
jest.mock('@/services/eventChildRegistration/eventChildRegistrationQueries', () => ({
  useDecideChildRegistration: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useEventChildRegistrations: () => mockRegistrations.current,
  useMyChildRegistrations: () => ({ data: [] }),
  useRegisterChildren: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
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
jest.mock('@/components/atoms/checkable/Checkable', () => () => null);
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => () => null);
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: [] }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

const refus = { isError: true, error: { status: 403 }, refetch: jest.fn() };
const rendu = (element) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(element); });
  return arbre.toJSON();
};
const source = (nom) => fs.readFileSync(path.join(__dirname, '..', nom), 'utf8');

beforeEach(() => {
  mockResponses.current = { data: [], isError: false, refetch: jest.fn() };
  mockRegistrations.current = { data: [], isError: false, refetch: jest.fn() };
});

test('un refus du serveur (403) sur les réponses n affiche aucune erreur', () => {
  mockResponses.current = refus;
  expect(rendu(<EventChildResponsesForOrganizer eventId="evt" />)).toBeNull();
});

test('un refus du serveur (403) sur les inscriptions laisse passer les réponses', () => {
  mockRegistrations.current = refus;
  mockResponses.current = {
    data: [{
      answer: 'present', child: { documentId: 'lina', firstname: 'Lina' }, team: { name: 'U11' },
    }],
    isError: false,
    refetch: jest.fn(),
  };
  const texte = JSON.stringify(rendu(<EventChildRegistrationsForOrganizer eventId="evt" />));
  expect(texte).toContain('childEventResponse.organizerTitle');
  expect(texte).not.toContain('childEventRegistration.organizer.title');
});

test('téléphone : le bloc des enfants passe AVANT la liste des présences, pour tout encadrant', () => {
  const ecran = source('EventDetails.js');
  const bloc = ecran.indexOf('<EventChildRegistrationsForOrganizer');
  expect(bloc).toBeGreaterThan(-1);
  expect(bloc).toBeLessThan(ecran.search(/<EventParticipants\r?\n/));
  expect(ecran.slice(bloc - 120, bloc)).toContain('showParticipantsTab && (canEdit || canApprovePendingRequests)');
});

test('site : le bloc des enfants passe AVANT la liste des présences', () => {
  const ecran = source('EventDetails.web.js');
  const bloc = ecran.indexOf('<EventChildRegistrationsForOrganizer');
  expect(bloc).toBeGreaterThan(-1);
  expect(bloc).toBeLessThan(ecran.lastIndexOf('{renderParticipantsSection()}'));
});

test('feuille de présence : le coach y lit les réponses des enfants', () => {
  expect(source(path.join('attendance', 'EventAttendanceCall.js')))
    .toContain('<EventChildResponsesForOrganizer eventId={eventId} />');
});
