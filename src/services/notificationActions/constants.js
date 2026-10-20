export const EVENT_RSVP_ACTION_CONTEXT = 'event_rsvp';
export const EVENT_RSVP_ACTION_PRESENT = 'event_rsvp_present';
export const EVENT_RSVP_ACTION_ABSENT = 'event_rsvp_absent';
export const EVENT_RSVP_CATEGORY = 'EVENT_RSVP_CATEGORY';
export const CHAT_REPLY_ACTION_CONTEXT = 'chat_reply';
export const CHAT_REPLY_ACTION_REPLY = 'chat_reply_submit';
export const CHAT_REPLY_CATEGORY = 'CHAT_REPLY_CATEGORY';
// REPNOTIF — quand l envoi echoue, le texte tape ne doit pas disparaitre : la
// notification d echec le RANGE et porte ce bouton, qui le renvoie tel quel.
export const CHAT_REPLY_ACTION_RETRY = 'chat_reply_retry';
export const CHAT_REPLY_RETRY_CATEGORY = 'CHAT_REPLY_RETRY_CATEGORY';
// RESA-L6B-1 (19/10/2026) — les boutons de N-20 « Tu confirmes ta réservation de demain ? ».
// Contrat FIGÉ avec le serveur (RESA-L2C pose la catégorie) : ne pas renommer sans lui.
export const RESA_VEILLE_ACTION_CONTEXT = 'resa_veille';
export const RESA_VEILLE_ACTION_CONFIRMER = 'resa_veille_confirmer';
export const RESA_VEILLE_ACTION_ANNULER = 'resa_veille_annuler';
export const RESA_VEILLE_CATEGORY = 'RESA_VEILLE_CATEGORY';

export const NOTIFICATION_DEFAULT_CHANNEL_ID = 'default';
export const NOTIFICATION_SILENT_CHANNEL_ID = 'silent-feedback';

export const NOTIFICATION_PENDING_OPEN_KEY = 'pending-open-notification';
