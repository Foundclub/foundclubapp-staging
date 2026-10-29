import en from '@/theme/strings/translations/en';
import fr from '@/theme/strings/translations/fr';

import { COACH_GUIDE } from '../coachGuide';

// TUTOE-CALIBRAGE-2 (27/10, décisions du chef) :
// (2) « Crée ! » promettait « toute la saison, jusqu'en juin » alors que le
//     tunnel propose une fin à une semaine (Répéter) ou une séance unique ;
// (6) B1 « Ouvre ta séance » n'avait aucune cible : la carte de LA séance
//     créée en M3 est visée dans le planning (`planning.event.<id>`).

jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));
jest.mock('react-native-blob-util', () => ({ fs: {} }));
jest.mock('@/config/runtimeUrls', () => ({ getApiBaseUrl: jest.fn(() => 'http://localhost:1337') }));
jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: jest.fn(() => null) }));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));
const mockPost = jest.fn();
jest.mock('@/services/client', () => ({ __esModule: true, default: { post: mockPost } }));

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);

describe('M3 « Crée ! » : un texte juste quelle que soit la fin choisie', () => {
  it.each([
    ['fr', fr.tourCatalog.coach['m3-create']],
    ['en', en.tourCatalog.coach['m3-create']],
    ['repli', step('m3-create').text],
  ])('%s : ne promet ni juin ni la saison entière', (_langue, texte) => {
    expect(texte).not.toMatch(/juin|june|saison|season/i);
  });

  it('renvoie à la date de fin de « Répéter »', () => {
    expect(fr.tourCatalog.coach['m3-create']).toMatch(/Répéter/);
    expect(en.tourCatalog.coach['m3-create']).toMatch(/Repeat/);
  });
});

describe('B1 « Ouvre ta séance » : la carte de la séance créée en M3', () => {
  it('vise planning.event.<id de la séance>', () => {
    const b1 = step('b1-card');
    expect(b1.targetsFor({ created: { 'event.created': { documentId: 'ev-42' } } }))
      .toEqual(['planning.event.ev-42', 'planning.event.next']);
  });

  // GUIDE-FINITIONS-3 R2-3 : plus de « bulle seule », la prochaine séance du planning.
  it('sans séance connue : la prochaine séance du planning', () => {
    expect(step('b1-card').targetsFor({ created: {} })).toEqual(['planning.event.next']);
  });

  it('la création d’une séance donne son id au guide', async () => {
    const { emitGuidanceAction } = jest.requireMock('@/domains/guidance/guidanceRuntime');
    mockPost.mockResolvedValue({ data: { data: { documentId: 'ev-7' } } });
    const { createEvent } = jest.requireActual('@/services/event/eventService');
    await createEvent({ name: 'Séance' });
    expect(emitGuidanceAction).toHaveBeenCalledWith('event.created', expect.objectContaining({
      documentId: 'ev-7',
    }));
  });
});
