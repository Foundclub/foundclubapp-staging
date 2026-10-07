import {
  format, isValid, parse, parseISO,
} from 'date-fns';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  formatDay,
  formatPeriod,
  freeRanges,
  fromMinutes,
  fullRangesOfSlots,
  isoWeekdayOf,
  isTime,
  overCapacityPreviewOf,
  SEASON_SLOT_WEEKDAYS,
  seasonSlotErrorMessage,
  slotWho,
  timeRange,
  toMinutes,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import RondsDePlaces from '@/components/organisms/seasonSlot/RondsDePlaces';

import {
  useAttributeSeasonSlot,
  useClubTeamsForSlot,
  useFacilitySeasonSlots,
  useModifySeasonSlot,
  useSeasonSlotPreview,
} from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import texteInsecable from '@/utils/texteInsecable';

// Deux elements aux deux bouts d une rangee.
const ENTRE_DEUX = /** @type {const} */ ({ gap: 8, justifyContent: 'space-between' });

/**
 * Une puce a choisir (design `chip-c`) : un bouton radio.
 * @param {{ actif: boolean, libelle: string, onPress: () => void, testID?: string }} props
 * @returns {import('react').ReactElement} La puce.
 */
export function PuceDeChoix({
  actif, libelle, onPress, testID,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      onPress={onPress}
      style={[
        Spaces.paddingHorizontal[12],
        {
          backgroundColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.04),
          borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.18),
          borderRadius: 999,
          borderWidth: 1,
          justifyContent: 'center',
          minHeight: 36,
        },
      ]}
      testID={testID}
    >
      {/* VILLE-T18A — une puce epouse son texte GRAS : sous Android 16, « AS Montrivage » choisi
          devenait « AS » (capture T18 G29a). Espaces insecables : le libelle reste entier. */}
      <Text style={[Fonts.p3Bold, actif ? Fonts.primary900 : Fonts.neutral100]}>
        {texteInsecable(libelle)}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Le prochain jour civil (aujourd hui compris) qui tombe un jour ISO donne.
 * @param {number} jour - 1 a 7.
 * @returns {Date} La date.
 */
const prochainJour = (jour) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const ecart = (Number(jour) - isoWeekdayOf(date) + 7) % 7;
  date.setDate(date.getDate() + ecart);
  return date;
};

/**
 * Une date saisie « JJ/MM/AAAA » en jour civil « AAAA-MM-JJ » (null si illisible).
 * @param {string} saisie - La date saisie.
 * @returns {string | null} Le jour civil.
 */
const versJourCivil = (saisie) => {
  const date = parse(String(saisie || ''), 'dd/MM/yyyy', new Date());
  return isValid(date) ? format(date, 'yyyy-MM-dd') : null;
};

/**
 * Un jour civil « AAAA-MM-JJ » en saisie « JJ/MM/AAAA » (vide si absent).
 * @param {string | null | undefined} jour - Le jour civil.
 * @returns {string} La saisie.
 */
const versSaisie = (jour) => (jour ? format(parseISO(String(jour)), 'dd/MM/yyyy') : '');

