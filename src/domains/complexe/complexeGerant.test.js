import {
  CHOIX_ANNULATION,
  distanceLisible,
  ficheComplete,
  messageDeRefus,
  payloadDeCreation,
  telephoneAPreRemplir,
} from './complexeGerant';

// RESA-L5A1 (13/10/2026) — E-G01 « Devenir gérant » : ce que l'écran envoie, ce qu'il pré-remplit,
// et les refus du serveur nommés (contrat d'API L1, codes dans `error.details.code`).

/**
 * Un `t` de témoin : il rend le libellé par défaut, interpolé.
 * @param {string} _cle - La clé (ignorée).
 * @param {string} defaut - Le libellé par défaut.
 * @param {Record<string, any>} [valeurs] - Les valeurs.
 * @returns {string} Le libellé.
 */
const t = (_cle, defaut, valeurs = {}) => String(defaut).replace(
  /{{(\w+)}}/g,
  (_tout, nom) => String(valeurs[nom]),
);

const ADRESSE = {
  city: 'Montrivage',
  label: '12 allée des Sports, Montrivage',
  lat: 48.83,
  lng: 1.48,
};

describe('RESA-L5A1 E-G01 — le téléphone du complexe n’est jamais celui d’un mineur', () => {
  it('pré-rempli pour un adulte', () => {
    expect(telephoneAPreRemplir({ birthdate: '1990-05-01', phoneNumber: '+33639981234' }))
      .toBe('+33639981234');
  });

  it('jamais pour un mineur, ni sans date de naissance (prudence)', () => {
    const quinzeAns = new Date();
    quinzeAns.setFullYear(quinzeAns.getFullYear() - 15);
    const mineur = quinzeAns.toISOString().slice(0, 10);
    expect(telephoneAPreRemplir({ birthdate: mineur, phoneNumber: '+33639981234' })).toBe('');
    expect(telephoneAPreRemplir({ phoneNumber: '+33639981234' })).toBe('');
    expect(telephoneAPreRemplir(null)).toBe('');
  });
});

describe('RESA-L5A1 E-G01 — l’étape 1 complète', () => {
  const fiche = {
    adresse: ADRESSE,
    nom: 'Le Five de Montrivage',
    siret: '',
    sports: ['a-five'],
    telephone: '+33639981234',
  };

  it('nom, adresse avec sa position, téléphone et au moins un sport', () => {
    expect(ficheComplete(fiche)).toBe(true);
    expect(ficheComplete({ ...fiche, nom: ' L ' })).toBe(false);
    expect(ficheComplete({ ...fiche, adresse: { label: 'Montrivage' } })).toBe(false);
    expect(ficheComplete({ ...fiche, telephone: '' })).toBe(false);
    expect(ficheComplete({ ...fiche, sports: [] })).toBe(false);
  });

  it('le SIRET est facultatif, mais 14 chiffres s’il est donné', () => {
    expect(ficheComplete({ ...fiche, siret: '123 456 789 00012' })).toBe(true);
    expect(ficheComplete({ ...fiche, siret: '1234' })).toBe(false);
  });
});

