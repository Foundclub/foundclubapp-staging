import { exportTrainingResults } from '@/services/training/trainingService';

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

// eslint-disable-next-line import/first -- le mock doit etre pose AVANT l import du client.
import client from '@/services/client';

/**
 * 🧨 « LA RESSOURCE DEMANDEE EST INTROUVABLE » SUR UN CARNET NEUF.
 *
 * Constat d'Adel, capture d'ecran du 2026-09-10 a 21h34 : il ouvre « Mon carnet »
 * sur la version 2.6.40 et lit un message technique sur fond rose, avec un bouton
 * « Reessayer » qui ne peut rien reparer.
 *
 * La cause n'est PAS une panne : le serveur repond exactement ce qu'il doit
 * repondre. `training-enrollment.exportResults` rend `ctx.notFound('Aucun
 * entrainement en cours')` — un 404 — quand la personne n'a encore choisi aucun
 * programme. C'est l'etat de depart de TOUT LE MONDE.
 *
 * Mais l'ecran passe cette erreur a `WithDataWrapper`, qui affiche son pave
 * d'erreur AVANT d'atteindre l'etat vide — pourtant deja ecrit et traduit
 * (`training.logbook.emptyTitle`, `TrainingLogbook.js:341-351`).
 *
 * 🍎 POURQUOI CE N'EST PAS COSMETIQUE : toute personne qui n'a pas commence de
 * programme voit cet ecran. L'examinateur d'Apple y compris. Un message d'erreur
 * technique sur un parcours nominal est un motif de refus.
 *
 * ⇒ La correction vit ICI, dans le service : c'est la couche qui connait le
 * contrat du serveur. Un 404 sur l'export veut dire « carnet vide », pas « panne ».
 */
describe('Le carnet d\'entrainement d\'une personne qui n\'a rien commence', () => {
  beforeEach(() => {
    client.get.mockReset();
  });

  test('un 404 « aucun entrainement en cours » rend un carnet VIDE', async () => {
    client.get.mockRejectedValue({
      response: {
        data: { error: { message: 'Aucun entrainement en cours', status: 404 } },
        status: 404,
      },
      status: 404,
    });

    await expect(exportTrainingResults()).resolves.toEqual({ csv: '', rows: 0 });
  });

  test('la meme chose quand le code n\'est lisible que dans le corps de la reponse', async () => {
    // 🪤 L'intercepteur de reponse deballe `response.data.error` : selon la couche,
    // le status se lit a la racine OU la-dedans. Les deux formes existent.
    client.get.mockRejectedValue({
      response: { data: { error: { message: 'Aucun entrainement en cours', status: 404 } } },
    });

    await expect(exportTrainingResults()).resolves.toEqual({ csv: '', rows: 0 });
  });

  test('⛔ une VRAIE panne remonte encore, elle n est pas un carnet vide', async () => {
    const panne = { message: 'Network Error' };
    client.get.mockRejectedValue(panne);
    await expect(exportTrainingResults()).rejects.toBe(panne);

    const erreurServeur = { response: { status: 500 }, status: 500 };
    client.get.mockRejectedValue(erreurServeur);
    await expect(exportTrainingResults()).rejects.toBe(erreurServeur);
  });

  test('un carnet qui a des lignes est rendu tel quel', async () => {
    const csv = 'date;test\n2026-09-10;SAUT';
    client.get.mockResolvedValue({ data: { data: { csv, rows: 1 } } });

    await expect(exportTrainingResults()).resolves.toEqual({ csv, rows: 1 });
  });
});
