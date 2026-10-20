// RESA-L6B-1 (19/10/2026) — LES BOUTONS DE N-20 « Tu confirmes ta réservation de demain ? ».
//
// Plan E-P14 (« Je confirme » / « J'annule » sans ouvrir l'app), planche EP14 état 1 (« J'annule »
// puis « Je confirme »). Contrat FIGÉ avec le lot serveur RESA-L2C : catégorie
// `RESA_VEILLE_CATEGORY`, actions `resa_veille_confirmer` / `resa_veille_annuler`, contexte
// `resa_veille` ; la réponse part par `POST /reservations-terrain/:id/veille { data: { reponse } }`
// (serveur RESA-L2B). Modèle suivi pas à pas : les boutons de présence (`rsvpActions.js`).
// Tant que RESA-L2C n'est pas récolté, le serveur n'envoie pas la catégorie : ces témoins simulent
// une notification QUI LA PORTE.
// Interrupteur `COMPLEXES_JOUEUR` éteint : aucune catégorie de plus, aucun bouton, comme staging.

const mockPost = jest.fn();
const mockDisplay = jest.fn(async () => undefined);
const mockCategories = jest.fn(async () => undefined);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'canal'),
    displayNotification: (...args) => mockDisplay(...args),
    setNotificationCategories: (...args) => mockCategories(...args),
  },
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

// Le module se recharge dans un bac isolé (interrupteur doublé) : i18next y serait neuf, jamais
// initialisé. La doublure du projet rend le français de fr.js, comme l'app.
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  activateSessionForNotificationPayload: jest.fn(async () => ({
    session: { token: 'jeton-du-compte-vise' },
  })),
}));

const fr = require('@/theme/strings/translations/fr').default;

/**
 * Le module des actions, l'interrupteur à la valeur voulue.
 * @param {boolean} allume - `COMPLEXES_JOUEUR`.
 * @returns {any} Le module, et ses constantes.
 */
const charger = (allume) => {
  let modules;
  jest.isolateModules(() => {
    jest.doMock('@/config/fonctionsMasquees', () => ({
      ...jest.requireActual('@/config/fonctionsMasquees'),
      COMPLEXES_JOUEUR: allume,
    }));
    /* eslint-disable global-require -- chargés APRÈS la doublure de l'interrupteur */
    modules = {
      ...require('../constants'),
      ...require('../rsvpActions'),
    };
    /* eslint-enable global-require */
  });
  return modules;
};

/**
 * N-20 telle que le serveur l'enverra après RESA-L2C.
 * @param {Record<string, unknown>} [autres] - Ce qui change.
 * @returns {Record<string, unknown>} La charge.
 */
const veille = (autres = {}) => ({
  actionContext: 'resa_veille',
  change: 'veille',
  hourLabel: '19 h',
  reservationId: 'r-1',
  targetUserDocumentId: 'julien-doc',
  type: 'complexeReservationJoueur',
  ...autres,
});

/**
 * La dernière notification affichée.
 * @returns {any} Sa description notifee.
 */
const derniere = () => mockDisplay.mock.calls.at(-1)?.[0];

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { data: { documentId: 'r-1' } } });
  mockDisplay.mockClear();
  mockCategories.mockClear();
});

afterEach(() => {
  jest.resetModules();
});

describe('RESA-L6B-1 — le contrat figé avec RESA-L2C', () => {
  it('la catégorie, les deux actions et le contexte, au caractère près', () => {
    const constantes = charger(true);
    expect(constantes.RESA_VEILLE_CATEGORY).toBe('RESA_VEILLE_CATEGORY');
    expect(constantes.RESA_VEILLE_ACTION_CONFIRMER).toBe('resa_veille_confirmer');
    expect(constantes.RESA_VEILLE_ACTION_ANNULER).toBe('resa_veille_annuler');
    expect(constantes.RESA_VEILLE_ACTION_CONTEXT).toBe('resa_veille');
  });

  it('N-20 porte les boutons ; pas les autres changements, ni sans réservation', () => {
    const { isResaVeilleActionablePayload } = charger(true);
    expect(isResaVeilleActionablePayload(veille())).toBe(true);
    // Un serveur qui ne pose pas encore le contexte (comme le rappel d'événement).
    expect(isResaVeilleActionablePayload(veille({ actionContext: undefined }))).toBe(true);
    expect(isResaVeilleActionablePayload(veille({ change: 'acceptee' }))).toBe(false);
    expect(isResaVeilleActionablePayload(veille({ reservationId: '' }))).toBe(false);
    expect(isResaVeilleActionablePayload(veille({ actionContext: 'event_rsvp' }))).toBe(false);
  });
});

