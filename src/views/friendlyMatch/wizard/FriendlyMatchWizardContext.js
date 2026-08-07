/* global globalThis */

import {
  createContext, useContext, useEffect, useMemo, useReducer,
} from 'react';

import { normalizeCandidateDates } from '@/domains/search/friendlyMatchFlow';

import safeJsonParse from '@/utils/safeJsonParse';

/**
 * Le brouillon de l assistant de publication d une annonce de match amical.
 *
 * Calque de views/recruitment/wizard/AdWizardContext.js, y compris sa reprise
 * par `sessionStorage` : sur le web chaque etape est une URL a part, sans pile
 * de navigation pour porter l etat — un rafraichissement effacerait tout.
 *
 * Aucune regle metier ici : elles vivent dans friendlyMatchWizardSteps.js.
 */

const FriendlyMatchWizardContext = createContext(/** @type {any} */ (undefined));
const FRIENDLY_MATCH_WIZARD_STORAGE_KEY = 'fc:web:friendly-match-wizard';

/** Rayon de depart, en km. Reprend le defaut du schema serveur, en plus large. */
const DEFAULT_TRAVEL_RADIUS_KM = 25;

const createInitialState = () => ({
  activity: null, // Activity { documentId, name } — le sport, il commande le catalogue de formats
  candidateDates: [], // [{ date: 'AAAA-MM-JJ', start?: 'HH:MM', end?: 'HH:MM' }]
  category: null, // Category { documentId, name }
  description: '',
  // D24 — la SEULE donnee de navigation du brouillon, et elle porte son nom :
  // le tunnel amical s ouvre soit depuis League, soit par la PORTE du tunnel
  // Evenement (D09). Publier doit effacer les DEUX tunnels ; sans cette valeur,
  // le recapitulatif devrait fouiller la pile de navigation pour le deviner —
  // ce qui casse au premier remaniement et ne se teste pas (lecon L40-B).
  // ⚠️ Elle ne part JAMAIS au serveur : buildFriendlyMatchAdPayload liste ce
  // qu il envoie, il ne recopie pas le brouillon.
  entryOrigin: '',
  format: '', // Valeur du catalogue par sport, ou 'Autre'
  formatOther: '', // Le texte libre quand format === 'Autre'
  hostingPreference: '', // HOST | AWAY | BOTH — jamais pre-rempli (Q1)
  installation: null, // Terrain propose, seulement si on recoit
  level: null, // Level { documentId, name }
  location: null, // Objet localisation { label, city, lat, lng, ... }
  refereeing: '',
  section: null, // Section { documentId, name }
  team: null, // Team { documentId, name, club, ... }
  travelRadiusKm: DEFAULT_TRAVEL_RADIUS_KM,
});

const canUseWizardStorage = () => (
  typeof globalThis !== 'undefined'
  && typeof globalThis.sessionStorage !== 'undefined'
);

const loadPersistedState = () => {
  const initialState = createInitialState();
  if (!canUseWizardStorage()) return initialState;

  try {
    const raw = globalThis.sessionStorage.getItem(FRIENDLY_MATCH_WIZARD_STORAGE_KEY);
    if (!raw) return initialState;

    const parsed = safeJsonParse(raw, null);
    if (!parsed || typeof parsed !== 'object') return initialState;

    return { ...initialState, ...parsed };
  } catch (_error) {
    return initialState;
  }
};

/**
 * La cle d un creneau : une date ne peut porter qu un creneau a la fois, sinon
 * l annonce proposerait deux heures pour le meme jour sans dire laquelle.
 * @param {any} slot
 * @returns {string}
 */
const getSlotKey = (slot) => String(slot?.date || '').trim();

/**
 * Applique une modification au brouillon. Aucune regle metier ici : le reducteur
 * range, il ne juge pas — c est friendlyMatchWizardSteps qui dit ce qui bloque.
 * @param {any} state
 * @param {any} action
 * @returns {any}
 */
