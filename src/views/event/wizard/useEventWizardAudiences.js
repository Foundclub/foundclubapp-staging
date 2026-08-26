import { useCallback, useMemo } from 'react';

import { useEventWizard } from './EventWizardContext';
import { isMatchEventType } from './eventWizardDetectionUtils';

/**
 * La marque qui separe les deux familles d'audience. Elle vient du serveur
 * (`event-team-audience`), elle n'est pas inventee ici.
 */
export const EXTERNAL_AUDIENCE_KIND = 'external_invited';

export const getAudienceTeamId = (/** @type {any} */ value) => String(
  value?.documentId || value?.id || value || '',
).trim();

export const isExternalAudience = (/** @type {any} */ audience) => (
  audience?.audienceKind === EXTERNAL_AUDIENCE_KIND
);

/**
 * Les identifiants d'equipes INTERNES conviees — le miroir `invitedTeams`.
 *
 * 🔒 S10-B : les externes en sont volontairement absents. Une equipe externe est
 * « en attente » tant que son coach n'a pas repondu ; l'inscrire dans
 * `invitedTeams` la ferait apparaitre comme deja embarquee.
 * @param {any[]} audiences Les audiences a filtrer.
 * @returns {string[]} Les identifiants des equipes internes.
 */
export const getInvitedTeamIds = (audiences = []) => audiences
  .filter((audience) => !isExternalAudience(audience))
  .map((audience) => getAudienceTeamId(audience?.team))
  .filter(Boolean);

/**
 * Les audiences qu'un evenement de ce TYPE a le droit d'emporter.
 *
 * 🔒 S10-B — une equipe d'un AUTRE club ne se convie que sur un match
 * (cadre d'Adel du 2026-08-25, reponse 4), et c'est la regle que le serveur
 * durcit en parallele. Les audiences internes, elles, passent partout.
 *
 * ⚠️ Le filtre existe parce que l'etat du tunnel SURVIT au changement de
 * type : le brouillon web persiste en `sessionStorage`, on peut donc commencer
 * un match, inviter une equipe adverse, puis repasser le type en
 * « Entrainement ». L'audience externe resterait alors dans l'etat, invisible
 * a l'ecran (plus aucune etape ne la montre) et partirait quand meme a la
 * creation.
 * @param {any} wizardState Etat du tunnel.
 * @returns {any[]} Les audiences a envoyer au serveur.
 */
export const keepAudiencesForEventType = (wizardState) => {
  const audiences = Array.isArray(wizardState?.teamAudiences) ? wizardState.teamAudiences : [];
  if (isMatchEventType(wizardState?.type?.name)) return audiences;
  return audiences.filter((audience) => !isExternalAudience(audience));
};

/**
 * LES DEUX FAMILLES D'AUDIENCE, ET LA GARANTIE QU'ELLES NE SE MELANGENT PAS.
 *
 * 🧭 S10-B — depuis ce lot elles sont saisies sur DEUX ecrans differents : les
 * equipes de mon club a l'etape « Participants », l'equipe adverse a l'etape
 * « Contre qui ? ». Chacun n'ecrit que sa famille et RECOPIE l'autre telle
 * quelle. Sans ce point de passage unique, le second ecran ecraserait ce que le
 * premier vient d'ecrire — les deux ecrivent la meme liste `teamAudiences`.
 * @returns {{ externalAudiences: any[], internalAudiences: any[],
 *   setExternalAudiences: (next: any[]) => void,
 *   setInternalAudiences: (next: any[]) => void }} Les deux familles et leurs plumes.
 */
export default function useEventWizardAudiences() {
  const { dispatch, state } = useEventWizard();

  const allAudiences = useMemo(
    () => (Array.isArray(state.teamAudiences) ? state.teamAudiences : []),
    [state.teamAudiences],
  );
  const internalAudiences = useMemo(
    () => allAudiences.filter((audience) => !isExternalAudience(audience)),
    [allAudiences],
  );
  const externalAudiences = useMemo(
    () => allAudiences.filter(isExternalAudience),
    [allAudiences],
  );

  const commit = useCallback((
    /** @type {any[]} */ nextInternal,
    /** @type {any[]} */ nextExternal,
  ) => {
    const safeInternal = Array.isArray(nextInternal) ? nextInternal : [];
    const safeExternal = Array.isArray(nextExternal) ? nextExternal : [];
    dispatch({
      payload: [...safeInternal, ...safeExternal],
      type: 'SET_TEAM_AUDIENCES',
    });
    dispatch({
      payload: getInvitedTeamIds(safeInternal),
      type: 'SET_INVITES',
    });
  }, [dispatch]);

  const setInternalAudiences = useCallback(
    (/** @type {any[]} */ next) => commit(next, externalAudiences),
    [commit, externalAudiences],
  );
  const setExternalAudiences = useCallback(
    (/** @type {any[]} */ next) => commit(internalAudiences, next),
    [commit, internalAudiences],
  );

  return {
    externalAudiences,
    internalAudiences,
    setExternalAudiences,
    setInternalAudiences,
  };
}
