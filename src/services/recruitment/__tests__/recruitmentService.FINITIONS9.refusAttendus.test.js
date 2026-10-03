/* eslint-disable max-len -- les phrases du serveur sont citées en entier */
import { applyToRecruitmentAd } from '../recruitmentService';

// FINITIONS9 · POINT 4 — LES REFUS DE CANDIDATURE, AVEC OU SANS ACCENTS.
//
// `POST /recruitment-ads/:id/apply` refuse en 400 avec une phrase française. L'app reconnaît ces
// refus « attendus » pour ne pas les journaliser comme une panne (`console.error`).
// Le serveur passe de « deja acceptee » (vouvoiement, sans accents) à « déjà acceptée »
// (tutoiement, accents) — admin fix/FINITIONS9-admin. Les DEUX formes vivent en même temps :
// la prod garde l'ancien serveur jusqu'à la publication groupée, et un serveur neuf parle aux
// applis déjà installées. Ce témoin rejoue chaque phrase, ANCIENNE et NOUVELLE.
//
// Le rejet a la forme que lui donne l'intercepteur HTTP (`services/client.native.js`) : la
// charge d'erreur Strapi déballée, `{ status, name, message }`.

const mockPost = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (/** @type {any[]} */ ...args) => mockPost(...args) },
}));

// [ce que le serveur refuse, ancienne phrase, nouvelle phrase]
const REFUS_DU_SERVEUR = [
  ['déclaration non cochée', 'Vous devez accepter la declaration de responsabilite et d acceptation des risques pour candidater a cette detection.', "Tu dois accepter la déclaration de responsabilité et d'acceptation des risques pour candidater à cette détection."],
  ['déjà acceptée (entraîneur)', 'Votre candidature est deja acceptee pour cette annonce.', 'Ta candidature est déjà acceptée pour cette annonce.'],
  ['déjà validée (joueur)', 'Votre candidature est deja validee pour cette annonce.', 'Ta candidature est déjà validée pour cette annonce.'],
  ['déjà en attente (entraîneur)', 'Vous avez deja candidate a cette annonce entraineur.', "Tu as déjà candidaté à cette annonce d'entraîneur."],
  ['déjà en attente (détection)', 'Vous avez deja une candidature en attente sur cette detection.', 'Tu as déjà une candidature en attente sur cette détection.'],
  ['détection fermée', 'Vous ne pouvez pas candidater a cette detection fermee.', 'Tu ne peux pas candidater à cette détection fermée.'],
  ['même poste', 'Vous avez deja candidate sur ce poste.', 'Tu as déjà candidaté sur ce poste.'],
  ['autre poste', 'Vous avez deja une candidature active sur un autre poste de cette detection.', 'Tu as déjà une candidature active sur un autre poste de cette détection.'],
  ['poste complet', 'Ce poste est deja complet.', 'Ce poste est déjà complet.'],
];

/**
 * Le refus tel que l'intercepteur HTTP le rejette.
 * @param {string} message
 * @returns {any}
 */
const refus400 = (message) => ({ message, name: 'BadRequestError', status: 400 });

/** @type {jest.SpyInstance} */
let consoleError;

beforeEach(() => {
  mockPost.mockReset();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('FINITIONS9 · point 4 — un refus attendu n est pas une panne, avec ou sans accents', () => {
  it.each(REFUS_DU_SERVEUR)('%s — ANCIENNE forme (serveur de prod actuel) : reconnue', async (_cas, ancienne) => {
    mockPost.mockRejectedValue(refus400(ancienne));

    await expect(applyToRecruitmentAd('ad-1', {})).rejects.toEqual(refus400(ancienne));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(REFUS_DU_SERVEUR)('%s — 🚨 NOUVELLE forme (serveur accentué) : reconnue', async (_cas, _ancienne, nouvelle) => {
    mockPost.mockRejectedValue(refus400(nouvelle));

    await expect(applyToRecruitmentAd('ad-1', {})).rejects.toEqual(refus400(nouvelle));
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('JUMEAU : une vraie panne (500) est toujours journalisée', async () => {
    mockPost.mockRejectedValue({ message: 'Internal Server Error', status: 500 });

    await expect(applyToRecruitmentAd('ad-1', {})).rejects.toBeDefined();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('JUMEAU : un 400 inconnu est toujours journalisé', async () => {
    mockPost.mockRejectedValue(refus400('Requête invalide.'));

    await expect(applyToRecruitmentAd('ad-1', {})).rejects.toBeDefined();
    expect(consoleError).toHaveBeenCalledTimes(1);
  });
});
