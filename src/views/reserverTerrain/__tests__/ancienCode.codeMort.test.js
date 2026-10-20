const fs = require('fs');
const path = require('path');

const { RouteNames } = require('@/navigation/routeNames');
const { UNREGISTERED_WEB_PATTERNS } = require('@/navigation/webRouteExemptions');
const { WEB_ROUTE_PATTERNS } = require('@/navigation/webRoutes');

// RESA-L6A (14/10/2026) — LE CODE MORT DE L'ANCIENNE RÉSERVATION, RETIRÉ (plan §7 ligne L6 :
// « retirer le code mort APRÈS témoins », E6 ; dans le doute, on garde et on liste).
//
// La carte (R2, faite avant de retirer) : ces 8 éléments n'étaient atteints par RIEN —
//   · 3 composants jamais importés : FeaturedReservationCard, ReservationCard (un README
//     seulement), ReservationModeModal ;
//   · BookingConfigModal, importé par le seul BookingCalendar.js (téléphone) ;
//   · BookingCalendar.js et MissingPlayersView.js (téléphone) : déclarés dans PrivateNavigator,
//     mais
//     0 `navigate` vers eux sur le téléphone, 0 chemin dans les liens du téléphone, 0 `ctaRoute` du
//     serveur (admin origin/staging : 0 occurrence) ; le SITE sert leurs jumeaux .web.js, qui
//     RESTENT ;
//   · createReservation et reservationSchema : 0 appelant (pas même une doublure de témoin).
// GARDÉS et listés (atteignables par une adresse du site, ou dans le doute) :
// BookingCalendar.web.js, MissingPlayersView.web.js, ReservationEdit.web.js, ReservationFilters.js,
// SearchReservationsScreen.js, ReservationListContent.js, ReservationDetails(.web).js, et la
// fonction searchCatalogs du dépôt web.

const SRC = path.resolve(__dirname, '..', '..', '..');

const RETIRES = [
  'components/molecules/featuredReservationCard/FeaturedReservationCard.js',
  'components/molecules/reservationCard/ReservationCard.js',
  'components/organisms/reservationModeModal/ReservationModeModal.js',
  'components/organisms/bookingConfigModal/BookingConfigModal.js',
  'views/booking/BookingCalendar.js',
  'views/reservation/MissingPlayersView.js',
];

const GARDES = [
  'views/booking/BookingCalendar.web.js',
  'views/reservation/MissingPlayersView.web.js',
  'views/reservation/ReservationEdit.web.js',
  'views/reservation/ReservationFilters.js',
  'views/reservation/ReservationDetails.js',
  'views/search/SearchReservationsScreen.js',
  'components/organisms/reservationListContent/ReservationListContent.js',
];

/**
 * Tous les fichiers sources de l'app (hors témoins).
 * @param {string} dossier - Le dossier.
 * @returns {string[]} Les chemins.
 */
const sources = (dossier) => fs.readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
  const chemin = path.join(dossier, entree.name);
  if (entree.isDirectory()) {
    return ['__tests__', 'node_modules'].includes(entree.name) ? [] : sources(chemin);
  }
  return /\.(js|ts|tsx)$/.test(entree.name) && !/\.test\./.test(entree.name) ? [chemin] : [];
});

describe('RESA-L6A — le code mort de l’ancienne réservation est retiré', () => {
  it.each(RETIRES)('%s n’existe plus', (fichier) => {
    expect(fs.existsSync(path.join(SRC, fichier))).toBe(false);
  });

  it('plus aucun fichier de l’app ne les importe', () => {
    const cibles = [
      'featuredReservationCard/FeaturedReservationCard',
      'reservationCard/ReservationCard',
      'reservationModeModal/ReservationModeModal',
      'bookingConfigModal/BookingConfigModal',
    ];
    const coupables = sources(SRC).filter((fichier) => {
      const texte = fs.readFileSync(fichier, 'utf8');
      return cibles.some((cible) => texte.includes(cible));
    });
    expect(coupables).toEqual([]);
  });

  it('le téléphone ne déclare plus BookingCalendar ni MissingPlayersView ; le site oui', () => {
    const navigateur = fs.readFileSync(
      path.join(SRC, 'navigation', 'private', 'PrivateNavigator.js'),
      'utf8',
    );
    expect(navigateur).not.toContain('RouteNames.BookingCalendar}');
    expect(navigateur).not.toContain('RouteNames.MissingPlayersView}');
    // Les adresses du site restent, déclarées « sans écran du téléphone ».
    expect(WEB_ROUTE_PATTERNS[RouteNames.BookingCalendar]).toBe('/booking');
    expect(WEB_ROUTE_PATTERNS[RouteNames.MissingPlayersView]).toBe('/booking/missing-players');
    expect(UNREGISTERED_WEB_PATTERNS).toHaveProperty(RouteNames.BookingCalendar);
    expect(UNREGISTERED_WEB_PATTERNS).toHaveProperty(RouteNames.MissingPlayersView);
  });

  it.each(GARDES)('%s est GARDÉ (atteignable par le site, ou dans le doute)', (fichier) => {
    expect(fs.existsSync(path.join(SRC, fichier))).toBe(true);
  });

  it('le service de l’ancienne réservation garde ses fonctions vivantes, sans les mortes', () => {
    // Lu comme un texte : charger le module tirerait le vrai client HTTP (adresse du serveur).
    const service = fs.readFileSync(
      path.join(SRC, 'services', 'reservation', 'reservationService.js'),
      'utf8',
    );
    expect(service).not.toMatch(/export const (createReservation|reservationSchema)\b/);
    expect(service).not.toMatch(/\bJoi\b/);
    [
      'bookFullReservation',
      'getFeaturedReservations',
      'getReservations',
      'joinReservation',
      'openForPlayers',
      'triggerSosAlert',
    ].forEach((nom) => {
      expect(service).toMatch(new RegExp(`export const ${nom} = `));
    });
  });
});
