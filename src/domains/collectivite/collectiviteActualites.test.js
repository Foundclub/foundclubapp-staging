import {
  ACTUALITE_AUDIENCES,
  ACTUALITE_CATEGORIES,
  actualiteFormErrors,
  attachmentBadge,
  audiencePreview,
  categoryLabel,
  categoryTone,
  publicationDateLabel,
  recipientsLine,
  toActualitePayload,
} from './collectiviteActualites';

// 📰 COLL-C4A (02/10) — les calculs PURS des actualités de la Ville (planches P3b-actu).
// ROUGE avant le lot : le module n'existait pas.

const t = (/** @type {string} */ _cle, /** @type {string} */ repli, /** @type {any} */ options) => (
  String(repli).replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''))
);

describe('COLL-C4A — le registre', () => {
  it('cinq types et trois destinataires, dans l ordre de la planche', () => {
    expect(ACTUALITE_CATEGORIES)
      .toEqual(['fermeture', 'forum', 'subventions', 'travaux', 'autre']);
    expect(ACTUALITE_AUDIENCES).toEqual(['membres', 'dirigeants', 'installation']);
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
      'Reçue par les membres des 3 clubs.',
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
  });
});
