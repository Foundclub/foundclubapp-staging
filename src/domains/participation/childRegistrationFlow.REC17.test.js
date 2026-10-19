import { describeChildChoices } from './childRegistrationFlow';

test('REC17-003 : Romain membre répond à son équipe, Greg extérieur garde sa demande', () => {
  const children = [
    {
      age: 11, documentId: 'romain', firstname: 'Romain', team: { documentId: 'u11' },
    },
    {
      age: 12, documentId: 'greg', firstname: 'Greg', team: { documentId: 'basket' },
    },
  ];
  const rows = describeChildChoices(children, [{ child: { documentId: 'greg' }, status: 'pending' }], { team: { documentId: 'u11' } });
  expect(rows[0]).toMatchObject({ reasonKey: 'childEventResponse.alreadyMember', selectable: false });
  expect(rows[1]).toMatchObject({ reasonKey: 'childEventRegistration.reasons.alreadyPending', selectable: false });
});

test('REC17-003 : même distinction pour une équipe invitée', () => {
  const rows = describeChildChoices([{ age: 11, documentId: 'c', team: { documentId: 'away' } }], [], {
    invitedTeams: [{ documentId: 'away' }], team: { documentId: 'host' },
  });
  expect(rows[0].selectable).toBe(false);
});

test.each([
  ['PENDING', 'ALL_MEMBERS'],
  ['REFUSED', 'ALL_MEMBERS'],
  ['CANCELLED', 'ALL_MEMBERS'],
  ['ACCEPTED', 'SELECTED_MEMBERS'],
])('REC17-003 : audience %s/%s ne remplace pas une inscription extérieure', (status, selectionMode) => {
  const rows = describeChildChoices([{ age: 11, documentId: 'c', team: { documentId: 'away' } }], [], {
    team: { documentId: 'host' },
    teamAudiences: [{ selectionMode, status, team: { documentId: 'away' } }],
  });
  expect(rows[0].selectable).toBe(true);
});
