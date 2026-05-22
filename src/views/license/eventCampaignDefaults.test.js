import {
  buildEventCampaignDefaults,
  buildEventTargetConfig,
  resolveEventCampaignType,
} from './eventCampaignDefaults';

describe('event campaign defaults', () => {
  test('prefills a stage campaign linked to accepted event participants', () => {
    const defaults = buildEventCampaignDefaults({
      event: {
        eventFormat: 'stage_parent',
        name: 'Stage vacances',
        pricePerPerson: 42.5,
        stageEndDate: '2026-07-12',
        stageStartDate: '2026-07-08',
        type: { name: 'Stage' },
      },
      eventId: 'event-doc-1',
      todayIsoDateValue: '2026-05-22',
    });

    expect(defaults).toMatchObject({
      amount: '42,5',
      endDate: '2026-07-12',
      name: 'Participation stage - Stage vacances',
      startDate: '2026-07-08',
      type: 'internship',
    });
    expect(defaults.targetConfig).toEqual(buildEventTargetConfig('event-doc-1'));
  });

  test('detects tournament and other event types', () => {
    expect(resolveEventCampaignType({ type: { name: 'Tournoi' } })).toBe('tournament');
    expect(resolveEventCampaignType({ type: { name: 'Entrainement' } })).toBe('other');
  });
});
