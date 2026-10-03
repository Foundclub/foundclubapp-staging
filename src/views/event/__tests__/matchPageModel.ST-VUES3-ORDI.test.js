import {
  formatEventPlaceShort,
  formatEventTeamLine,
  formatEventWhenLine,
} from '../eventInfoLines';
import {
  buildMatchHeaderScoreSummary,
  formatMatchEndLabel,
  listMissingResponders,
  resolveMatchStatsDoor,
  resolveMatchVerdictTag,
  resolveViewerFromInvitedTeam,
} from '../matchPageModel';

// ST-VUES3-ORDI (03/10) — LES RÈGLES DE LA PAGE DU MATCH, PARTAGÉES PAR LE TÉLÉPHONE ET LE
// SITE. Le téléphone les calculait dans ses `useMemo` ; le site en avait des copies plus
// anciennes (sa porte « Stats du match » disait encore « Les stats seront disponibles à la
// fin du match. » et « Les membres de ton équipe peuvent encore finaliser ce rapport. »),
// ou rien. Ces témoins figent le seul juge.

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next;

// Les dates se lisent à l'heure de l'appareil : on calcule l'attendu de la même façon.
const jourCourt = (/** @type {string} */ iso) => new Date(iso)
  .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', weekday: 'short' });
const heure = (/** @type {string} */ iso) => new Date(iso)
  .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

describe('ST-VUES3-ORDI · le bloc d infos (écran 1, point 2)', () => {
  test('le jour et les heures saisies : « Sam. 5 sept. · 19:00 – 20:00 »', () => {
    expect(formatEventWhenLine({
      date: '2026-09-05T12:00:00.000Z', endTime: '20:00:00.000', startTime: '19:00:00.000',
    }, 'fr-FR')).toBe('Sam. 5 sept. · 19:00 – 20:00');
  });

  test('sans heure saisie, l heure de la date ; sans date, rien', () => {
    const iso = '2026-09-05T17:00:00.000Z';
    const jour = jourCourt(iso);
    expect(formatEventWhenLine({ date: iso }, 'fr-FR'))
      .toBe(`${jour.charAt(0).toUpperCase()}${jour.slice(1)} · ${heure(iso)}`);
    expect(formatEventWhenLine({}, 'fr-FR')).toBe('');
  });

  test('le lieu court : la ville et le code postal, jamais le « contexte » du géocodeur', () => {
    expect(formatEventPlaceShort({
      locationDetails: JSON.stringify({
        address: { city: 'Lyon', label: '12 rue X, 69001 Lyon', postcode: '69001' },
      }),
    })).toBe('Lyon (69001)');
    expect(formatEventPlaceShort({ location: { city: 'Lyon' } })).toBe('Lyon');
    // Une adresse en texte libre finit souvent par « code ville ».
    expect(formatEventPlaceShort({
      locationDetails: JSON.stringify({ address: 'Stade de Pélissanne, 13330 Pélissanne' }),
    })).toBe('Pélissanne (13330)');
    // Rien de sûr : rien (l'écran garde alors son libellé d'avant).
    expect(formatEventPlaceShort({
      location: { properties: { context: '69, Rhône, Auvergne-Rhône-Alpes' } },
    })).toBe('');
    expect(formatEventPlaceShort({})).toBe('');
  });

  test('l équipe et son club : « U15 · AS Montrivage »', () => {
    expect(formatEventTeamLine({ team: { club: { name: 'AS Montrivage' }, name: 'U15' } }))
      .toBe('U15 · AS Montrivage');
    expect(formatEventTeamLine({ club: { name: 'AS Montrivage' } })).toBe('AS Montrivage');
  });
});

