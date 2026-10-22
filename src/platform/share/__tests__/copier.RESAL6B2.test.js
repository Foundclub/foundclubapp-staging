import { copier as copierAuTelephone } from '../share.native';
import { copier as copierSurLeSite } from '../share.web';

// RESA-L6B-2 (20/10/2026) — « COPIER LE LIEN » (feuille « Inviter par lien », E-P05 / E-P07),
// commun au téléphone et au site : le module natif du presse-papiers sur le téléphone, chargé au
// geste (en tête de fichier, il casserait chaque témoin qui monte l'écran) ; le presse-papiers du
// navigateur sur le site (un `require` n'y vit pas : site.sansRequire). Vrai si la copie a eu lieu.

const mockPoser = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: (/** @type {string} */ texte) => mockPoser(texte) },
}));

const LIEN = 'https://foundclub.app/r/K7Q2M9';
const navigateurReel = Object.getOwnPropertyDescriptor(global, 'navigator');

const poserNavigateur = (/** @type {any} */ navigateur) => {
  Object.defineProperty(global, 'navigator', { configurable: true, value: navigateur });
};

afterEach(() => {
  jest.clearAllMocks();
  if (navigateurReel) Object.defineProperty(global, 'navigator', navigateurReel);
  else delete (/** @type {any} */ (global)).navigator;
});

it('téléphone : le module natif reçoit le lien', async () => {
  expect(await copierAuTelephone(LIEN)).toBe(true);
  expect(mockPoser).toHaveBeenCalledWith(LIEN);
});

it('téléphone : le module refuse ⇒ faux, sans exception', async () => {
  mockPoser.mockImplementationOnce(() => {
    throw new Error('presse-papiers indisponible');
  });
  expect(await copierAuTelephone(LIEN)).toBe(false);
});

it('site : le presse-papiers du navigateur reçoit le lien ; sans lui, faux', async () => {
  const ecrire = jest.fn().mockResolvedValue(undefined);
  poserNavigateur({ clipboard: { writeText: ecrire } });
  expect(await copierSurLeSite(LIEN)).toBe(true);
  expect(ecrire).toHaveBeenCalledWith(LIEN);
  poserNavigateur({});
  expect(await copierSurLeSite(LIEN)).toBe(false);
  poserNavigateur({ clipboard: { writeText: jest.fn().mockRejectedValue(new Error('refusé')) } });
  expect(await copierSurLeSite(LIEN)).toBe(false);
});
