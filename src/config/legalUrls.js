/**
 * Les adresses legales que les magasins exigent DANS le binaire.
 *
 * 🍎 Apple 3.1.2 demande, sur la surface d'achat elle-meme, un lien fonctionnel
 * vers les conditions d'utilisation ET vers la politique de confidentialite. La
 * 2.4.0 est passee sans : elle ne vendait aucun abonnement, la regle ne
 * s'appliquait pas. Elle s'applique des qu'on vend.
 *
 * 📄 Les deux liens ont pointe sur la MEME page (`cgu.html`) tant que la
 * politique de confidentialite n'existait pas. ✅ Elle existe depuis le
 * 2026-09-04 et repond 200 (39 935 o, mesure le 2026-09-06) : les deux
 * constantes sont donc separees, comme prevu. Le temoin qui l'empeche de
 * regresser est `__tests__/legalUrls.test.js`.
 */
export const LEGAL_TERMS_URL = 'https://foundclubpro.com/cgu.html';

/**
 * @see LEGAL_TERMS_URL
 * 🍎 Doit rester DIFFERENTE de `LEGAL_TERMS_URL` : sinon les cinq surfaces
 * d'achat ouvrent les conditions generales sous un bouton « Confidentialite ».
 */
export const LEGAL_PRIVACY_URL = 'https://foundclubpro.com/confidentialite.html';

/**
 * L'adresse a laquelle on peut nous joindre depuis l'application.
 *
 * 🍎 Apple 1.5 exige un moyen FACILE de joindre l'editeur DANS l'app. C'est
 * aussi l'adresse que la fiche Google Play declare deja, et celle du formulaire
 * de `foundclubpro.com/contact.html`.
 */
export const SUPPORT_CONTACT_EMAIL = 'contact@foundclubpro.com';

/** @see SUPPORT_CONTACT_EMAIL */
export const SUPPORT_CONTACT_MAILTO = `mailto:${SUPPORT_CONTACT_EMAIL}`;
