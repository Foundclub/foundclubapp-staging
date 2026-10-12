import { lireLeRefus, phraseDuRefus, RaisonDuRefus } from '../refusAlerte';

// PAR-L10 (12/10) — le lecteur de refus de la création d'alerte, sur TOUTES les formes
// que la création peut rejeter : la charge Strapi déballée par le client HTTP
// (`client.native.js:91-97`), l'abandon sur délai (`apiError.js:35`), la chaîne nue
// sans réseau, et la forme axios brute d'un service qui contournerait le client.

const LIMITE = 'Limite de 10 alertes atteinte. Supprimez une alerte existante.';

/**
 * La traduction de test : le texte de repli, `{{x}}` remplacé comme i18next.
 * @param {string} _cle La clé.
 * @param {string} repli Le texte de repli.
 * @param {Record<string, any>} [options] Les valeurs.
 * @returns {string} Le texte.
 */
const t = (_cle, repli, options = {}) => repli.replace(/\{\{(\w+)\}\}/g, (_, nom) => String(options[nom]));

describe('lireLeRefus — la raison, quelle que soit la forme de l erreur', () => {
  it.each([
    ['403 déballé (droit manquant du rôle)', {
      details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403,
    }, RaisonDuRefus.droit],
    ['400 de la limite', {
      details: {}, message: LIMITE, name: 'BadRequestError', status: 400,
    }, RaisonDuRefus.limite],
    ['400 rédigé par le serveur', {
      details: {}, message: 'La ville est obligatoire pour une alerte.', status: 400,
    }, RaisonDuRefus.serveur],
    ['abandon à 15 s', {
      code: 'REQUEST_TIMEOUT_ABANDONED', message: 'Request timeout - please retry.', status: 0,
    }, RaisonDuRefus.delai],
    ['chaîne nue sans réseau (XHR)', 'Network Error', RaisonDuRefus.connexion],
    ['chaîne nue sans réseau (fetch)', 'Network request failed', RaisonDuRefus.connexion],
    ['500', { message: 'Internal Server Error', status: 500 }, RaisonDuRefus.inconnue],
    ['401', { message: 'Unauthorized', status: 401 }, RaisonDuRefus.inconnue],
    ['403 qui déguise une panne (INTERNAL_SERVER_ERROR)', {
      details: { code: 'INTERNAL_SERVER_ERROR' }, message: 'x', status: 403,
    }, RaisonDuRefus.inconnue],
    ['rien du tout', undefined, RaisonDuRefus.inconnue],
    ['« Unknown error » du client', 'Unknown error', RaisonDuRefus.inconnue],
  ])('%s', (_, erreur, raison) => {
    expect(lireLeRefus(erreur).raison).toBe(raison);
  });

  it('la forme axios brute reste lue (status et message du serveur)', () => {
    const refus = lireLeRefus({
      message: 'Request failed with status code 400',
      response: { data: { error: { message: LIMITE } }, status: 400 },
    });
    expect(refus).toEqual({ maximum: 10, message: LIMITE, raison: RaisonDuRefus.limite });
  });
});

describe('phraseDuRefus — ce que lit l utilisateur', () => {
  it.each([
    [{ message: 'Forbidden', status: 403 }, 'Ton compte ne peut pas encore créer d\'alerte.'],
    [{ message: LIMITE, status: 400 },
      'Tu as déjà 10 alertes : supprimes-en une dans Mes alertes.'],
    [{ message: 'Limite de 12 alertes atteinte.', status: 400 },
      'Tu as déjà 12 alertes : supprimes-en une dans Mes alertes.'],
    ['Network Error', 'Pas de connexion.'],
    [{ code: 'REQUEST_TIMEOUT_ABANDONED', message: 'Request timeout - please retry.', status: 0 },
      'Le serveur met du temps à répondre : regarde dans Mes alertes avant de réessayer.'],
    [{ message: ' La ville est obligatoire pour une alerte. ', status: 400 },
      'La ville est obligatoire pour une alerte.'],
    [{ message: 'Internal Server Error', status: 500 }, 'Réessaie dans un instant.'],
  ])('%j', (erreur, phrase) => {
    expect(phraseDuRefus(lireLeRefus(erreur), t)).toBe(phrase);
  });
});
