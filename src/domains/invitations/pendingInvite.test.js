/**
 * Temoins E6 du lot Y03 — l'invitation qui ATTEND.
 *
 * C'est la charniere du chemin « l'app n'etait pas encore installee » : le lien
 * est lu une fois, range, et repropose plus tard (apres l'inscription, ou apres
 * un simple redemarrage). Elle ne declenche jamais rien toute seule.
 */
const mockStorage = {
  delete: jest.fn(),
  getString: jest.fn(),
  set: jest.fn(),
};

jest.mock('@/store/appContext', () => ({
  storage: mockStorage,
}));

const {
  clearPendingInvite,
  PENDING_INVITE_MAX_AGE_MS,
  PENDING_INVITE_STORAGE_KEY,
  readPendingInvite,
  savePendingInvite,
} = require('./pendingInvite');

const NOW = 1_700_000_000_000;

describe('pendingInvite — l invitation qui attend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('range une invitation d equipe', () => {
    savePendingInvite({ id: ' t-1 ', subject: 'team' });

    expect(mockStorage.set).toHaveBeenCalledWith(
      PENDING_INVITE_STORAGE_KEY,
      JSON.stringify({ createdAt: NOW, id: 't-1', subject: 'team' }),
    );
  });

  it('range une invitation d evenement — le MEME magasin', () => {
    savePendingInvite({ id: 'e-1', subject: 'event' });

    expect(mockStorage.set).toHaveBeenCalledWith(
      PENDING_INVITE_STORAGE_KEY,
      JSON.stringify({ createdAt: NOW, id: 'e-1', subject: 'event' }),
    );
  });

  it('refuse un sujet inconnu ou un identifiant vide', () => {
    savePendingInvite({ id: 'x-1', subject: 'licorne' });
    savePendingInvite({ id: '   ', subject: 'team' });
    savePendingInvite(null);

    expect(mockStorage.set).not.toHaveBeenCalled();
  });

  it('relit une invitation recente', () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify({ createdAt: NOW, id: 't-1', subject: 'team' }),
    );

    expect(readPendingInvite()).toEqual({ createdAt: NOW, id: 't-1', subject: 'team' });
    expect(mockStorage.delete).not.toHaveBeenCalled();
  });

  it('🔒 jette une invitation perimee au lieu de la rejouer', () => {
    mockStorage.getString.mockReturnValue(JSON.stringify({
      createdAt: NOW - PENDING_INVITE_MAX_AGE_MS - 1,
      id: 't-1',
      subject: 'team',
    }));

    expect(readPendingInvite()).toBeNull();
    expect(mockStorage.delete).toHaveBeenCalledWith(PENDING_INVITE_STORAGE_KEY);
  });

  it('ne casse jamais sur un contenu illisible', () => {
    mockStorage.getString.mockReturnValue('{ pas du json');
    expect(readPendingInvite()).toBeNull();

    mockStorage.getString.mockReturnValue(undefined);
    expect(readPendingInvite()).toBeNull();

    mockStorage.getString.mockReturnValue(
      JSON.stringify({ createdAt: NOW, id: 't-1', subject: 'licorne' }),
    );
    expect(readPendingInvite()).toBeNull();
  });

  it('efface l invitation', () => {
    clearPendingInvite();

    expect(mockStorage.delete).toHaveBeenCalledWith(PENDING_INVITE_STORAGE_KEY);
  });
});
