/**
 * Normalize any event date/datetime value to an ISO date.
 * @param {unknown} value
 * @returns {string}
 */
export const isoDateFromEventValue = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
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
  let typeLabel = 'evenement';
  if (campaignType === 'internship') {
    typeLabel = 'stage';
  } else if (campaignType === 'tournament') {
    typeLabel = 'tournoi';
  }
  const amountValue = Number(event?.pricePerPerson || 0);
  const description = eventName
    ? `Campagne liee a l evenement ${eventName}. `
      + 'Les cotisations seront generees pour les participants acceptes.'
    : 'Campagne liee a un evenement. '
      + 'Les cotisations seront generees pour les participants acceptes.';
  const name = eventName
    ? `Participation ${typeLabel} - ${eventName}`
    : `Participation ${typeLabel}`;
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
