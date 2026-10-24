jest.mock('@/services/auth/authService', () => ({ switchManagedClub: jest.fn() }));
jest.mock('@/domains/auth/useAuth', () => jest.fn());
jest.mock('@/store/appContext', () => ({ storage: { getString: jest.fn(), set: jest.fn() } }));
jest.mock('@/utils/errors/displayError', () => ({ displayErrorAlert: jest.fn() }));

// eslint-disable-next-line import/first
import { normalizeScopeRecord } from '../ClubScopeContext';

// BH03 · P2-04 — un dirigeant d'UN SEUL club (aucun club multisport) sans choix
// enregistre etait bascule en mode « multisport » : le repli ignorait le mode par defaut.
describe('BH03 · P2-04 — normalizeScopeRecord', () => {
  const userData = { club: { documentId: 'club-1' }, documentId: 'u-1' };

  it('sans choix enregistre, garde le mode par defaut « section »', () => {
    expect(normalizeScopeRecord(undefined, userData).activeMode).toBe('section');
  });

  it('un choix enregistre « multisport » reste respecte', () => {
    expect(normalizeScopeRecord({ activeMode: 'multisport' }, userData).activeMode).toBe('multisport');
  });
});
