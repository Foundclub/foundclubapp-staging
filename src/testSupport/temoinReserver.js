/**
 * LES DONNÉES D'EXEMPLE DES TÉMOINS DU JOUEUR — RESA-L6A (14/10/2026).
 *
 * Ce que rendent les routes publiques et de réservation du serveur (admin
 * `origin/feat/RESAL2A-admin` f76ddb38 : `services/recherche.ts`, `services/terrain.ts`
 * `toPublicTerrain` / `publicSlots`, `services/complexe.ts` `toPublicView`,
 * `utils/reservation.ts` `toPlayerView`), avec les données
 * fictives de la toile validée (« Le Five de Montrivage », Terrain 1, Padel A, 06 39 98 12 34).
 * Les outils de lecture de l'arbre restent ceux du gérant (`temoinComplexe.js`).
 */

/**
 * Une carte de la recherche (`GET /public-complexes`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La carte.
 */
const carteDeRecherche = (autres = {}) => ({
  city: 'Montrivage',
  distanceKm: 2.4,
  freeSlotsCount: 3,
  logo: null,
  name: 'Le Five de Montrivage',
  phoneOnly: false,
  slots: [
    {
      from: '18:00',
      price: { amount: 60, perPlayer: 6, unit: 'creneau' },
      startsAt: '2026-10-14T16:00:00.000Z',
      terrain: { bookingMode: 'automatique', documentId: 't-1', name: 'Terrain 1' },
      to: '19:00',
    },
    {
      from: '19:00',
      price: { amount: 60, perPlayer: 6, unit: 'creneau' },
      startsAt: '2026-10-14T17:00:00.000Z',
      terrain: { bookingMode: 'automatique', documentId: 't-1', name: 'Terrain 1' },
      to: '20:00',
    },
    {
      from: '20:30',
      price: { amount: 6, perPlayer: 6, unit: 'joueur' },
      startsAt: '2026-10-14T18:30:00.000Z',
      terrain: { bookingMode: 'telephone', documentId: 't-padel', name: 'Padel A' },
      to: '22:00',
    },
  ],
  slug: 'le-five-de-montrivage',
  sports: ['Football à 5', 'Padel'],
  ...autres,
});

/**
 * La page publique d'un complexe (`GET /public-complexes/:slug`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le complexe.
 */
const complexePublic = (autres = {}) => ({
  address: { label: '12 allée des Sports, Montrivage', lat: 48.8365, lng: 1.484 },
  city: 'Montrivage',
  description: 'Deux terrains de foot à 5 et un padel en plein air, vestiaires et douches.',
  documentId: 'cx-five',
  email: null,
  kind: 'complexe',
  logo: null,
  name: 'Le Five de Montrivage',
  openingHours: [
    { day: 1, ranges: [{ from: '17:00', to: '23:00' }] },
    { day: 6, ranges: [{ from: '09:00', to: '22:00' }] },
  ],
  phoneNumber: '+33639981234',
  photos: [],
  playersNote: 'Arrive 10 minutes avant, chasubles à l’accueil.',
  rules: { cancellationDelayHours: 24, minAge: 16 },
  slug: 'le-five-de-montrivage',
  sports: [
    { documentId: 'a-five', name: 'Football à 5' },
    { documentId: 'a-padel', name: 'Padel' },
  ],
  verified: false,
  websiteUrl: 'https://lefive-montrivage.fr',
  ...autres,
});

/**
 * Un terrain de la page publique (`GET /public-complexes/:slug/terrains`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le terrain.
 */
const terrainPublic = (autres = {}) => ({
  bookingMode: 'automatique',
  capacity: 10,
  documentId: 't-1',
  name: 'Terrain 1',
  phone: null,
  photos: [],
  price: { max: 60, min: 60, unit: 'creneau' },
  setting: 'exterieur',
  sport: { documentId: 'a-five', name: 'Football à 5' },
  ...autres,
});

/**
 * Un créneau d'un jour (`GET …/terrains/:terrainId/creneaux?date=`).
 * @param {string} from - « HH:MM ».
 * @param {string} to - « HH:MM ».
 * @param {string} [state] - `libre | pris | ferme | trop-tard`.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le créneau.
 */
const creneau = (from, to, state = 'libre', autres = {}) => ({
  endsAt: `2026-10-14T${to}:00.000Z`,
  from,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  startsAt: `2026-10-14T${from}:00.000Z`,
  state,
  to,
  ...autres,
});

/**
 * Le récapitulatif `dryRun` (`POST /reservations-terrain`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le récapitulatif.
 */
const recapitulatif = (autres = {}) => ({
  cancellableUntil: '2026-10-15T16:00:00.000Z',
  canSharePhone: true,
  complexe: {
    cancellationDelayHours: 24,
    name: 'Le Five de Montrivage',
    phoneNumber: '+33639981234',
    playersNote: 'Arrive 10 minutes avant, chasubles à l’accueil.',
    slug: 'le-five-de-montrivage',
  },
  date: '2026-10-16',
  dryRun: true,
  endsAt: '2026-10-16T17:00:00.000Z',
  expiresAt: null,
  from: '18:00',
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  startsAt: '2026-10-16T16:00:00.000Z',
  terrain: {
    bookingMode: 'automatique',
    capacity: 10,
    documentId: 't-1',
    name: 'Terrain 1',
    sport: { documentId: 'a-five', name: 'Football à 5' },
  },
  to: '19:00',
  willBe: 'confirmee',
  ...autres,
});

