import { getMyClubInterestRequestsQueryKey } from '../clubInterestRequestQueries';

/**
 * PAR-L5L6 (13/10, design parent §5 ligne L5) — LA CLÉ DE CACHE DE « MES DEMANDES ».
 *
 * `useGetMyClubInterestRequests` envoie `includeChildRequests` au serveur, mais la clé de cache
 * ne le portait pas : la lecture AVEC les demandes des enfants et la lecture SANS partageaient
 * la même case. La première écrite servait la seconde — un écran qui ne veut pas des lignes
 * d'enfant les recevait, ou l'inverse.
 *
 * Le service tire le client HTTP (qui refuse de se charger sans `.env`) : il est doublé.
 */
jest.mock('../clubInterestRequestService', () => ({ getMyClubInterestRequests: jest.fn() }));

test('🔴 avec ou sans les demandes des enfants : deux clés différentes', () => {
  const sans = getMyClubInterestRequestsQueryKey({ clubId: 'club-1' });
  const avec = getMyClubInterestRequestsQueryKey({ clubId: 'club-1', includeChildRequests: true });

  expect(avec).not.toEqual(sans);
});

test('la clé reste sous la racine « clubInterestRequests » (rafraîchissements par préfixe)', () => {
  const cle = getMyClubInterestRequestsQueryKey({
    includeChildRequests: true, includeHistory: true,
  });

  expect(cle.slice(0, 2)).toEqual(['clubInterestRequests', 'mine']);
});

test('« Mes enfants » (sans club, avec historique) et la fiche club : deux clés', () => {
  const mesEnfants = getMyClubInterestRequestsQueryKey({
    includeChildRequests: true, includeHistory: true,
  });
  const ficheClub = getMyClubInterestRequestsQueryKey({
    clubId: 'club-1', includeChildRequests: true,
  });

  expect(mesEnfants).not.toEqual(ficheClub);
});

test('une option absente vaut « non » : la même clé qu un « false » explicite', () => {
  expect(getMyClubInterestRequestsQueryKey({ clubId: 'club-1' }))
    .toEqual(getMyClubInterestRequestsQueryKey({ clubId: 'club-1', includeChildRequests: false }));
});
