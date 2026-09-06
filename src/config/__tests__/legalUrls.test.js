/**
 * Témoin caractérisant des adresses légales exigées par Apple 3.1.2.
 *
 * 🍎 Le 2026-09-06, Apple a REFUSÉ la 2.6.35 au motif exact 3.1.2 : pas de lien
 * fonctionnel vers les conditions d'utilisation. Le correctif de métadonnée est
 * parti le jour même. Ce témoin garde l'autre moitié de la même règle : la
 * surface d'achat doit porter DEUX liens qui mènent à DEUX pages différentes.
 *
 * 🪤 Le défaut que ce fichier existe pour empêcher : `LEGAL_PRIVACY_URL` et
 * `LEGAL_TERMS_URL` ont porté la MÊME adresse (`cgu.html`) tant que la page de
 * confidentialité n'existait pas. Elle existe depuis le 2026-09-04 et répond
 * 200 — laisser les deux constantes égales fait ouvrir les conditions générales
 * sous un bouton intitulé « Confidentialité », sur les 5 surfaces d'achat.
 */
import {
  LEGAL_PRIVACY_URL,
  LEGAL_TERMS_URL,
  SUPPORT_CONTACT_EMAIL,
} from '../legalUrls';

describe('legalUrls — ce que les magasins exigent dans le binaire', () => {
  it('expose des conditions générales servies en HTTPS', () => {
    expect(LEGAL_TERMS_URL).toBe('https://foundclubpro.com/cgu.html');
  });

  it('expose une politique de confidentialité servie en HTTPS', () => {
    expect(LEGAL_PRIVACY_URL).toBe('https://foundclubpro.com/confidentialite.html');
  });

  it("ne fait JAMAIS pointer les deux liens sur la même page", () => {
    expect(LEGAL_PRIVACY_URL).not.toBe(LEGAL_TERMS_URL);
  });

  it('garde une adresse de contact joignable depuis l’app (Apple 1.5)', () => {
    expect(SUPPORT_CONTACT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });
});