describe('RESA-L6B-1 — les boutons, sur iOS et sur Android', () => {
  it('iOS : la catégorie s’enregistre, « J’annule » puis « Je confirme », traduits', async () => {
    const { ensureNotificationActionSetup } = charger(true);
    await ensureNotificationActionSetup();
    const categories = mockCategories.mock.calls.at(-1)?.[0] || [];
    const resa = categories.find((/** @type {any} */ c) => c?.id === 'RESA_VEILLE_CATEGORY');
    expect(resa?.actions.map((/** @type {any} */ a) => [a.id, a.title])).toEqual([
      ['resa_veille_annuler', fr.rsvpActions.resaVeille.annuler],
      ['resa_veille_confirmer', fr.rsvpActions.resaVeille.confirmer],
    ]);
    expect(fr.rsvpActions.resaVeille.annuler).toBe('J’annule');
    expect(fr.rsvpActions.resaVeille.confirmer).toBe('Je confirme');
  });

  it('Android : la notification porte les MÊMES boutons, et la catégorie iOS', async () => {
    const { displayResaVeilleActionableNotification } = charger(true);
    await displayResaVeilleActionableNotification({
      body: 'Tu confirmes ta réservation de demain 19 h au Five de Montrivage ?',
      data: veille(),
      title: 'Demain, tu joues ?',
    });
    const affichee = derniere();
    expect(affichee.android.actions.map((/** @type {any} */ a) => [a.pressAction.id, a.title]))
      .toEqual([
        ['resa_veille_annuler', 'J’annule'],
        ['resa_veille_confirmer', 'Je confirme'],
      ]);
    expect(affichee.ios.categoryId).toBe('RESA_VEILLE_CATEGORY');
    expect(affichee.data)
      .toEqual(expect.objectContaining({ change: 'veille', reservationId: 'r-1' }));
  });
});

describe('RESA-L6B-1 — répondre sans ouvrir l’app', () => {
  it('« Je confirme » : la réponse part, au nom du compte visé, et le dit', async () => {
    const { handleResaVeilleActionPress } = charger(true);
    const resultat = await handleResaVeilleActionPress({
      notificationData: veille(),
      pressActionId: 'resa_veille_confirmer',
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/reservations-terrain/r-1/veille',
      { data: { reponse: 'confirme' } },
      { headers: { Authorization: 'Bearer jeton-du-compte-vise' } },
    );
    expect(resultat).toEqual({ handled: true, success: true });
    expect(derniere()).toEqual(expect.objectContaining({
      body: 'Merci, c’est confirmé.',
      title: 'Réservation confirmée',
    }));
  });

  it('« J’annule » : la réponse « annule » part, le créneau est libéré', async () => {
    const { handleResaVeilleActionPress } = charger(true);
    await handleResaVeilleActionPress({
      notificationData: veille(),
      pressActionId: 'resa_veille_annuler',
    });
    expect(mockPost.mock.calls[0][1]).toEqual({ data: { reponse: 'annule' } });
    expect(derniere()).toEqual(expect.objectContaining({
      body: 'Le créneau est libéré.',
      title: 'Réservation annulée',
    }));
  });

  it('échec : PAS de silence — une notification visible, qui rouvre la question', async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error('Conflict'), { status: 409 }));
    const { handleResaVeilleActionPress } = charger(true);
    const resultat = await handleResaVeilleActionPress({
      notificationData: veille(),
      pressActionId: 'resa_veille_confirmer',
    });
    expect(resultat).toEqual({ handled: true, success: false });
    const echec = derniere();
    expect(echec.title).toBe('Réponse non envoyée');
    expect(echec.body).toBe('Touche ici pour répondre dans l’app.');
    // Le canal ordinaire (son, bannière), pas le canal silencieux des confirmations.
    expect(echec.android.channelId).toBe('default');
    // La charge reste : toucher l'échec ouvre E-P14 (aiguillage `change: 'veille'`).
    expect(echec.data).toEqual(expect.objectContaining({
      change: 'veille', reservationId: 'r-1', type: 'complexeReservationJoueur',
    }));
  });

  it('un autre bouton (présence, réponse rapide) ne passe pas par ici', async () => {
    const { handleResaVeilleActionPress } = charger(true);
    expect(await handleResaVeilleActionPress({
      notificationData: veille(), pressActionId: 'event_rsvp_present',
    })).toEqual({ handled: false });
    expect(await handleResaVeilleActionPress({
      notificationData: { eventId: 'e-1', type: 'eventReminder' },
      pressActionId: 'resa_veille_confirmer',
    })).toEqual({ handled: false });
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('RESA-L6B-1 — interrupteur éteint : comme staging', () => {
  it('aucune catégorie de plus, aucun bouton, aucune réponse', async () => {
    const eteint = charger(false);
    await eteint.ensureNotificationActionSetup();
    const ids = (mockCategories.mock.calls.at(-1)?.[0] || []).map((/** @type {any} */ c) => c.id);
    expect(ids)
      .toEqual(['EVENT_RSVP_CATEGORY', 'CHAT_REPLY_CATEGORY', 'CHAT_REPLY_RETRY_CATEGORY']);
    expect(eteint.isResaVeilleActionablePayload(veille())).toBe(false);
    expect(await eteint.handleResaVeilleActionPress({
      notificationData: veille(), pressActionId: 'resa_veille_confirmer',
    })).toEqual({ handled: false });
    expect(mockPost).not.toHaveBeenCalled();
  });
});
