/* eslint-disable max-len -- témoin BH04 : entrées du rapport gardées sur une ligne */
import renderer, { act } from 'react-test-renderer';

// BH04 / P6-06 — le type s écrit « Réservation » (accent) côté serveur :
// sans accent, le filtre ne retire aucune réservation privée.

const mockFiltres = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'fr' }, t: (_c, r) => (typeof r === 'string' ? r : r?.defaultValue || _c) }),
}));
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: (f) => { mockFiltres.push(f); return { data: undefined, error: null, isLoading: false }; },
}));
jest.mock('@/services/search/searchQueries', () => ({
  useSearchEvents: (f) => { mockFiltres.push(f); return { data: undefined, error: null, isLoading: false }; },
}));
jest.mock('@/components/templates/ScreenContainer', () => 'ScreenContainer');
jest.mock('@/services/search/searchService', () => ({ mapSearchPayload: (x) => x }));

// eslint-disable-next-line import/first
import ConversationPublicEventPicker from '../ConversationPublicEventPicker.web';

describe('ConversationPublicEventPicker (web) — P6-06', () => {
  test('les deux requêtes excluent le type « Réservation »', () => {
    act(() => {
      renderer.create(<ConversationPublicEventPicker navigation={{ goBack: jest.fn(), navigate: jest.fn() }} route={{ params: { chatId: 'c1' } }} />);
    });
    expect(mockFiltres.length).toBeGreaterThanOrEqual(2);
    mockFiltres.forEach((f) => expect(f.excludeType).toBe('Réservation'));
  });
});
