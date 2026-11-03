import {
  ACTUALITE_AUDIENCES,
  ACTUALITE_CATEGORIES,
  actualiteFormErrors,
  attachmentBadge,
  audienceLabel,
  audiencePreview,
  categoryLabel,
  categoryTone,
  clubsDuSport,
  clubsPrecisPreview,
  publicationDateLabel,
  recipientsLine,
  sportsDesClubs,
  toActualitePayload,
} from './collectiviteActualites';

// 📰 COLL-C4A (02/10) — les calculs PURS des actualités de la Ville (planches P3b-actu).
// ROUGE avant le lot : le module n'existait pas.

const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ options) => (
  String(repli).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''))
);

describe('COLL-C4A — le registre', () => {
  it('cinq types et quatre destinataires, dans l ordre de la planche', () => {
    expect(ACTUALITE_CATEGORIES)
      .toEqual(['fermeture', 'forum', 'subventions', 'travaux', 'autre']);
    // « clubs » : T3-ACTU-CIBLE, fiche 3 option B d'Adel (03/11).
    expect(ACTUALITE_AUDIENCES).toEqual(['membres', 'dirigeants', 'installation', 'clubs']);
    expect(categoryLabel(t, 'forum')).toBe('Forum, manifestation');
    expect(categoryLabel(t, 'inconnu')).toBe('Autre');
  });

  it('une fermeture prend la couleur d attention ; jamais l or de la League', () => {
    expect(categoryTone('fermeture')).toBe('warning');
    expect(categoryTone('subventions')).toBe('primary');
    expect(ACTUALITE_CATEGORIES.map(categoryTone)).not.toContain('gold');
  });
});

describe('COLL-C4A — à qui elle est partie, en NOMBRES', () => {
  it('membres, dirigeants, installation ; un club au singulier', () => {
    const ligne = (/** @type {string} */ audience, /** @type {number} */ clubsCount) => (
      recipientsLine(t, { audience, clubsCount })
    );
    expect(ligne('membres', 3)).toBe('Envoyée aux membres des 3 clubs');
    expect(ligne('membres', 1)).toBe('Envoyée aux membres d’1 club');
    expect(ligne('dirigeants', 2)).toBe('Envoyée aux dirigeants des 2 clubs');
    expect(ligne('installation', 2)).toBe('Envoyée aux membres des 2 clubs de l’installation');
  });

  it('avant de publier : qui la reçoit, qui est prévenu, personne n y répond', () => {
    const phrase = (/** @type {string} */ audience, /** @type {number | null} */ clubsCount) => (
      audiencePreview(t, { audience, clubsCount })
    );
    expect(phrase('membres', 3)).toBe([
      // COLL-C4A3 (planche 18) : « rattachés », comme la maquette validée.
      'Reçue par les membres des 3 clubs rattachés.',
      'Une notification part aux dirigeants, aux entraîneurs et aux membres qui l’ont activée.',
      'Personne n’y répond.',
    ].join(' '));
    expect(phrase('dirigeants', 3)).toContain('Reçue par les dirigeants des 3 clubs rattachés');
    expect(phrase('membres', null)).toContain('Nous comptons');
    expect(phrase('installation', 0)).toContain('Aucun club ne la recevra');
  });
});

