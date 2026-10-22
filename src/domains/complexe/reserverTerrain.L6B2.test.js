import { reactI18next } from '@/theme/strings/__mocks__/doublureTraduction';

import {
  contenuDEchec,
  demandeDeReservation,
  etatAffiche,
  varianteDEchec,
  varianteDeLaReservation,
} from './reserverTerrain';

// RESA-L6B-2 (20/10/2026) — ce que le serveur RESA-L3 ajoute aux règles du joueur : « Pour mon
// équipe » et la collecte dans le corps de « Réserver » (E-P04), les états « en collecte » et
// « non aboutie » (P00 bloc 4), les refus neufs (contrat : `_COMPLETE`, `_LIEN_INVALIDE`,
// `_EQUIPE`, `_ANNONCE_DEJA`) et les variantes de E-P13 de la collecte (planche EP13, 1, 2, 7).

const { t } = reactI18next.useTranslation();

describe('E-P04 — le corps de « Réserver » : l’équipe et la collecte', () => {
  const base = {
    date: '2026-10-16', from: '18:00', joueurs: 10, terrainId: 't-1',
  };

  it('pour mon équipe : son documentId, rien d’autre', () => {
    expect(demandeDeReservation({ ...base, equipe: 'team-u15' })).toEqual({
      date: '2026-10-16',
      from: '18:00',
      note: null,
      phoneShared: false,
      players: 10,
      team: 'team-u15',
      terrain: 't-1',
    });
  });

  it('la collecte : le nombre requis ET la date limite, ou rien', () => {
    expect(demandeDeReservation({
      ...base,
      collecte: { collectDeadline: '2026-10-15T16:00:00.000Z', quorum: 8 },
    })).toEqual(expect.objectContaining({
      collectDeadline: '2026-10-15T16:00:00.000Z',
      quorum: 8,
    }));
    const sansDate = demandeDeReservation({
      ...base, collecte: { collectDeadline: null, quorum: 8 },
    });
    expect(sansDate).not.toHaveProperty('quorum');
    expect(sansDate).not.toHaveProperty('collectDeadline');
    expect(demandeDeReservation(base)).not.toHaveProperty('team');
  });
});

describe('P00 bloc 4 — « En collecte » et « Non aboutie »', () => {
  it('les deux états neufs du serveur', () => {
    expect(etatAffiche({ status: 'en_collecte' })).toBe('enCollecte');
    expect(etatAffiche({ status: 'non_aboutie' })).toBe('nonAboutie');
  });

  it('un participant ne sait pas qui a annulé : « Annulée »', () => {
    expect(etatAffiche({ role: 'participant', status: 'annulee' })).toBe('annulee');
    expect(etatAffiche({ cancelledBy: 'reserveur', status: 'annulee' })).toBe('annuleeParToi');
  });
});

describe('E-P07 en-tête — les variantes d’une réservation qui ne se joue plus', () => {
  it('collecte arrêtée : créneau pris (N-23) ou date limite (N-24)', () => {
    expect(varianteDeLaReservation({ status: 'non_aboutie' }, { echecDeCollecte: 'creneau_pris' }))
      .toBe('collectePrise');
    expect(varianteDeLaReservation({ status: 'non_aboutie' }, { echecDeCollecte: 'delai' }))
      .toBe('collecteDelai');
    expect(varianteDeLaReservation({ status: 'non_aboutie' }, { change: 'collecte-creneau-pris' }))
      .toBe('collectePrise');
    expect(varianteDeLaReservation({ status: 'non_aboutie' }, {})).toBe('collecteDelai');
  });

  it('un participant : annulée par le réserveur (N-33), par le complexe, ou sans le savoir', () => {
    const annulee = { role: 'participant', status: 'annulee' };
    expect(varianteDeLaReservation(annulee, { change: 'annulee-par-reserveur' }))
      .toBe('annuleeParLeReserveur');
    expect(varianteDeLaReservation(annulee, { change: 'annulee' })).toBe('annuleeParLeComplexe');
    expect(varianteDeLaReservation(annulee, { change: 'fermeture' })).toBe('fermeture');
    expect(varianteDeLaReservation(annulee, {})).toBe('partieAnnulee');
    expect(varianteDeLaReservation({ status: 'en_collecte' })).toBeNull();
  });
});