/**
 * 📐 COLL-C2B (02/10) — ATTRIBUER ou MODIFIER un creneau de saison (design HY521H1, planches
 * P4v2-creneaux, ecrans 2, 3 et 8 ; P4v3-plateaux, ecran 2 ; P5v2-vues, ecran 5).
 *
 * La place se lit PENDANT la saisie (contrat C2A §4.2) : une carte verte « place libre », ou
 * orange si l attribution depasse la capacite. Le serveur juge (§4.3) : un 409
 * `SEASON_SLOT_OVER_CAPACITY` n ecrit rien, et « Attribuer quand meme » renvoie le meme corps
 * avec `confirmOverCapacity` (D74). Modifier vaut « a partir du » (§4.5) : les semaines passees
 * ne bougent pas, le club ne change pas.
 *
 * ⛔ Aucun nom de personne : la carte dit des clubs et des equipes (SPEC §2 H).
 * Le champ « Plateau » n existe que si l installation a des plateaux nommes (D66).
 *
 * COLL-C2B-BIS (03/10) — planche 23 : « Modifier » change aussi la PERIODE (« Du », « Au »), sans
 * retirer ni recreer (contrat §4.5). Un creneau commence garde son debut (dit, pas choisi) ; la
 * carte de place se lit sur la nouvelle periode, a partir d aujourd hui (le serveur fait de meme).
 *
 * COLL-C2C (02/10) — D32 : `repartition` = le DIRIGEANT repartit un creneau de son club entre ses
 * equipes. Seule l equipe change (et la date d effet) : ni jour, ni heures, ni plateau, ni carte
 * de place ; le serveur refuse tout le reste (admin tests/authz/COLL-C2C-repartition.test.js).
 *
 * VILLE-T18A (07/10, tournee T18) — planche 23, etat 3 : des que la carte de place dit « complet »
 * PENDANT la saisie (et plus seulement apres un 409), les 3 gestes de la planche : « Voir les
 * heures libres du <jour> » (les heures ou il reste une place, un appui les pose),
 * « Attribuer quand meme » (confirme d emblee) et « Changer l heure ».
 * @param {{
 *   clubs?: Array<{ documentId: string, name: string }>,
 *   compact?: boolean,
 *   facilities?: Array<{ documentId: string, name: string }>,
 *   facilityId?: string | null,
 *   fixedClubId?: string | null,
 *   initial?: { weekday?: number, startTime?: string, endTime?: string, plateau?: number | null },
 *   onCancel?: () => void,
 *   onDone: (creneau: any) => void,
 *   repartition?: boolean,
 *   slot?: any,
 * }} props
 * @returns {import('react').ReactElement} Le formulaire.
 */