describe('COLL-C4A — le formulaire', () => {
  it('titre obligatoire, borné ; l installation, pour « les clubs d une installation »', () => {
    expect(actualiteFormErrors({ audience: 'membres', title: '  ' }))
      .toEqual({ title: 'required' });
    expect(actualiteFormErrors({ audience: 'membres', title: 'x'.repeat(121) }))
      .toEqual({ title: 'tooLong' });
    expect(actualiteFormErrors({ audience: 'installation', title: 'Travaux' }))
      .toEqual({ facility: 'required' });
    expect(actualiteFormErrors({ audience: 'installation', facilityId: 'dojo', title: 'Travaux' }))
      .toEqual({});
  });

  it('le corps envoyé : liste blanche, les pièces par leur id, l installation si elle sert', () => {
    expect(toActualitePayload({
      attachments: [{ id: 12, name: 'a.pdf', url: '/u/a.pdf' }, { name: 'sans id' }],
      audience: 'membres',
      body: '  Dossiers avant le 15.  ',
      category: 'subventions',
      facilityId: 'dojo',
      title: ' Subventions 2027 ',
    })).toEqual({
      attachments: [12],
      audience: 'membres',
      body: 'Dossiers avant le 15.',
      category: 'subventions',
      title: 'Subventions 2027',
    });
    expect(toActualitePayload({
      audience: 'installation', category: 'travaux', facilityId: 'dojo', title: 'T',
    })).toMatchObject({ facilityId: 'dojo' });
  });

  it('l étiquette d une pièce et la date', () => {
    expect(attachmentBadge({ mime: 'application/pdf', name: 'dossier.pdf' })).toBe('PDF');
    expect(attachmentBadge({ mime: 'image/jpeg', name: 'affiche.jpg' })).toBe('IMG');
    const maintenant = new Date('2026-10-02T10:00:00');
    expect(publicationDateLabel(t, '2026-10-02T08:00:00', maintenant)).toBe('aujourd’hui');
    expect(publicationDateLabel(t, 'illisible', maintenant)).toBe('');
    // FINITIONS15 point 8 — planche P3b-actu : « Fermeture · mar. 29 sept. ». ROUGE avant le lot.
    expect(publicationDateLabel(t, '2026-09-29T08:00:00', maintenant)).toBe('mar. 29 sept.');
  });
});

describe('T3-ACTU-CIBLE — des clubs précis', () => {
  it('le libellé, la ligne de la liste', () => {
    expect(audienceLabel(t, 'clubs')).toBe('Des clubs précis');
    expect(recipientsLine(t, { audience: 'clubs', clubsCount: 1 })).toBe('Envoyée à 1 club choisi');
    expect(recipientsLine(t, { audience: 'clubs', clubsCount: 3 })).toBe('Envoyée à 3 clubs choisis');
  });

  it('il faut un club et un rôle ; les autres audiences n en demandent pas', () => {
    const base = { audience: 'clubs', title: 'T' };
    expect(actualiteFormErrors({ ...base, clubIds: [], roles: [] })).toEqual({ clubs: 'required', roles: 'required' });
    expect(actualiteFormErrors({ ...base, clubIds: ['c'], roles: ['membres'] })).toEqual({});
    expect(actualiteFormErrors({ audience: 'membres', title: 'T' })).toEqual({});
  });

  it('le corps envoyé : la liste et les rôles, pour cette audience seulement', () => {
    expect(toActualitePayload({
      audience: 'clubs', category: 'autre', clubIds: ['c'], roles: ['membres'], title: 'T',
    })).toMatchObject({ clubIds: ['c'], roles: ['membres'] });
    const autre = toActualitePayload({
      audience: 'membres', category: 'autre', clubIds: ['c'], roles: ['membres'], title: 'T',
    });
    expect('clubIds' in autre).toBe(false);
    expect('roles' in autre).toBe(false);
  });

  it('les sports, sans doublon, sans accent mal rangé ; un club omnisports passe dans les deux', () => {
    const clubs = [{ sports: ['Tennis', 'Équitation'] }, { sports: ['Football', 'Tennis'] }, {}];
    expect(sportsDesClubs(clubs)).toEqual(['Équitation', 'Football', 'Tennis']);
    expect(clubsDuSport(clubs, 'Tennis')).toEqual([clubs[0], clubs[1]]);
    expect(clubsDuSport(clubs, '')).toEqual(clubs);
  });

  it('la phrase avant l envoi', () => {
    const base = { clubsCoches: 2, rolesCoches: 3 };
    expect(clubsPrecisPreview(t, { ...base, clubsCoches: 0 })).toBe('Cochez les clubs qui la recevront.');
    expect(clubsPrecisPreview(t, { ...base, rolesCoches: 0 })).toBe('Cochez les rôles qui la recevront.');
    expect(clubsPrecisPreview(t, base)).toBe('Nous comptons les personnes qui la recevront…');
    expect(clubsPrecisPreview(t, { ...base, clubsCount: 2, personsCount: 0 }))
      .toMatch(/^Personne ne la recevra/);
    expect(clubsPrecisPreview(t, { ...base, clubsCount: 2, personsCount: 1 }))
      .toMatch(/^Reçue par 1 personne dans 2 clubs\. /);
    expect(clubsPrecisPreview(t, {
      ...base, approximate: true, clubsCount: 1, personsCount: 42,
    })).toMatch(/^Reçue par environ 42 personnes dans 1 club\. /);
  });
});