/**
 * Une réservation vue par son réserveur (`toPlayerView`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La réservation.
 */
const maReservation = (autres = {}) => ({
  canCancel: true,
  cancellableUntil: '2026-10-15T16:00:00.000Z',
  cancelledBy: null,
  complexe: {
    name: 'Le Five de Montrivage', phoneNumber: '+33639981234', slug: 'le-five-de-montrivage',
  },
  createdAt: '2026-10-12T19:04:00.000Z',
  date: '2026-10-16',
  documentId: 'r-1',
  endsAt: '2026-10-16T17:00:00.000Z',
  expiresAt: null,
  from: '18:00',
  note: 'Foot du jeudi',
  phoneShared: false,
  players: 10,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  reason: null,
  startsAt: '2026-10-16T16:00:00.000Z',
  status: 'confirmee',
  terrain: {
    documentId: 't-1', name: 'Terrain 1', sport: { documentId: 'a-five', name: 'Football à 5' },
  },
  to: '19:00',
  ...autres,
});

/**
 * RESA-L6B-2 — le groupe d'une réservation (`GET /reservations-terrain/:id/groupe`, serveur
 * RESA-L3 `toGroupView` + `extrasOf`), vu par son réserveur : 8 présents sur 10.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le groupe.
 */
const groupe = (autres = {}) => ({
  annonce: null,
  collecte: null,
  complete: false,
  conversation: null,
  counts: { absents: 1, presents: 8, sansReponse: 1 },
  discussion: null,
  equipe: null,
  lien: null,
  myResponse: 'present',
  participants: [
    {
      isBooker: true, isMe: true, label: 'Julien M.', response: 'present', via: 'reserveur',
    },
    ...['Karim B.', 'Sami A.', 'Lucas T.', 'Ilyes K.', 'Hugo P.', 'Adam R.', 'Yanis D.'].map(
      (label) => ({
        isBooker: false, isMe: false, label, response: 'present', via: 'lien',
      }),
    ),
    {
      isBooker: false, isMe: false, label: 'Théo L.', response: 'absent', via: 'lien',
    },
    {
      isBooker: false, isMe: false, label: 'Noah R.', response: 'sans_reponse', via: 'lien',
    },
  ],
  places: 10,
  reservation: 'r-1',
  role: 'reserveur',
  status: 'confirmee',
  ...autres,
});

/**
 * RESA-L6B-2 — la même réservation vue par un PARTICIPANT (`toParticipantView`) : ni annuler, ni
 * délais, le réserveur se dit « Julien M. ».
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La réservation.
 */
const reservationDeParticipant = (autres = {}) => ({
  bookerLabel: 'Julien M.',
  complexe: {
    name: 'Le Five de Montrivage', phoneNumber: '+33639981234', slug: 'le-five-de-montrivage',
  },
  date: '2026-10-16',
  documentId: 'r-1',
  endsAt: '2026-10-16T17:00:00.000Z',
  from: '18:00',
  myResponse: 'sans_reponse',
  note: null,
  players: 10,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  role: 'participant',
  startsAt: '2026-10-16T16:00:00.000Z',
  status: 'confirmee',
  terrain: {
    documentId: 't-1', name: 'Terrain 1', sport: { documentId: 'a-five', name: 'Football à 5' },
  },
  to: '19:00',
  ...autres,
});

/**
 * RESA-L6B-2 — la page d'une annonce (`GET /annonces-reservation/:id`, `lireAnnonce`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} L'annonce.
 */
const annonceDeReservation = (autres = {}) => ({
  canJoin: true,
  documentId: 'a-1',
  joined: 0,
  level: 'loisir',
  minAge: 16,
  notifyFavorites: true,
  participants: ['Julien M.', 'Karim B.', 'Sami A.', 'Théo L.', 'Noah R.', 'Lucas T.', 'Ilyes K.',
    'Hugo P.'],
  places: 2,
  reservation: {
    complexe: { city: 'Montrivage', name: 'Le Five de Montrivage', slug: 'le-five-de-montrivage' },
    date: '2026-10-16',
    endsAt: '2026-10-16T17:00:00.000Z',
    from: '18:00',
    price: { amount: 60, perPlayer: 6, unit: 'creneau' },
    startsAt: '2026-10-16T16:00:00.000Z',
    terrain: { name: 'Terrain 1', sport: 'Football à 5' },
    to: '19:00',
  },
  status: 'ouverte',
  ...autres,
});

module.exports = {
  annonceDeReservation,
  carteDeRecherche,
  complexePublic,
  creneau,
  groupe,
  maReservation,
  recapitulatif,
  reservationDeParticipant,
  terrainPublic,
};