function friendlyMatchWizardReducer(state, action) {
  switch (action.type) {
    case 'ADD_CANDIDATE_DATE': {
      const nextSlot = action.payload;
      const key = getSlotKey(nextSlot);
      if (!key) return state;
      const withoutSameDay = state.candidateDates.filter(
        (/** @type {any} */ slot) => getSlotKey(slot) !== key,
      );
      return {
        ...state,
        candidateDates: normalizeCandidateDates([...withoutSameDay, nextSlot]),
      };
    }

    case 'REMOVE_CANDIDATE_DATE':
      return {
        ...state,
        candidateDates: state.candidateDates.filter(
          (/** @type {any} */ slot) => getSlotKey(slot) !== String(action.payload || '').trim(),
        ),
      };

    case 'RESET':
      return createInitialState();

    case 'SET_CANDIDATE_DATES':
      return { ...state, candidateDates: normalizeCandidateDates(action.payload) };

    case 'SET_CATEGORY':
      return { ...state, category: action.payload };

    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };

    // Toujours ecrit, meme vide : sur le web le brouillon survit dans
    // `sessionStorage`, et une origine gardee d une ouverture precedente ferait
    // effacer un tunnel qui n a jamais ete ouvert.
    case 'SET_ENTRY_ORIGIN':
      return { ...state, entryOrigin: String(action.payload || '').trim() };

    case 'SET_FORMAT':
      return { ...state, format: action.payload };

    case 'SET_FORMAT_OTHER':
      return { ...state, formatOther: action.payload };

    case 'SET_HOSTING_PREFERENCE':
      // « Je me deplace » : le terrain propose n a plus de sens, on le lache
      // tout de suite plutot que de l envoyer et de le laisser trainer en base.
      return {
        ...state,
        hostingPreference: action.payload,
        installation: action.payload === 'AWAY' ? null : state.installation,
      };

    case 'SET_INSTALLATION':
      return { ...state, installation: action.payload };

    case 'SET_LEVEL':
      return { ...state, level: action.payload };

    case 'SET_LOCATION_SELECTION':
      return {
        ...state,
        installation: action.payload?.installation || null,
        location: action.payload?.location || null,
      };

    case 'SET_REFEREEING':
      return { ...state, refereeing: action.payload };

    case 'SET_TEAM': {
      // L equipe pre-remplit ce qu elle sait deja : sport, categorie, niveau,
      // section et adresse. Tout reste modifiable ensuite — c est un point de
      // depart, pas une contrainte.
      const team = action.payload;
      return {
        ...state,
        activity: team?.activities?.[0] || team?.sport || null,
        category: team?.category || null,
        // Le sport change : un format de football n a rien a faire au handball.
        format: '',
        formatOther: '',
        level: team?.level || null,
        location: state.location || team?.address || team?.club?.address || null,
        section: team?.section || null,
        team,
      };
    }

    case 'SET_TRAVEL_RADIUS': {
      const radius = Number(action.payload);
      if (!Number.isFinite(radius)) return state;
      return { ...state, travelRadiusKm: Math.max(1, Math.min(300, Math.round(radius))) };
    }

    default:
      return state;
  }
}

/**
 * Porte le brouillon de l assistant pour toutes ses etapes.
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function FriendlyMatchWizardProvider({ children }) {
  const [state, dispatch] = useReducer(
    friendlyMatchWizardReducer,
    undefined,
    loadPersistedState,
  );

  useEffect(() => {
    if (!canUseWizardStorage()) return;
    try {
      globalThis.sessionStorage.setItem(
        FRIENDLY_MATCH_WIZARD_STORAGE_KEY,
        JSON.stringify(state),
      );
    } catch (_error) {
      // Stockage indisponible (navigation privee, quota) : le brouillon reste
      // en memoire, le tunnel continue de fonctionner.
    }
  }, [state]);

  const value = useMemo(() => ({ dispatch, state }), [state]);

  return (
    <FriendlyMatchWizardContext.Provider value={value}>
      {children}
    </FriendlyMatchWizardContext.Provider>
  );
}

/**
 * Le brouillon et son expediteur d actions. Leve hors du fournisseur : mieux
 * vaut une erreur nette qu une etape qui perd silencieusement ce qu on saisit.
 * @returns {{ dispatch: any, state: any }}
 */
export function useFriendlyMatchWizard() {
  const context = useContext(FriendlyMatchWizardContext);
  if (!context) {
    throw new Error('useFriendlyMatchWizard must be used within a FriendlyMatchWizardProvider');
  }
  return context;
}

export { FRIENDLY_MATCH_WIZARD_STORAGE_KEY };
