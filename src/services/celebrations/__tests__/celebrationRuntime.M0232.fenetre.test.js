import { Alert } from 'react-native';

import { celebrate, subscribeToCelebrations } from '../celebrationRuntime';

// RETOURS-TESTEUR-2 (06/11/2026, M0232, décision du chef « B ») — après « Créer » sur une
// installation de la Ville, un bandeau bleu de 4 s disait « Demande envoyée » ; le testeur veut
// « plus visible, au risque qu'il soit supprimé ». Une fenêtre à fermer soi-même, avec
// « Si la mairie refuse, la séance sera annulée. », remplace le bandeau.

describe('M0232 — la demande à la Ville se dit dans une fenêtre', () => {
  /** @type {any[]} */
  let bandeaux;
  /** @type {() => void} */
  let desabonner;
  beforeEach(() => {
    bandeaux = [];
    desabonner = subscribeToCelebrations((payload) => bandeaux.push(payload));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    desabonner();
    jest.restoreAllMocks();
  });

  it('une fenêtre, avec la phrase du refus ; plus de bandeau', () => {
    celebrate('event_city_request_sent', { clubId: 'club-1', ville: 'Ville de Lyon' });
    expect(bandeaux).toHaveLength(0);
    const [titre, message, boutons] = /** @type {any} */ (Alert.alert).mock.calls[0];
    expect(titre).toBe('Demande envoyée à la Ville de Lyon');
    expect(message).toContain('Si la mairie refuse, la séance sera annulée.');
    expect(boutons.map((/** @type {any} */ b) => b.text))
      .toEqual(['J’ai compris', 'Voir mes demandes']);
  });

  it('les autres célébrations gardent leur bandeau', () => {
    celebrate('event_created', { eventId: 'e1', eventName: 'Match' });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(bandeaux.length).toBe(1);
  });
});