describe('ST-VUES3-ORDI · la porte « Stats du match » (écrans 7 et 8)', () => {
  const porte = (/** @type {any} */ extra) => resolveMatchStatsDoor({
    canManage: true,
    coachFirstname: 'Karim',
    endLabel: 'sam. 5 sept. à 20:00',
    finalizedAt: null,
    isFinal: false,
    isFinished: true,
    isReviewRequired: false,
    locale: 'fr-FR',
    scoreAvailable: false,
    t,
    waitingOfficial: false,
    ...extra,
  });

  test('avant la fin : fermée, et elle dit QUAND', () => {
    expect(porte({ isFinished: false })).toEqual({
      disabled: true, subtitle: 'S’ouvre à la fin du match, sam. 5 sept. à 20:00',
    });
  });

  test('étape 1 : le score (le seul cas que la feuille courte du téléphone détourne)', () => {
    expect(porte()).toEqual({
      disabled: false, isScoreEntry: true, subtitle: 'Étape 1 sur 3 : le score',
    });
  });

  test('étape 2, publiée, à vérifier', () => {
    expect(porte({ scoreAvailable: true }).subtitle).toBe('Étape 2 sur 3 : la feuille');
    const iso = '2026-10-01T20:39:00.000Z';
    const jour = new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    expect(porte({ finalizedAt: iso, isFinal: true, scoreAvailable: true }).subtitle)
      .toBe(`Feuille publiée le ${jour} à ${heure(iso)}`);
    expect(porte({ isReviewRequired: true, scoreAvailable: true }).subtitle)
      .toBe('Score officiel changé : vérifie la feuille');
  });

  test('« score A » : le dirigeant qui n entraîne pas lit QUI saisit, porte fermée', () => {
    expect(porte({ canManage: false, isFinal: true })).toEqual({
      disabled: true, subtitle: 'Saisies par l’entraîneur de l’équipe, Karim',
    });
  });

  test('score officiel attendu : fermée', () => {
    expect(porte({ waitingOfficial: true }).disabled).toBe(true);
  });

  test('la fin du match en mots, et rien sans fin connue', () => {
    const fin = new Date('2026-09-05T18:00:00.000Z');
    expect(formatMatchEndLabel({ eventEndedAt: fin, locale: 'fr-FR', t }))
      .toBe(`${jourCourt(fin.toISOString())} à ${heure(fin.toISOString())}`);
    expect(formatMatchEndLabel({ eventEndedAt: null, t })).toBe('');
  });
});

describe('ST-VUES3-ORDI · qui manque, et l encart du score (écrans 1 et 7)', () => {
  test('5 prénoms au plus, puis « +N » ; ceux qui ont répondu ne comptent pas', () => {
    const reponses = ['Hugo L.', 'Léa M.', 'Max P.', 'Nina R.', 'Omar S.', 'Paul T.', 'Zoé V.']
      .map((label) => ({ label, status: 'pending' }));
    expect(listMissingResponders([...reponses, { label: 'Ali B.', status: 'submitted' }]))
      .toEqual(['Hugo', 'Léa', 'Max', 'Nina', 'Omar', '+2']);
    expect(listMissingResponders(null)).toEqual([]);
  });

  test('l équipe invitée d un autre club lit le score à l envers, et le verdict avec', () => {
    const event = {
      club: { documentId: 'club-a' },
      invitedTeams: [{ club: { documentId: 'club-b' }, documentId: 'invitee' }],
      matchResult: { scoreAgainst: 1, scoreFor: 3 },
      team: { club: { documentId: 'club-a' }, documentId: 'hote' },
    };
    const invitee = resolveViewerFromInvitedTeam({ compositionTeamId: 'invitee', event });
    expect(invitee).toBe(true);
    expect(resolveViewerFromInvitedTeam({
      compositionTeamId: 'invitee',
      event: {
        ...event,
        invitedTeams: [{ club: { documentId: 'club-a' }, documentId: 'invitee' }],
      },
    })).toBe(false);

    const encart = buildMatchHeaderScoreSummary({
      canEdit: false,
      canManage: false,
      canSeeDetails: true,
      event,
      isFinal: false,
      isFinished: true,
      isViewerFromInvitedTeam: invitee,
      opponentName: 'Hôte FC',
      t,
    });
    expect(encart.value).toBe('1 - 3');
    expect(encart.verdict).toBe('loss');
    expect(resolveMatchVerdictTag({ isFinished: true, t, verdict: encart.verdict }))
      .toBe('DÉFAITE');
  });

  test('« Nommer l adversaire » : à qui peut éditer, et seulement s il manque', () => {
    const nommer = jest.fn();
    const base = {
      canManage: true,
      canSeeDetails: true,
      event: {},
      isFinal: false,
      isFinished: false,
      isViewerFromInvitedTeam: false,
      onNameOpponent: nommer,
      t,
    };
    expect(buildMatchHeaderScoreSummary({ ...base, canEdit: true }).onNameOpponent).toBe(nommer);
    expect(buildMatchHeaderScoreSummary({ ...base, canEdit: false }).onNameOpponent).toBeNull();
    expect(buildMatchHeaderScoreSummary({ ...base, canEdit: true, opponentName: 'Lyon' })
      .onNameOpponent).toBeNull();
  });
});
