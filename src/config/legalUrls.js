/**
 * Les adresses legales que les magasins exigent DANS le binaire.
 *
 * 🍎 Apple 3.1.2 demande, sur la surface d'achat elle-meme, un lien fonctionnel
 * vers les conditions d'utilisation ET vers la politique de confidentialite. La
 * 2.4.0 est passee sans : elle ne vendait aucun abonnement, la regle ne
 * s'appliquait pas. Elle s'applique des qu'on vend.
 *
 * 📄 `cgu.html` est la page que la fiche Google Play declare deja comme
 * politique de confidentialite. Les deux liens pointent donc pour l'instant sur
 * la MEME page — c'est volontaire et provisoire : une URL dediee
 * « confidentialite » arrivera avec le brouillon en cours de redaction. Le jour
 * ou elle existe, seule `LEGAL_PRIVACY_URL` change, et les cinq surfaces
 * d'achat suivent.
 */
export const LEGAL_TERMS_URL = 'https://foundclubpro.com/cgu.html';

/** @see LEGAL_TERMS_URL — meme page tant que l'URL dediee n'existe pas. */
export const LEGAL_PRIVACY_URL = 'https://foundclubpro.com/cgu.html';