function SeasonSlotForm({
  clubs = [],
  compact = false,
  facilities = [],
  facilityId: installationFixee = null,
  fixedClubId = null,
  initial = {},
  onCancel,
  onDone,
  repartition = false,
  slot = null,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const modification = Boolean(slot?.documentId);

  const [installationChoisie, setInstallationChoisie] = useState(
    installationFixee
      || slot?.facility?.documentId
      || (facilities.length === 1 ? facilities[0].documentId : null),
  );
  const facilityId = installationFixee || installationChoisie;
  const lecture = useFacilitySeasonSlots(facilityId);
  const meta = lecture.data?.meta || {};
  const installation = meta.facility
    || facilities.find((ligne) => ligne.documentId === facilityId)
    || null;
  const plateaux = Array.isArray(meta.facility?.plateaux) ? meta.facility.plateaux : [];
  const capacite = Math.max(1, Number(installation?.maxSlots) || 1);

  const [club, setClub] = useState(
    fixedClubId || slot?.club?.documentId || (clubs.length === 1 ? clubs[0].documentId : null),
  );
  const [equipe, setEquipe] = useState(slot?.team?.documentId || null);
  const [jour, setJour] = useState(Number(slot?.weekday || initial.weekday) || null);
  const [debut, setDebut] = useState(
    String(slot?.startTime || initial.startTime || '').slice(0, 5),
  );
  const [fin, setFin] = useState(String(slot?.endTime || initial.endTime || '').slice(0, 5));
  const [plateau, setPlateau] = useState(
    Number(slot?.plateau?.number || initial.plateau) || null,
  );
  const [aPartirDu, setAPartirDu] = useState(
    modification ? format(prochainJour(Number(slot?.weekday) || 1), 'dd/MM/yyyy') : '',
  );
  // COLL-C2B-BIS — la periode d un creneau qu on modifie (la mairie seule ; pas en repartition).
  const avecPeriode = modification && !repartition;
  const aujourdhui = format(new Date(), 'yyyy-MM-dd');
  const debutActuel = slot?.validFrom ? String(slot.validFrom).slice(0, 10) : null;
  const finActuelle = slot?.validUntil ? String(slot.validUntil).slice(0, 10) : null;
  const dejaCommence = Boolean(debutActuel) && String(debutActuel) < aujourdhui;
  const [periodeDu, setPeriodeDu] = useState(versSaisie(debutActuel));
  const [periodeAu, setPeriodeAu] = useState(versSaisie(finActuelle));
  const nouveauDebut = dejaCommence ? debutActuel : versJourCivil(periodeDu);
  const nouvelleFin = versJourCivil(periodeAu);
  const periodeJuste = !avecPeriode
    || Boolean(nouveauDebut && nouvelleFin && nouvelleFin >= nouveauDebut);
  const [conflit, setConflit] = useState(/** @type {any} */ (null));
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));
  // VILLE-T18A — « Voir les heures libres du <jour> » : la liste est ouverte.
  const [voirLibres, setVoirLibres] = useState(false);

  const equipes = useClubTeamsForSlot(modification && !repartition ? null : club);
  const attribuer = useAttributeSeasonSlot();
  const modifier = useModifySeasonSlot();
  const envoiEnCours = attribuer.isPending || modifier.isPending;

  const debutLisible = isTime(debut);
  const finLisible = isTime(fin);
  const ordreJuste = debutLisible && finLisible
    && Number(toMinutes(fin)) > Number(toMinutes(debut));
  // COLL-C2C : en repartition, la place ne change pas (meme jour, memes heures) : rien a lire.
  // COLL-C2B-BIS : en modification, la place se lit sur la periode choisie, a partir d aujourd hui.
  /** @type {string | null} */
  let apercuDu = null;
  if (avecPeriode && periodeJuste && nouveauDebut && nouvelleFin) {
    apercuDu = nouveauDebut < aujourdhui ? aujourdhui : nouveauDebut;
  }
  const apercuAu = apercuDu ? nouvelleFin : null;
  const parametresApercu = useMemo(() => (facilityId && jour && ordreJuste && !repartition ? {
    endTime: fin,
    excludeSlot: slot?.documentId || undefined,
    plateau: plateau || undefined,
    startTime: debut,
    weekday: jour,
    ...(apercuDu ? { validFrom: apercuDu, validUntil: apercuAu } : {}),
  } : null), [
    apercuAu, apercuDu, debut, facilityId, fin, jour, ordreJuste, plateau, repartition,
    slot?.documentId,
  ]);
  const apercu = useSeasonSlotPreview(facilityId, parametresApercu);
  const place = conflit || apercu.data?.data || null;
  // VILLE-T18A — planche 23, etat 3 : le « complet » se decide pendant la saisie, ou par le 409.
  const besoinDeConfirmer = Boolean(conflit)
    || Boolean(parametresApercu && apercu.data?.data?.needsConfirmation);

  // VILLE-T18A — les heures ou il reste une place ce jour-la : la semaine type de l installation
  // (deja lue), moins les moments complets ; le creneau qu on modifie ne compte pas.
  // ponytail: ouverture 08:00 – 22:00 (defaut de `freeRanges`) : la liste des creneaux ne dit pas
  // les horaires de l installation, et leur retrait est decide (VILLE-INSTALLATION). Le serveur
  // refuse toujours une heure hors horaires (`seasonSlotErrorMessage`).
  const heuresLibres = useMemo(() => {
    if (!jour) return [];
    /** @type {any[]} */
    const creneauxDuJour = (Array.isArray(lecture.data?.data) ? lecture.data.data : [])
      .filter((creneau) => Number(creneau?.weekday) === Number(jour)
        && creneau?.documentId !== slot?.documentId);
    return freeRanges(fullRangesOfSlots(creneauxDuJour, capacite));
  }, [capacite, jour, lecture.data, slot?.documentId]);

  const nomDuClub = slot?.club?.name
    || clubs.find((ligne) => ligne.documentId === club)?.name
    || '';
  const pret = Boolean(facilityId && club && jour && ordreJuste)
    && (!modification || Boolean(aPartirDu))
    && periodeJuste;

  let erreurHeures = null;
  if ((debut && !debutLisible) || (fin && !finLisible)) {
    erreurHeures = t(
      'collectiviteCreneaux.attribuer.heureFormat',
      'Une heure s’écrit HH:MM (par exemple 17:30).',
    );
  } else if (debutLisible && finLisible && !ordreJuste) {
    erreurHeures = t('collectiviteCreneaux.attribuer.heureOrdre', 'La fin doit suivre le début.');
  }

  const toucherLaSaisie = () => {
    setConflit(null);
    setErreur(null);
  };

  // VILLE-T18A — une heure libre choisie d un appui : son debut, et la duree deja saisie
  // (1 h 30 sans saisie lisible), sans deborder de la plage libre.
  const poserLaPlage = (/** @type {{ start: number, end: number }} */ plage) => {
    const duree = ordreJuste ? Number(toMinutes(fin)) - Number(toMinutes(debut)) : 90;
    setDebut(fromMinutes(plage.start));
    setFin(fromMinutes(Math.min(plage.start + duree, plage.end)));
    setVoirLibres(false);
    toucherLaSaisie();
  };
  // « Changer l heure » : les heures sont a choisir de nouveau, les heures libres sous les yeux.
  // En mode compact (planning), les heures viennent de la case : rien a vider.
  const changerLHeure = () => {
    if (!compact) {
      setDebut('');
      setFin('');
    }
    setVoirLibres(true);
    toucherLaSaisie();
  };

  const envoyer = async (/** @type {boolean} */ quandMeme = false) => {
    if (!pret || envoiEnCours) return;
    setErreur(null);
    const confirmation = quandMeme ? { confirmOverCapacity: true } : {};
    const champPlateau = plateaux.length ? { plateau: plateau || null } : {};
    try {
      let reponse;
      if (modification) {
        const date = parse(aPartirDu, 'dd/MM/yyyy', new Date());
        reponse = await modifier.mutateAsync({
          // COLL-C2C — en repartition : l equipe et la date d effet, rien d autre (le serveur).
          data: repartition
            ? { effectiveFrom: format(date, 'yyyy-MM-dd'), team: equipe || null }
            : {
              effectiveFrom: format(date, 'yyyy-MM-dd'),
              endTime: fin,
              startTime: debut,
              weekday: jour,
              ...champPlateau,
              // COLL-C2B-BIS : seule une periode CHANGEE part (sinon la coupure d avant, intacte).
              ...(nouveauDebut && nouveauDebut !== debutActuel ? { validFrom: nouveauDebut } : {}),
              ...(nouvelleFin && nouvelleFin !== finActuelle ? { validUntil: nouvelleFin } : {}),
              ...confirmation,
            },
          slotId: slot.documentId,
        });
      } else {
        reponse = await attribuer.mutateAsync({
          data: {
            club,
            endTime: fin,
            startTime: debut,
            weekday: jour,
            ...(equipe ? { team: equipe } : {}),
            ...(plateau ? { plateau } : {}),
            ...confirmation,
          },
          facilityId,
        });
      }
      setConflit(null);
      onDone(reponse?.data || null);
    } catch (refus) {
      const apercuDuRefus = overCapacityPreviewOf(refus);
      if (apercuDuRefus) {
        // D74 : on previent, on n ecrit rien ; la mairie decide en connaissance de cause.
        setConflit(apercuDuRefus);
        return;
      }
      setErreur(seasonSlotErrorMessage(t, refus) || getErrorMessage(/** @type {any} */ (refus)));
    }
  };

  // ─── La carte « Place libre » (§4.2) ────────────────────────────────────────────────
  const carteDeLaPlace = (() => {
    if (!parametresApercu || !place) return null;
    const moment = `${weekdayName(Number(jour))} ${timeRange(debut, fin)}`;
    const occupants = Array.isArray(place.occupants) ? place.occupants : [];
    const surPlateau = place.plateau && typeof place.plateau === 'object' ? place.plateau : null;
    let titre;
    if (surPlateau) {
      titre = surPlateau.free
        ? t('collectiviteCreneaux.attribuer.plateauLibre', '{{plateau}} libre à cette heure', {
          plateau: surPlateau.name,
          ...SANS_ECHAPPEMENT,
        })
        : t('collectiviteCreneaux.attribuer.plateauPris', '{{plateau}} déjà pris à cette heure', {
          plateau: surPlateau.name,
          ...SANS_ECHAPPEMENT,
        });
    } else {
      titre = besoinDeConfirmer
        ? t('collectiviteCreneaux.attribuer.complet', '{{moment}} : complet', {
          moment,
          ...SANS_ECHAPPEMENT,
        })
        : t('collectiviteCreneaux.attribuer.libre', '{{moment}} : place libre', {
          moment,
          ...SANS_ECHAPPEMENT,
        });
    }
    const lignes = [];
    if (occupants.length) {
      lignes.push(t('collectiviteCreneaux.attribuer.dejaLa', 'Déjà là : {{qui}}.', {
        qui: occupants.map(slotWho).filter(Boolean).join(', '),
        ...SANS_ECHAPPEMENT,
      }));
    } else {
      lignes.push(t('collectiviteCreneaux.attribuer.personne', 'Personne n’y est.'));
    }
    if (place.next?.club) {
      lignes.push(t('collectiviteCreneaux.attribuer.ensuite', '{{qui}} arrive à {{heure}}.', {
        heure: String(place.next.startTime || '').slice(0, 5),
        qui: slotWho(place.next),
        ...SANS_ECHAPPEMENT,
      }));
    }
    const depassement = besoinDeConfirmer
      && Number(place.teamsAfter) > Number(place.capacity || capacite)
      ? t('collectiviteCreneaux.attribuer.depassement', {
        capacite: Number(place.capacity || capacite),
        count: Number(place.teamsAfter),
        defaultValue_one: 'Attribuer met {{count}} équipe pour {{capacite}} places, chaque '
          + '{{jour}} de la saison.',
        defaultValue_other: 'Attribuer met {{count}} équipes pour {{capacite}} places, chaque '
          + '{{jour}} de la saison.',
        jour: weekdayName(Number(jour)).toLocaleLowerCase(),
        ...SANS_ECHAPPEMENT,
      })
      : null;
    const couleur = besoinDeConfirmer ? Colors.warning500 : Colors.success500;
    return (
      <View
        accessibilityLiveRegion="polite"
        style={[
          Spaces.padding[12],
          {
            backgroundColor: withAlpha(couleur, 0.1),
            borderColor: withAlpha(couleur, 0.45),
            borderRadius: 14,
            borderWidth: 1,
            gap: 4,
          },
        ]}
        testID={besoinDeConfirmer ? 'carte-complet' : 'carte-place-libre'}
      >
        <View style={[Alignments.row, Alignments.alignCenter, ENTRE_DEUX]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{titre}</Text>
          <RondsDePlaces
            capacite={Number(place.capacity || capacite)}
            pleine={besoinDeConfirmer}
            prises={Number(place.peak) || occupants.length}
          />
        </View>
        {lignes.map((ligne) => (
          <Text key={ligne} style={[Fonts.p3, Fonts.neutral200]}>{ligne}</Text>
        ))}
        {depassement ? <Text style={[Fonts.p3Bold, Fonts.warning500]}>{depassement}</Text> : null}
        {/* VILLE-T18A — planche 23, etat 3. Les heures libres se lisent sur l installation : un
            plateau deja pris (D66) n a pas cette liste. Texte GRAS dans une boite a sa largeur :
            espaces insecables (Android 16, piege du dernier mot perdu). */}
        {besoinDeConfirmer && !surPlateau && !repartition ? (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setVoirLibres(true)}
            style={[Alignments.row, Alignments.alignCenter, { minHeight: 32 }]}
            testID="attribuer-voir-libres"
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {texteInsecable(t(
                'collectiviteCreneaux.attribuer.voirLibres',
                'Voir les heures libres du {{jour}}',
                { jour: weekdayName(Number(jour)).toLocaleLowerCase(), ...SANS_ECHAPPEMENT },
              ))}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  })();

  // VILLE-T18A — « Libre ce mardi : » et une puce par plage ; un appui pose ses heures.
  const lesHeuresLibres = voirLibres && jour && !repartition ? (
    <View style={{ gap: 8 }} testID="attribuer-heures-libres">
      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
        {t('collectiviteCreneaux.attribuer.libreCe', 'Libre ce {{jour}} :', {
          jour: weekdayName(Number(jour)).toLocaleLowerCase(),
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      {heuresLibres.length ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {heuresLibres.map((plage) => (
            <PuceDeChoix
              actif={false}
              key={`libre-${plage.start}`}
              libelle={timeRange(fromMinutes(plage.start), fromMinutes(plage.end))}
              onPress={() => poserLaPlage(plage)}
              testID={`attribuer-libre-${fromMinutes(plage.start)}`}
            />
          ))}
        </View>
      ) : (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('collectiviteCreneaux.attribuer.aucuneLibre', 'Aucune heure libre ce {{jour}}.', {
            jour: weekdayName(Number(jour)).toLocaleLowerCase(),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      )}
    </View>
  ) : null;

  const titreDuChamp = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{texte}</Text>
  );
  const rangee = (/** @type {import('react').ReactNode} */ enfants) => (
    <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>{enfants}</View>
  );

  const saison = meta.season || null;
  const periode = saison
    ? t('collectiviteCreneaux.attribuer.toutLaSaison', 'Toute la saison · {{periode}}', {
      periode: formatPeriod(saison.validFrom, saison.validUntil, { withYear: false }),
      ...SANS_ECHAPPEMENT,
    })
    : t('collectiviteCreneaux.attribuer.saison', 'Toute la saison');

  return (
    <View style={{ gap: 16 }}>
      {compact ? null : (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {modification
            ? [slotWho(slot), installation?.name].filter(Boolean).join(' · ')
            : [
              installation?.name,
              installation ? t('collectiviteCreneaux.liste.capacite', {
                count: capacite,
                defaultValue_one: '{{count}} équipe à la fois',
                defaultValue_other: '{{count}} équipes à la fois',
              }) : null,
            ].filter(Boolean).join(' · ')}
        </Text>
      )}

      {/* Depuis la fiche d un club (point 6) : l installation se choisit ici. */}
      {!installationFixee && !modification && facilities.length > 1 ? (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t('collectiviteCreneaux.attribuer.installation', 'Installation'))}
          {rangee(facilities.map((ligne) => (
            <PuceDeChoix
              actif={ligne.documentId === installationChoisie}
              key={ligne.documentId}
              libelle={ligne.name}
              onPress={() => {
                setInstallationChoisie(ligne.documentId);
                setPlateau(null);
                toucherLaSaisie();
              }}
            />
          )))}
        </View>
      ) : null}

      {modification ? null : (
        <View style={{ gap: 8 }}>
          {titreDuChamp(compact
            ? t('collectiviteCreneaux.attribuer.attribuerA', 'Attribuer à')
            : t('collectiviteCreneaux.attribuer.club', 'Club'))}
          {clubs.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'collectiviteCreneaux.attribuer.aucunClub',
                'Aucun club n’est rattaché à la Ville : invitez-en un depuis « Clubs ».',
              )}
            </Text>
          ) : rangee((fixedClubId
            ? clubs.filter((ligne) => ligne.documentId === fixedClubId)
            : clubs).map((ligne) => (
              <PuceDeChoix
                actif={ligne.documentId === club}
                key={ligne.documentId}
                libelle={ligne.name}
                onPress={() => {
                  setClub(ligne.documentId);
                  setEquipe(null);
                  toucherLaSaisie();
                }}
              />
          )))}
        </View>
      )}

      {(!modification || repartition) && club ? (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t('collectiviteCreneaux.attribuer.equipe', 'Équipe (facultatif)'))}
          {rangee([
            <PuceDeChoix
              actif={!equipe}
              key="tout-le-club"
              libelle={t('collectiviteCreneaux.attribuer.toutLeClub', 'Tout le club')}
              onPress={() => setEquipe(null)}
            />,
            ...(Array.isArray(equipes.data) ? equipes.data : []).map((/** @type {any} */ ligne) => (
              <PuceDeChoix
                actif={ligne.documentId === equipe}
                key={ligne.documentId}
                libelle={ligne.name}
                onPress={() => setEquipe(ligne.documentId)}
              />
            )),
          ])}
        </View>
      ) : null}

      {compact || repartition ? null : (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t('collectiviteCreneaux.attribuer.jour', 'Jour'))}
          {rangee(SEASON_SLOT_WEEKDAYS.map((numero) => (
            <PuceDeChoix
              actif={numero === jour}
              key={`jour-${numero}`}
              libelle={weekdayName(numero, { short: true })}
              onPress={() => {
                setJour(numero);
                toucherLaSaisie();
              }}
              testID={`jour-${numero}`}
            />
          )))}
        </View>
      )}

      {/* VILLE-T18A (T18 G29a, G32a) — les heures se CHOISISSENT : le sélecteur d heure de la
          création d événement (décision d Adel du 07/10, « réutiliser ce qu on a déjà ») ; elles
          se tapaient au clavier. Même valeur « HH:MM ». */}
      {compact || repartition ? null : (
        <View style={[Alignments.row, { gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <TimePickerInput
              label={t('collectiviteCreneaux.attribuer.debut', 'Début')}
              onChange={(/** @type {string} */ valeur) => {
                setDebut(String(valeur || '').trim());
                toucherLaSaisie();
              }}
              placeholder="17:30"
              value={debut}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePickerInput
              label={t('collectiviteCreneaux.attribuer.fin', 'Fin')}
              onChange={(/** @type {string} */ valeur) => {
                setFin(String(valeur || '').trim());
                toucherLaSaisie();
              }}
              placeholder="19:00"
              value={fin}
            />
          </View>
        </View>
      )}
      {erreurHeures ? <Text style={[Fonts.p3, Fonts.error500]}>{erreurHeures}</Text> : null}

      {avecPeriode ? (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t('collectiviteCreneaux.attribuer.periode', 'Période'))}
          {dejaCommence ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'collectiviteCreneaux.periode.depuis',
                'Depuis le {{date}} : le créneau a commencé, son début ne change plus.',
                { date: formatDay(debutActuel), ...SANS_ECHAPPEMENT },
              )}
            </Text>
          ) : (
            <DatePickerInput
              label={t('collectiviteCreneaux.periode.du', 'Du')}
              minimumDate={new Date()}
              onChange={(/** @type {string} */ valeur) => {
                setPeriodeDu(valeur);
                toucherLaSaisie();
              }}
              value={periodeDu}
            />
          )}
          <DatePickerInput
            label={t('collectiviteCreneaux.periode.au', 'Au')}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ valeur) => {
              setPeriodeAu(valeur);
              toucherLaSaisie();
            }}
            value={periodeAu}
          />
          {periodeJuste ? null : (
            <Text style={[Fonts.p3, Fonts.error500]}>
              {t(
                'collectiviteCreneaux.periode.ordre',
                'La fin de la période doit suivre son début.',
              )}
            </Text>
          )}
        </View>
      ) : null}

      {modification ? (
        <DatePickerInput
          label={t('collectiviteCreneaux.attribuer.aPartirDu', 'À partir du')}
          minimumDate={new Date()}
          onChange={(/** @type {string} */ valeur) => {
            setAPartirDu(valeur);
            toucherLaSaisie();
          }}
          value={aPartirDu}
        />
      ) : null}

      {carteDeLaPlace}
      {lesHeuresLibres}

      {modification || compact ? null : (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t('collectiviteCreneaux.attribuer.periode', 'Période'))}
          <Text style={[Fonts.p2, Fonts.neutral00]}>{periode}</Text>
        </View>
      )}

      {/* D66 : le champ « Plateau » n existe que si l installation a des plateaux nommes. */}
      {plateaux.length && !repartition ? (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t('collectiviteCreneaux.attribuer.plateau', 'Plateau'))}
          {rangee([
            <PuceDeChoix
              actif={!plateau}
              key="plateau-indifferent"
              libelle={t('collectiviteCreneaux.attribuer.indifferent', 'Indifférent')}
              onPress={() => {
                setPlateau(null);
                toucherLaSaisie();
              }}
            />,
            ...plateaux.map((/** @type {string} */ nom, /** @type {number} */ index) => (
              <PuceDeChoix
                actif={plateau === index + 1}
                key={`plateau-${index + 1}`}
                libelle={String(nom)}
                onPress={() => {
                  setPlateau(index + 1);
                  toucherLaSaisie();
                }}
              />
            )),
          ])}
        </View>
      ) : null}

      {compact && jour ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteCreneaux.attribuer.chaqueSemaine',
            'Chaque {{jour}} de la saison ({{periode}}). Le club est prévenu.',
            {
              jour: weekdayName(jour).toLocaleLowerCase(),
              periode: saison
                ? formatPeriod(saison.validFrom, saison.validUntil, { withYear: false })
                : '',
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
      ) : null}
      {repartition ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'clubInstallations.repartir.prevenu',
            'Les entraîneurs de l’équipe choisie sont prévenus.',
          )}
        </Text>
      ) : null}
      {!compact && !repartition && nomDuClub ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {modification
            ? t(
              'collectiviteCreneaux.attribuer.prevenuChangement',
              '{{club}} sera prévenu du changement.',
              {
                club: nomDuClub,
                ...SANS_ECHAPPEMENT,
              },
            )
            : t(
              'collectiviteCreneaux.attribuer.prevenu',
              '{{club}} sera prévenu, et verra ce créneau dans son planning.',
              { club: nomDuClub, ...SANS_ECHAPPEMENT },
            )}
        </Text>
      ) : null}

      {erreur ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>{erreur}</Text>
      ) : null}

      <View style={{ gap: 4 }}>
        {besoinDeConfirmer ? (
          <>
            <Button
              isLoading={envoiEnCours}
              onPress={() => envoyer(true)}
              title={modification
                ? t('collectiviteCreneaux.attribuer.enregistrerQuandMeme', 'Enregistrer quand même')
                : t('collectiviteCreneaux.attribuer.quandMeme', 'Attribuer quand même')}
              variant="Primary"
            />
            <Button
              onPress={changerLHeure}
              title={t('collectiviteCreneaux.attribuer.changerHeure', 'Changer l’heure')}
              variant="Ghost"
            />
          </>
        ) : (
          <Button
            disabled={!pret}
            isLoading={envoiEnCours}
            onPress={() => envoyer(false)}
            title={(() => {
              if (modification) {
                return t('collectiviteCreneaux.attribuer.enregistrer', 'Enregistrer');
              }
              if (compact) {
                return t('collectiviteCreneaux.attribuer.pourLaSaison', 'Attribuer pour la saison');
              }
              return t('collectiviteCreneaux.attribuer.valider', 'Attribuer le créneau');
            })()}
            variant="Primary"
          />
        )}
        {onCancel && !besoinDeConfirmer ? (
          <Button
            onPress={onCancel}
            title={t('common.cancel', 'Annuler')}
            variant="Ghost"
          />
        ) : null}
      </View>
    </View>
  );
}

export default SeasonSlotForm;
