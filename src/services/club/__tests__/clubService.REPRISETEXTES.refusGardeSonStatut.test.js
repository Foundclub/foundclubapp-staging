import { createSelfOnboardClub } from '@/services/club/clubService';

// REPRISE-TEXTES (contre-recette Collectivité, 01/11) — un compte de Ville qui crée un club
// reçoit un refus (403 POST /clubs/self-onboard). createSelfOnboardClub relançait une erreur
// NEUVE, sans le statut : le récapitulatif ne pouvait pas reconnaître le refus et affichait
// « Forbidden ». ROUGE avant : l erreur relancée garde son statut (message du serveur inchangé).

const mockPost = jest.fn();
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

test('🔴 un refus du serveur garde son statut 403', async () => {
  mockPost.mockRejectedValue(Object.assign(new Error('Request failed with status code 403'), {
    response: { data: { error: { message: 'Forbidden', status: 403 } }, status: 403 },
  }));
  await expect(createSelfOnboardClub({ name: 'Club' })).rejects.toMatchObject({
    message: 'Forbidden',
    status: 403,
  });
});

test('🔴 sur le site, le refus arrive sans « response » et garde aussi son statut', async () => {
  // client.web.js rejette `response.data.error` tel quel.
  mockPost.mockRejectedValue({ message: 'Forbidden', name: 'ForbiddenError', status: 403 });
  await expect(createSelfOnboardClub({ name: 'Club' })).rejects.toMatchObject({
    message: 'Forbidden',
    status: 403,
  });
});

test('un doublon suspecté rend toujours ses suggestions', async () => {
  mockPost.mockRejectedValue({
    response: {
      data: {
        error: { details: { code: 'CLUB_DUPLICATE_SUSPECTED', suggestions: [{ name: 'A' }] } },
      },
      status: 409,
    },
  });
  await expect(createSelfOnboardClub({ name: 'Club' })).resolves.toEqual({
    duplicate: true,
    suggestions: [{ name: 'A' }],
  });
});

test('🔴 sur le site, le doublon arrive sans « response » et rend ses suggestions', async () => {
  // client.web.js rejette `response.data.error` tel quel : { status, name, message, details }.
  mockPost.mockRejectedValue({
    details: { code: 'CLUB_DUPLICATE_SUSPECTED', suggestions: [{ name: 'A' }] },
    message: 'Club déjà présent',
    name: 'ConflictError',
    status: 409,
  });
  await expect(createSelfOnboardClub({ name: 'Club' })).resolves.toEqual({
    duplicate: true,
    suggestions: [{ name: 'A' }],
  });
});