describe('les refus neufs du serveur RESA-L3', () => {
  it.each([
    ['COMPLEXE_RESERVATION_COMPLETE', 'complete'],
    ['COMPLEXE_RESERVATION_LIEN_INVALIDE', 'lienInvalide'],
    ['COMPLEXE_RESERVATION_EQUIPE', 'equipe'],
    ['COMPLEXE_RESERVATION_ANNONCE_DEJA', 'annonceDeja'],
  ])('%s ⇒ %s', (code, variante) => {
    expect(varianteDEchec({ details: { code }, status: 409 })).toBe(variante);
  });
});

describe('E-P13 — les variantes de la collecte et de la partie (planche EP13)', () => {
  it('1 · créneau pris pendant la collecte : A-P08 au « tu », mot pour mot (AT-10 B)', () => {
    expect(contenuDEchec(t, 'collectePrise')).toEqual(expect.objectContaining({
      actions: ['autresCreneaux', 'ailleurs'],
      texte: 'Désolé, ta réservation n’a pas pu aboutir : quelqu’un a réservé le créneau avant que '
        + 'tu réunisses assez de joueurs.',
      titre: 'Réservation non aboutie',
      ton: 'cyan',
    }));
  });

  it('2 · date limite passée : « 7 joueurs sur 10 ont répondu présent avant lundi 18 h »', () => {
    expect(contenuDEchec(t, 'collecteDelai', {
      collecte: { collectDeadline: '2026-10-12T16:00:00.000Z', presents: 7, quorum: 10 },
    })).toEqual(expect.objectContaining({
      actions: ['relancer'],
      texte: '7 joueurs sur 10 ont répondu présent avant lundi 18 h : rien n’est réservé.',
      titre: 'La collecte n’a pas abouti',
      ton: 'cyan',
    }));
    expect(contenuDEchec(t, 'collecteDelai').texte)
      .toBe('Le nombre de joueurs n’a pas été atteint à temps : rien n’est réservé.');
  });

  it('7 · annulée par le réserveur : ce que lisent les participants', () => {
    expect(contenuDEchec(t, 'annuleeParLeReserveur', {
      debut: '2026-10-13T16:00:00.000Z', reserveur: 'Julien M.',
    })).toEqual(expect.objectContaining({
      actions: ['reserverUnTerrain'],
      texte: 'Julien M. a annulé la partie de mardi 18 h.',
      titre: 'Partie annulée',
    }));
    expect(contenuDEchec(t, 'partieAnnulee').texte).toBe('Cette partie a été annulée.');
  });

  it('rejoindre une partie : banni, âge, complète, lien, équipe, annonce déjà publiée', () => {
    expect(contenuDEchec(t, 'banni', { rejoindre: true }).titre)
      .toBe('Tu ne peux pas rejoindre une partie dans ce complexe.');
    expect(contenuDEchec(t, 'banni').titre).toBe('Tu ne peux plus réserver dans ce complexe.');
    expect(contenuDEchec(t, 'age', {
      erreur: { details: { minAge: 16 } }, rejoindre: true,
    }).titre).toBe('Ce complexe accepte les joueurs à partir de 16 ans.');
    expect(contenuDEchec(t, 'complete').titre).toBe('La partie est complète.');
    expect(contenuDEchec(t, 'lienInvalide').titre)
      .toBe('Ce lien n’est plus valable. Demande-en un autre à la personne qui t’a invité.');
    expect(contenuDEchec(t, 'equipe', {
      erreur: { message: 'Tu n’encadres pas cette équipe.' },
    }).titre).toBe('Tu n’encadres pas cette équipe.');
    expect(contenuDEchec(t, 'annonceDeja').titre)
      .toBe('Tu as déjà publié une annonce pour cette partie.');
  });
});
