import i18next from 'i18next';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * Normalize any event date/datetime value to an ISO date.
 * @param {unknown} value
 * @returns {string}
 */
export const isoDateFromEventValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  // BUGHUNT C03 / Q4-13 : seul un jour SEUL se garde tel quel ; un datetime UTC
  // (00:30 a Paris = 22:30Z la veille) passe par les champs locaux ci-dessous.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  // BH11 P5-14 : champs LOCAUX, toISOString passerait en UTC (veille a minuit).
  const pad = (n) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

/**
 * Resolve the best cotisation campaign type for an event.
 * @param {any} event
 * @returns {'internship' | 'tournament' | 'other'}
 */
export const resolveEventCampaignType = (event) => {
  const eventFormat = String(event?.eventFormat || '').toLowerCase();
  const typeName = String(event?.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (eventFormat.includes('stage') || typeName.includes('stage')) return 'internship';
  if (typeName.includes('tournoi') || typeName.includes('tournament')) return 'tournament';
  return 'other';
};

/**
 * Build the locked target config for an event-linked campaign.
 * @param {string} eventId
 * @returns {any}
 */
export const buildEventTargetConfig = (eventId) => ({
  categoryIds: [],
  eventId,
  includeAllMembers: false,
  includeExternalParticipants: true,
  levelIds: [],
  participantStatuses: ['accepted'],
  roles: [],
  sectionIds: [],
  source: 'event_participants',
  teamIds: [],
});

/**
 * Build editor defaults for a new event-linked cotisation campaign.
 * @param {{
 *   event?: any,
 *   eventId?: string,
 *   todayIsoDateValue?: string,
 * }} root0
 * @returns {any}
 */
export const buildEventCampaignDefaults = ({ event, eventId, todayIsoDateValue }) => {
  if (!eventId) return null;
  const startDate = (
    isoDateFromEventValue(event?.stageStartDate || event?.date) || todayIsoDateValue
  );
  const endDate = (
    isoDateFromEventValue(event?.stageEndDate || event?.endDate || event?.date) || startDate
  );
  const campaignType = resolveEventCampaignType(event);
  const eventName = String(event?.name || '').trim();
  let typeLabel = i18next.t('eventCampaignDefaults.typeLabels.event', 'evenement');
  if (campaignType === 'internship') {
    typeLabel = i18next.t('eventCampaignDefaults.typeLabels.internship', 'stage');
  } else if (campaignType === 'tournament') {
    typeLabel = i18next.t('eventCampaignDefaults.typeLabels.tournament', 'tournoi');
  }
  const amountValue = Number(event?.pricePerPerson || 0);
  const description = eventName
    ? i18next.t(
      'eventCampaignDefaults.description.withEvent',
      'Campagne liée a l événement {{eventName}}. ',
      { eventName, ...SANS_ECHAPPEMENT },
    )
      + i18next.t(
        'eventCampaignDefaults.description.acceptedParticipants',
        'Les cotisations seront générées pour les participants acceptes.',
      )
    : i18next.t('eventCampaignDefaults.description.withoutEvent', 'Campagne liée a un événement. ')
      + i18next.t(
        'eventCampaignDefaults.description.acceptedParticipants',
        'Les cotisations seront générées pour les participants acceptes.',
      );
  const name = eventName
    ? i18next.t(
      'eventCampaignDefaults.name.withEvent',
      'Participation {{typeLabel}} - {{eventName}}',
      { eventName, typeLabel, ...SANS_ECHAPPEMENT },
    )
    : i18next.t(
      'eventCampaignDefaults.name.withoutEvent',
      'Participation {{typeLabel}}',
      { typeLabel, ...SANS_ECHAPPEMENT },
    );
  return {
    amount: amountValue > 0 ? String(amountValue).replace('.', ',') : '',
    description,
    endDate,
    name,
    startDate,
    targetConfig: buildEventTargetConfig(eventId),
    type: campaignType,
  };
};
