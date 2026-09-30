/**
 * PARENT-LIEN — LE SERVICE DU LIEN PARENT ↔ COMPTE D'UN ENFANT.
 *
 * ① la demande porte la DÉCLARATION PARENTALE exacte que le serveur vérifie (portée, version,
 *    empreinte, case cochée) : sans elle, 400 ;
 * ② chaque geste vise SA route (7 portes, aucune autre) ;
 * ③ un refus garde son CODE serveur : l'écran en dépend pour parler français.
 */

import {
  MINOR_PARENTAL_DECLARATION_SCOPE,
  MINOR_PARENTAL_DECLARATION_TEXT_HASH,
  MINOR_PARENTAL_DECLARATION_VERSION,
} from '../../../constants/parentalDeclaration';
import {
  acceptParentLink,
  cancelParentLink,
  getParentLinksAsChild,
  getParentLinksAsParent,
  parentLinkErrorCode,
  refuseParentLink,
  requestParentLink,
  unlinkParent,
} from '../parentLinkService';

jest.mock('../../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import client from '../../client';

beforeEach(() => {
  jest.clearAllMocks();
  client.post.mockResolvedValue({ data: { data: { state: 'pending' } } });
  client.get.mockResolvedValue({ data: { data: {} } });
});

test('LIEN-SERVICE ① numéro, fiche, et la déclaration parentale EXACTE', async () => {
  await requestParentLink({ declaredChildDocumentId: 'enfant-1', phoneNumber: ' 06 11 11 11 11 ' });

  const [route, corps] = client.post.mock.calls[0];
  expect(route).toBe('/parent-links');
  expect(corps.data.phoneNumber).toBe('06 11 11 11 11');
  expect(corps.data.declaredChildDocumentId).toBe('enfant-1');
  expect(corps.data.legalAcceptance).toEqual(expect.objectContaining({
    accepted: true,
    consentFlags: { parentalAuthorityConfirmation: true },
    legalTextHash: MINOR_PARENTAL_DECLARATION_TEXT_HASH,
    legalVersion: MINOR_PARENTAL_DECLARATION_VERSION,
    scope: MINOR_PARENTAL_DECLARATION_SCOPE,
  }));
});

test('LIEN-SERVICE ① bis sans fiche, aucune clef de fiche ne part', async () => {
  await requestParentLink({ phoneNumber: '0611111111' });
  expect('declaredChildDocumentId' in client.post.mock.calls[0][1].data).toBe(false);
});

test('LIEN-SERVICE ② chaque geste vise SA route', async () => {
  await getParentLinksAsParent();
  await getParentLinksAsChild();
  await cancelParentLink('d-1');
  await acceptParentLink('d-2');
  await refuseParentLink('d-3');
  await unlinkParent();

  expect(client.get.mock.calls.map(([route]) => route))
    .toEqual(['/parent-links/as-parent', '/parent-links/as-child']);
  expect(client.post.mock.calls.map(([route]) => route)).toEqual([
    '/parent-links/d-1/cancel',
    '/parent-links/d-2/accept',
    '/parent-links/d-3/refuse',
    '/parent-links/unlink',
  ]);
});

test('LIEN-SERVICE ② bis listes vides ou abîmées : des tableaux, jamais undefined', async () => {
  client.get.mockResolvedValue({ data: { data: null } });
  await expect(getParentLinksAsParent()).resolves.toEqual({ children: [], requests: [] });
  await expect(getParentLinksAsChild())
    .resolves.toEqual({ eligible: false, parent: null, requests: [] });
});

test('LIEN-SERVICE ③ un refus garde son statut et son CODE serveur', async () => {
  // L'intercepteur HTTP rejette la charge Strapi DÉBALLÉE (utils/errors/apiError.js).
  client.post.mockRejectedValue({
    details: { code: 'PARENT_LINK_REQUESTER_NOT_ADULT' },
    message: 'Only an adult can link a child account',
    name: 'ForbiddenError',
    status: 403,
  });

  const erreur = await requestParentLink({ phoneNumber: '0611111111' }).catch((e) => e);
  expect(erreur.status).toBe(403);
  expect(parentLinkErrorCode(erreur)).toBe('PARENT_LINK_REQUESTER_NOT_ADULT');
});