describe('RESA-L5A1 E-G01 — ce que « Créer mon complexe » envoie', () => {
  it('la liste blanche du serveur, et rien d’autre', () => {
    expect(payloadDeCreation({
      accepte: true,
      adresse: ADRESSE,
      ageMinimum: 16,
      annulation: 24,
      nom: '  Le Five de Montrivage ',
      siret: '123 456 789 00012',
      sports: ['a-five', 'a-padel'],
      telephone: '+33639981234',
    })).toEqual({
      acceptRules: true,
      address: { label: '12 allée des Sports, Montrivage', lat: 48.83, lng: 1.48 },
      addressLabel: '12 allée des Sports, Montrivage',
      cancellationDelayHours: 24,
      city: 'Montrivage',
      coordinates: { lat: 48.83, lng: 1.48 },
      minAge: 16,
      name: 'Le Five de Montrivage',
      phoneNumber: '+33639981234',
      siret: '12345678900012',
      sports: ['a-five', 'a-padel'],
    });
  });

  it('« Non, continuer » : forceCreate ; sans SIRET ni ville, rien n’est inventé', () => {
    const corps = payloadDeCreation({
      accepte: true,
      adresse: { label: 'Montrivage', lat: 1, lng: 2 },
      ageMinimum: 18,
      annulation: 0,
      nom: 'Le Five',
      siret: '',
      sports: ['a-five'],
      telephone: '+33639981234',
    }, { forcer: true });
    expect(corps.forceCreate).toBe(true);
    expect(corps).not.toHaveProperty('siret');
    expect(corps).not.toHaveProperty('city');
  });

  it('les six délais d’annulation du serveur (0, 2, 6, 12, 24, 48 h)', () => {
    expect(CHOIX_ANNULATION).toEqual([0, 2, 6, 12, 24, 48]);
  });
});

describe('RESA-L5A1 — les refus du serveur, nommés', () => {
  const refus = (/** @type {string} */ code, message = '') => ({
    details: { code },
    message,
    status: 400,
  });

  it('chaque code du contrat a sa phrase', () => {
    expect(messageDeRefus(t, refus('COMPLEXE_ALREADY_MANAGED'), 'repli'))
      .toBe('Tu gères déjà un complexe.');
    expect(messageDeRefus(t, refus('COMPLEXE_RULES_NOT_ACCEPTED'), 'repli'))
      .toBe('Accepte les règles d’utilisation des complexes pour continuer.');
    expect(messageDeRefus(t, refus('COMPLEXE_RETIRED'), 'repli'))
      .toBe('Ce complexe a été retiré de FoundClub.');
    expect(messageDeRefus(t, refus('COMPLEXE_TERRAIN_LIMIT'), 'repli'))
      .toBe('Un complexe compte 30 terrains au plus.');
    expect(messageDeRefus(t, refus('COMPLEXE_FILE_NOT_ALLOWED'), 'repli'))
      .toBe('Cette photo est déjà utilisée ailleurs : choisis-en une autre.');
    expect(messageDeRefus(t, refus('COMPLEXE_NOT_FOUND'), 'repli'))
      .toBe('Ce complexe est introuvable, ou tu ne le gères plus.');
    expect(messageDeRefus(t, refus('COMPLEXE_TERRAIN_NOT_FOUND'), 'repli'))
      .toBe('Ce terrain est introuvable.');
  });

  it('un champ refusé : la phrase précise du serveur', () => {
    const champ = refus('COMPLEXE_INVALID_PAYLOAD', 'Le SIRET compte 14 chiffres.');
    expect(messageDeRefus(t, champ, 'repli'))
      .toBe('Le SIRET compte 14 chiffres.');
    expect(messageDeRefus(
      t,
      refus('COMPLEXE_CRENEAUX_INVALID', 'La fin doit être après le début.'),
      'repli',
    )).toBe('La fin doit être après le début.');
  });

  it('hors connexion : « tes informations sont gardées » ; sinon le repli de l’écran', () => {
    expect(messageDeRefus(t, { code: 'REQUEST_TIMEOUT_ABANDONED', status: 0 }, 'repli'))
      .toBe('Pas de connexion : tes informations sont gardées.');
    expect(messageDeRefus(t, new Error('Network Error'), 'repli'))
      .toBe('Pas de connexion : tes informations sont gardées.');
    const repli = 'La création n’a pas abouti. Réessaie.';
    expect(messageDeRefus(t, { message: 'boum', status: 500 }, repli))
      .toBe('La création n’a pas abouti. Réessaie.');
  });
});

describe('RESA-L5A1 E-G01 — la distance du doublon possible', () => {
  it('« 300 m », « 1,2 km »', () => {
    expect(distanceLisible(300)).toBe('300 m');
    expect(distanceLisible(1240)).toBe('1,2 km');
    expect(distanceLisible(null)).toBe('');
  });
});
