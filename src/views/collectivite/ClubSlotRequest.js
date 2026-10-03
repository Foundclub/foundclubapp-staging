import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parse } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  datesDeLaDemande,
  finDeSaison,
  horsOuverture,
} from '@/domains/collectivite/collectiviteDemandes';
import { payloadsDeLaDemande } from '@/domains/collectivite/collectiviteDemandesEnvoi';
import { isTrainingEventType } from '@/domains/event/eventUseCases';
import {
  freeRanges,
  fromMinutes,
  fullRanges,
  isoWeekdayOf,
  isTime,
  toMinutes,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import { PuceDeChoix } from '@/components/organisms/seasonSlot/SeasonSlotForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEventTypes } from '@/services/event/eventQueries';
import { createEventsSequentially } from '@/services/event/eventService';
import { useClubCollectiviteFacilities } from '@/services/facility/facilityQueries';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import { useClubTeamsForSlot, useSeasonSlotPreview } from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { getPlanningItemWindow } from '@/utils/planning/planningSlots';

// Au-delà de cette largeur (ordinateur), la saisie et la place côte à côte.
const LARGEUR_DEUX_COLONNES = 1024;

/**
 * Un jour « JJ/MM/AAAA » (le champ date) en « AAAA-MM-JJ », ou ''.
 * @param {string} valeur - La valeur du champ.
 * @returns {string} Le jour ISO, ou ''.
 */
const versIso = (valeur) => {
  const date = parse(String(valeur || ''), 'dd/MM/yyyy', new Date());
  return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd');
};

/**
 * Un jour « AAAA-MM-JJ » en « JJ/MM/AAAA » (le champ date), ou ''.
 * @param {string | undefined} valeur - Le jour ISO.
 * @returns {string} La valeur du champ.
 */
const versChamp = (valeur) => {
  const date = parse(String(valeur || ''), 'yyyy-MM-dd', new Date());
  return Number.isNaN(date.getTime()) ? '' : format(date, 'dd/MM/yyyy');
};

/**
 * 🏛️ COLL-C3B (02/10) — LE CLUB DEMANDE UN CRÉNEAU (planches P8v2-demande, tel et ordi).
 *
 * Ouvert depuis une heure libre du planning d'une installation de la Ville (déjà rempli), ou
 * depuis « Tes demandes à la Ville ». La PLACE se lit pendant la saisie (contrat C2A §4.2, qui
 * compte aussi les séances datées : D75), avec qui est déjà là : club et équipe, jamais un nom
 * de personne (D71, D2). Complet ⇒ on ne bloque pas (« Tu peux demander quand même : la mairie
 * décidera »), et les heures libres du même jour se choisissent d'un appui. Seul blocage : hors
 * des heures d'ouverture. L'envoi pose l'entraînement (une date, ou chaque semaine jusqu'à la fin
 * de la saison) ; hors des créneaux du club, le serveur en fait une demande à la mairie, place
 * libre ou non (SPEC-PLACE, DECISIONS-SOIR 02/10), « Un mot pour la mairie » en est le motif. Puis
 * l'accusé de réception, qui dit qui décide, et « Tes demandes à la Ville ».
 * Au « tu » : c'est un club qui lit.
 * COLL-C3B-BIS (03/10) — planche 43 : « Changer » d'installation ; et sur ORDINATEUR, la même
 * saisie s'ouvre en PANNEAU à droite du planning de l'installation (`enPanneau`), qui dessine
 * pendant la saisie la place demandée en pointillé (`onBrouillon` : le jour, les heures, l'équipe).
 * @param {{ enPanneau?: boolean, initial?: Record<string, any> | null,
 *   onBrouillon?: ((brouillon: Record<string, any> | null) => void) | null,
 *   onFermer?: (() => void) | null }} [props] - En panneau : les valeurs du planning, le brouillon
 *   rendu au planning, et la fermeture du panneau. Sans props : l'écran, rempli par la route.
 * @returns {import('react').ReactElement} L'écran, ou le panneau.
 */
function ClubSlotRequest({
  enPanneau = false, initial = null, onBrouillon = null, onFermer = null,
} = {}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {Record<string, any>} */ (
    enPanneau ? initial || {} : route?.params || {}
  );
  const { userData } = /** @type {any} */ (useAuth()) || {};
  const clubId = params.clubId || userData?.club?.documentId || null;
  const { width } = useWindowDimensions();
  const deuxColonnes = !enPanneau && width >= LARGEUR_DEUX_COLONNES;
  const queryClient = useQueryClient();

  const [installationId, setInstallationId] = useState(params.facilityId || null);
  const [equipe, setEquipe] = useState(params.teamId || null);
  const [hebdo, setHebdo] = useState(false);
  const [jour, setJour] = useState(versChamp(params.date));
  const [debut, setDebut] = useState(params.startTime || '');
  const [fin, setFin] = useState(params.endTime || '');
  const [mot, setMot] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(/** @type {any} */ (null));

  const installations = useClubCollectiviteFacilities(clubId);
  /** @type {any[]} */
  const liste = Array.isArray(installations.data) ? installations.data : [];
  const installation = liste.find((f) => f?.documentId === installationId) || null;
  const nomDeLaVille = installation?.collectivite?.name || '';
  const equipes = useClubTeamsForSlot(clubId);
  const typesDEvenement = useGetEventTypes();
  const typeEntrainement = (Array.isArray(typesDEvenement.data) ? typesDEvenement.data : [])
    .find((type) => isTrainingEventType(type?.name)) || null;

  const jourIso = versIso(jour);
  // eslint-disable-next-line max-len
  const heuresLisibles = isTime(debut) && isTime(fin) && (toMinutes(debut) ?? 0) < (toMinutes(fin) ?? 0);
  const ouverture = toMinutes(installation?.openingTime);
  const fermeture = toMinutes(installation?.closingTime);
  const horsHeures = heuresLisibles
    ? horsOuverture({
      debut: toMinutes(debut), fermeture, fin: toMinutes(fin), ouverture,
    })
    : null;

  // 🧭 COLL-FIX2 (03/10) — l'aperçu est demandé AU NOM du club et de l'équipe : le serveur dit
  // alors ce qu'il fera de la séance (`decision`, mêmes juges qu'event.create : D32, la place,
  // SPEC-PLACE). Tournée T10 : « complet, la mairie décidera », puis « C'est posé ».
  const parametresApercu = useMemo(() => (
    installationId && jourIso && heuresLisibles
      ? {
        ...(clubId ? { club: clubId } : {}),
        endTime: fin,
        startTime: debut,
        ...(equipe ? { team: equipe } : {}),
        validFrom: jourIso,
        validUntil: hebdo ? finDeSaison(jourIso) : jourIso,
        weekday: isoWeekdayOf(parse(jourIso, 'yyyy-MM-dd', new Date())),
      }
      : null
  ), [clubId, debut, equipe, fin, hebdo, heuresLisibles, installationId, jourIso]);
  const apercu = useSeasonSlotPreview(installationId, parametresApercu);
  const place = apercu.data?.data || null;
  // Ce que le serveur fera : `direct`, `dirigeant`, `mairie`, `complet` ; absent (serveur
  // ancien, juge en panne) : la phrase prudente d'avant.
  /** @type {{ inClubSlot?: boolean, outcome?: string } | null} */
  const decision = place?.decision || null;
  const issue = decision?.outcome || null;

  // Les heures libres du même jour (P8v2, état 2) : l'ouverture moins les moments complets.
  const planningDuJour = useQuery({
    enabled: Boolean(installationId && jourIso),
    queryFn: () => getFacilityPlanning(String(installationId), { from: jourIso, to: jourIso }),
    queryKey: ['planning', 'facility', installationId, jourIso, 'demande'],
    staleTime: 30_000,
  });
  const heuresLibres = useMemo(() => {
    const reponse = /** @type {any} */ (planningDuJour.data);
    /** @type {any[]} */
    const blocs = Array.isArray(reponse?.data) ? reponse.data : [];
    const capacite = Math.max(
      1,
      Number(installation?.maxSlots || reponse?.meta?.facility?.maxSlots || 1),
    );
    const minutes = (/** @type {Date} */ date) => date.getHours() * 60 + date.getMinutes();
    const occupees = blocs.map((bloc) => {
      const fenetre = getPlanningItemWindow(bloc);
      // eslint-disable-next-line max-len
      return fenetre ? { end: minutes(fenetre.endAt), start: minutes(fenetre.startAt) } : { end: 0, start: 0 };
    });
    return freeRanges(fullRanges(occupees, capacite), ouverture ?? 8 * 60, fermeture ?? 22 * 60);
  }, [fermeture, installation?.maxSlots, ouverture, planningDuJour.data]);

  const nombreDEquipes = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.uneEquipe', '1 équipe')
    : t('collectiviteDemandes.nombre.equipes', '{{nombre}} équipes', { nombre }));
  const nombreDePlaces = (/** @type {number} */ nombre) => (nombre === 1
    ? t('collectiviteDemandes.nombre.unePlace', '1 place')
    : t('collectiviteDemandes.nombre.places', '{{nombre}} places', { nombre }));
  /** @type {any[]} */
  const listeDEquipes = Array.isArray(equipes.data) ? equipes.data : [];
  const nomDeLEquipe = listeDEquipes.find((e) => e?.documentId === equipe)?.name || '';
  const complet = Boolean(place && Number(place.remaining) === 0);
  const posee = issue === 'direct';
  const refusee = issue === 'complet';
  const pourLaMairie = !posee && issue !== 'dirigeant';

  const envoyer = async () => {
    // eslint-disable-next-line max-len
    if (!clubId || !installationId || !equipe || !typeEntrainement || !jourIso || !heuresLisibles || horsHeures || refusee) return;
    setEnvoi(true);
    setErreur('');
    try {
      const corps = payloadsDeLaDemande({
        clubId,
        dates: datesDeLaDemande(jourIso, hebdo),
        debut,
        facilityId: installationId,
        fin,
        groupe: hebdo ? `${Date.now()}-${Math.random().toString(36).slice(2, 11)}` : null,
        mot,
        teamId: equipe,
        type: typeEntrainement.documentId,
        typeName: typeEntrainement.name,
      });
      // eslint-disable-next-line max-len
      const { created, failed } = await createEventsSequentially(corps, { suppressCelebration: true });
      if (!created.length) {
        setErreur(getErrorMessage(/** @type {any} */ (failed[0]?.error)));
        return;
      }
      const statut = (/** @type {any} */ c) => c?.response?.data?.status || c?.response?.status;
      // 🏛️ DECISIONS-SOIR (02/10) — QUI DÉCIDE, le serveur le dit (`pendingReason`) : la mairie
      // hors des créneaux du club, place libre ou non (SPEC-PLACE) ; le dirigeant du club quand son
      // créneau est déjà au complet (D32). Confirmée : elle tombait dans un créneau du club.
      // eslint-disable-next-line max-len
      const raison = (/** @type {any} */ c) => c?.response?.data?.pendingReason || c?.response?.pendingReason;
      const enAttente = created.filter((c) => statut(c) === 'pending_validation');
      setResultat({
        enAttente: enAttente.some((c) => raison(c) !== 'club_slot_overflow'),
        enAttenteDuDirigeant: enAttente.some((c) => raison(c) === 'club_slot_overflow'),
        posees: created.length,
        ratees: failed.length,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['facility-override-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['planning'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
      ]);
    } catch (error) {
      setErreur(getErrorMessage(/** @type {any} */ (error)));
    } finally {
      setEnvoi(false);
    }
  };

  // COLL-C3B-BIS (planche 43) — en panneau, le planning dessine la place demandée en pointillé
  // pendant la saisie : il reçoit le brouillon (jour, heures, équipe), et rien une fois envoyé.
  const brouillonPret = Boolean(installationId && jourIso && heuresLisibles && !resultat);
  useEffect(() => {
    if (!onBrouillon) return;
    onBrouillon(brouillonPret
      ? {
        date: jourIso,
        endTime: fin,
        equipe: nomDeLEquipe,
        facilityId: installationId,
        startTime: debut,
      }
      : null);
  }, [brouillonPret, debut, fin, installationId, jourIso, nomDeLEquipe, onBrouillon]);

  const titreDuChamp = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, Fonts.neutral300]}>{texte}</Text>
  );
  const carte = {
    backgroundColor: withAlpha(Colors.neutral00, 0.04),
    borderColor: withAlpha(Colors.neutral00, 0.09),
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 16,
  };
  const leMoment = () => {
    const date = parse(jourIso, 'yyyy-MM-dd', new Date());
    if (hebdo) {
      return t(
        'collectiviteDemandes.club.momentSerie',
        '{{equipe}} · chaque {{jour}}, {{debut}} – {{fin}}, jusqu’au {{jusquAu}} · {{lieu}}',
        {
          debut,
          equipe: nomDeLEquipe,
          fin,
          jour: format(date, 'EEEE', { locale: fr }),
          // COLL-FIX2 (T10) : la DERNIÈRE séance de la série (celle que le serveur et la Ville
          // disent), pas la fin de saison : « 30 juin » ici, « 24 juin » chez la Ville.
          // eslint-disable-next-line max-len
          jusquAu: format(parse(datesDeLaDemande(jourIso, true).at(-1) || finDeSaison(jourIso), 'yyyy-MM-dd', new Date()), 'd MMMM', { locale: fr }),
          lieu: installation?.name || '',
          ...SANS_ECHAPPEMENT,
        },
      );
    }
    // eslint-disable-next-line max-len
    return t('collectiviteDemandes.club.momentUnique', '{{equipe}} · {{jour}}, {{debut}} – {{fin}} · {{lieu}}', {
      debut,
      equipe: nomDeLEquipe,
      fin,
      jour: format(date, 'EEE d MMM', { locale: fr }),
      lieu: installation?.name || '',
      ...SANS_ECHAPPEMENT,
    });
  };

  // ─── L'accusé de réception (P8v2, état 4) ────────────────────────────────────────────────
  if (resultat) {
    let titreAccuse = t('collectiviteDemandes.club.posee', 'C’est posé : c’est dans ton créneau');
    let suiteAccuse = t(
      'collectiviteDemandes.club.confirme',
      'Ton entraînement est confirmé : la Ville a déjà attribué ce créneau à ton club.',
    );
    if (resultat.enAttente) {
      titreAccuse = t('collectiviteDemandes.club.envoyee', 'Demande envoyée à la {{ville}}', {
        ville: nomDeLaVille || t('collectiviteDemandes.club.laVille', 'Ville'),
        ...SANS_ECHAPPEMENT,
      });
      suiteAccuse = t(
        'collectiviteDemandes.club.ensuite',
        'La mairie l’accepte ou la refuse. Tu reçois sa réponse en notification, avec son mot.',
      );
    } else if (resultat.enAttenteDuDirigeant) {
      titreAccuse = t(
        'collectiviteDemandes.club.envoyeeDirigeant',
        'Demande envoyée à ton dirigeant',
      );
      suiteAccuse = t(
        'collectiviteDemandes.club.ensuiteDirigeant',
        // eslint-disable-next-line max-len
        'Ton club est déjà au complet dans son créneau à ce moment : ton dirigeant l’accepte ou la refuse. Tu reçois sa réponse en notification.',
      );
    }
    const contenuAccuse = (
      <>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]} testID="demande-accuse-titre">
          {titreAccuse}
        </Text>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{leMoment()}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{suiteAccuse}</Text>
        {resultat.enAttente || resultat.enAttenteDuDirigeant ? (
          <View
            style={[carte, { borderColor: Colors.warning500, borderStyle: 'dashed' }]}
            testID="demande-accuse-attente"
          >
            <Text style={[Fonts.p3Bold, { color: Colors.warning500 }]}>
              {resultat.enAttente
                ? t('collectiviteDemandes.club.enAttenteDeLaMairie', 'En attente de la mairie')
                : t(
                  'collectiviteDemandes.club.enAttenteDuDirigeant',
                  'En attente de ton dirigeant',
                )}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {`${nomDeLEquipe} · ${debut} – ${fin}`}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('collectiviteDemandes.club.commeDansTonPlanning', 'Comme dans ton planning.')}
            </Text>
          </View>
        ) : null}
        {resultat.ratees ? (
          <Text style={[Fonts.p3Bold, Fonts.error500]}>
            {t(
              'collectiviteDemandes.club.ratees',
              '{{nombre}} date(s) n’ont pas pu être envoyées : réessaie depuis ton planning.',
              { nombre: resultat.ratees },
            )}
          </Text>
        ) : null}
        <Button
          onPress={() => navigation.navigate(RouteNames.ClubSlotRequests, { clubId })}
          title={t('collectiviteDemandes.club.voirMesDemandes', 'Voir mes demandes')}
          variant="Primary"
        />
        <Button
          onPress={() => (onFermer ? onFermer() : navigation.goBack?.())}
          title={t('collectiviteDemandes.fenetre.fermer', 'Fermer')}
          variant="Ghost"
        />
      </>
    );
    // COLL-C3B-BIS (planche 43, état B) : en panneau, l'accusé prend la place de la saisie.
    if (enPanneau) return <View style={{ gap: 16, padding: 16 }}>{contenuAccuse}</View>;
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 16 }}>
          {contenuAccuse}
        </ScrollView>
      </ScreenContainer>
    );
  }

  // ─── La place pendant la saisie (P8v2, états 1 et 2) ─────────────────────────────────────
  let carteDeLaPlace = null;
  if (horsHeures) {
    const heure = fromMinutes(horsHeures.heure);
    carteDeLaPlace = (
      <View style={[carte, { borderColor: Colors.error500 }]} testID="demande-hors-ouverture">
        <Text style={[Fonts.p2Bold, Fonts.error500]}>
          {horsHeures.cas === 'ferme'
            // eslint-disable-next-line max-len
            ? t('collectiviteDemandes.club.ferme', 'L’installation ferme à {{heure}}. Termine à {{heure}}, ou commence plus tôt.', { heure, ...SANS_ECHAPPEMENT })
            // eslint-disable-next-line max-len
            : t('collectiviteDemandes.club.ouvre', 'L’installation ouvre à {{heure}}. Commence à {{heure}}, ou plus tard.', { heure, ...SANS_ECHAPPEMENT })}
        </Text>
      </View>
    );
  } else if (place) {
    const occupants = Array.isArray(place.occupants) ? place.occupants : [];
    const equipesLa = Math.max(0, Number(place.capacity) - Number(place.remaining));
    // 🧮 FINITIONS12-COLL (03/10) — UNE SÉRIE SE LIT DATE PAR DATE (tournée T11 : « Il y a déjà
    // 39 équipes : c'est complet » pour 38 jeudis dont UN plein). Le serveur rend une ligne
    // d'occupant par séance datée de la période et la place au PIC ; `occurrences` dit combien
    // de dates sont pleines. Une série compte donc les équipes au pic, jamais les lignes.
    /** @type {{ count?: number, fullCount?: number, fullDates?: string[] } | null} */
    const dates = hebdo && Number(place.occurrences?.count) > 1 ? place.occurrences : null;
    const pleines = Number(dates?.fullCount || 0);
    let phrase;
    if (equipesLa === 0 && !occupants.length) {
      phrase = t('collectiviteDemandes.place.personne', 'Personne n’y est : il reste {{places}}.', {
        places: nombreDePlaces(Number(place.remaining)), ...SANS_ECHAPPEMENT,
      });
    } else if (dates && pleines > 0 && pleines < Number(dates.count)) {
      const jours = (Array.isArray(dates.fullDates) ? dates.fullDates : [])
        .map((date) => format(parse(date, 'yyyy-MM-dd', new Date()), 'EEE d MMM', { locale: fr }))
        .join(', ');
      phrase = t(
        'collectiviteDemandes.place.serieCompleteCertaines',
        'Complet {{nombre}} fois sur {{total}} dates : {{dates}}',
        {
          dates: pleines > 4 ? `${jours} …` : jours,
          nombre: pleines,
          total: Number(dates.count),
          ...SANS_ECHAPPEMENT,
        },
      );
    } else if (dates && pleines > 0) {
      // eslint-disable-next-line max-len
      phrase = t('collectiviteDemandes.serie.completesToutes', 'Complet chaque semaine : il y a déjà {{equipes}}.', {
        equipes: nombreDEquipes(equipesLa), ...SANS_ECHAPPEMENT,
      });
    } else if (complet) {
      phrase = t('collectiviteDemandes.place.complet', 'Il y a déjà {{equipes}} : c’est complet.', {
        equipes: nombreDEquipes(dates ? equipesLa : Math.max(equipesLa, occupants.length)),
        ...SANS_ECHAPPEMENT,
      });
    } else {
      // eslint-disable-next-line max-len
      phrase = t('collectiviteDemandes.place.reste', 'Il y a déjà {{equipes}} : il reste {{places}}.', {
        // eslint-disable-next-line max-len
        equipes: nombreDEquipes(equipesLa), places: nombreDePlaces(Number(place.remaining)), ...SANS_ECHAPPEMENT,
      });
    }
    // Une ligne par club · équipe · heures : une série les répète une fois par date.
    const uniques = occupants.filter((/** @type {any} */ occupant, /** @type {number} */ rang) => (
      occupants.findIndex((/** @type {any} */ autre) => (
        autre?.club?.documentId === occupant?.club?.documentId
        && autre?.team?.name === occupant?.team?.name
        && autre?.startTime === occupant?.startTime
        && autre?.endTime === occupant?.endTime
      )) === rang
    ));
    const noms = uniques.slice(0, 4).map((/** @type {any} */ occupant) => {
      const nom = [occupant?.club?.name, occupant?.team?.name].filter(Boolean).join(' · ');
      const tonClub = occupant?.club?.documentId && occupant.club.documentId === clubId
        ? t('collectiviteDemandes.club.tonClub', ' (ton club)')
        : '';
      return t('collectiviteDemandes.club.dejaLa', '{{nom}}{{tonClub}}, de {{debut}} à {{fin}}', {
        // eslint-disable-next-line max-len
        debut: occupant?.startTime || '', fin: occupant?.endTime || '', nom, tonClub, ...SANS_ECHAPPEMENT,
      });
    });
    let suite = complet
      ? t(
        'collectiviteDemandes.club.quandMeme',
        'Tu peux demander quand même : la mairie décidera.',
      )
      : null;
    let couleurDeLaSuite = Colors.warning500;
    if (posee) {
      couleurDeLaSuite = Colors.success500;
      suite = decision?.inClubSlot
        ? t(
          'collectiviteDemandes.decision.creneauDuClub',
          'C’est dans le créneau de ton club : ton entraînement sera posé tout de suite.',
        )
        : t('collectiviteDemandes.decision.posee', 'Ton entraînement sera posé tout de suite.');
    } else if (issue === 'dirigeant') {
      suite = t(
        'collectiviteDemandes.decision.dirigeant',
        'Ton club est déjà au complet dans son créneau : ton dirigeant décidera.',
      );
    } else if (refusee) {
      couleurDeLaSuite = Colors.error500;
      suite = t(
        'collectiviteDemandes.decision.complet',
        'C’est complet : l’installation n’accepte pas d’équipe en plus. Choisis une autre heure.',
      );
    } else if (issue === 'mairie' && !complet) {
      suite = t(
        'collectiviteDemandes.decision.mairieLibre',
        'Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place.',
      );
    }
    let bordure = complet ? Colors.warning500 : Colors.success500;
    if (issue) bordure = couleurDeLaSuite;
    carteDeLaPlace = (
      <View
        style={[carte, { borderColor: bordure }]}
        testID="demande-place"
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{phrase}</Text>
        {noms.length ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('collectiviteDemandes.club.dejaLaListe', 'Déjà là : {{noms}}.', {
              noms: noms.join(t('collectiviteDemandes.liaison.et', ' et ')), ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {suite ? (
          <Text style={[Fonts.p3Bold, { color: couleurDeLaSuite }]} testID="demande-decision">
            {suite}
          </Text>
        ) : null}
      </View>
    );
  }

  let titreDuBouton = t('collectiviteDemandes.club.envoyer', 'Envoyer la demande');
  if (posee) titreDuBouton = t('collectiviteDemandes.decision.poser', 'Poser l’entraînement');
  else if (complet && pourLaMairie && !refusee) {
    titreDuBouton = t('collectiviteDemandes.club.envoyerQuandMeme', 'Envoyer quand même');
  }

  const saisie = (
    <View style={{ gap: 16 }}>
      {installation ? (
        <View style={carte} testID="demande-installation">
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
            <Text style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>{installation.name}</Text>
            {/* COLL-C3B-BIS (planche 43) : « Changer » rend le choix de l'installation. */}
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setInstallationId(null)}
              testID="demande-installation-changer"
            >
              <Text style={[Fonts.p2Bold, Fonts.primary200]}>
                {t('collectiviteDemandes.club.changer', 'Changer')}
              </Text>
            </Pressable>
          </View>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t('collectiviteDemandes.club.installation', '{{ville}} · {{equipes}} à la fois', {
              equipes: nombreDEquipes(Math.max(1, Number(installation.maxSlots || 1))),
              ville: nomDeLaVille,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {titreDuChamp(t(
            'collectiviteDemandes.club.choisirInstallation',
            'Installation de la Ville',
          ))}
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            {liste.map((f) => (
              <PuceDeChoix
                actif={false}
                key={f.documentId}
                libelle={String(f.name || '')}
                onPress={() => setInstallationId(f.documentId)}
                testID={`demande-installation-${f.documentId}`}
              />
            ))}
          </View>
          {installations.isLoading || liste.length ? null : (
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t(
                'collectiviteDemandes.club.aucuneInstallation',
                'Ton club n’est rattaché à aucune Ville pour l’instant.',
              )}
            </Text>
          )}
        </View>
      )}

      <View style={{ gap: 8 }}>
        {titreDuChamp(t('collectiviteDemandes.club.equipe', 'Équipe'))}
        <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
          {listeDEquipes.map((e) => (
            <PuceDeChoix
              actif={e.documentId === equipe}
              key={e.documentId}
              libelle={String(e.name || '')}
              onPress={() => setEquipe(e.documentId)}
              testID={`demande-equipe-${e.documentId}`}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        {titreDuChamp(t('collectiviteDemandes.club.combienDeFois', 'Combien de fois'))}
        <View style={[Alignments.row, { gap: 8 }]}>
          <PuceDeChoix
            actif={!hebdo}
            libelle={t('collectiviteDemandes.pastille.uneFois', 'Une fois')}
            onPress={() => setHebdo(false)}
            testID="demande-une-fois"
          />
          <PuceDeChoix
            actif={hebdo}
            libelle={t('collectiviteDemandes.pastille.chaqueSemaine', 'Chaque semaine')}
            onPress={() => setHebdo(true)}
            testID="demande-chaque-semaine"
          />
        </View>
      </View>

      <DatePickerInput
        label={t('collectiviteDemandes.club.jour', 'Jour')}
        minimumDate={new Date()}
        onChange={(/** @type {string} */ valeur) => setJour(valeur)}
        value={jour}
      />
      <View style={[Alignments.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Input
            density="compact"
            label={t('collectiviteCreneaux.attribuer.debut', 'Début')}
            onChangeText={(/** @type {string} */ valeur) => setDebut(valeur.trim())}
            placeholder="18:00"
            testID="demande-debut"
            value={debut}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            density="compact"
            label={t('collectiviteCreneaux.attribuer.fin', 'Fin')}
            onChangeText={(/** @type {string} */ valeur) => setFin(valeur.trim())}
            placeholder="19:30"
            testID="demande-fin"
            value={fin}
          />
        </View>
      </View>
    </View>
  );

  const placeEtEnvoi = (
    <View style={{ gap: 16 }}>
      {carteDeLaPlace}
      {jourIso && heuresLibres.length && complet && !posee ? (
        <View style={{ gap: 8 }} testID="demande-heures-libres">
          {titreDuChamp(t('collectiviteDemandes.club.libreCeJour', 'Libre ce {{jour}} :', {
            jour: format(parse(jourIso, 'yyyy-MM-dd', new Date()), 'EEEE', { locale: fr }),
            ...SANS_ECHAPPEMENT,
          }))}
          <View style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
            {heuresLibres.map((plage) => (
              <PuceDeChoix
                actif={false}
                key={`${plage.start}-${plage.end}`}
                libelle={`${fromMinutes(plage.start)} – ${fromMinutes(plage.end)}`}
                onPress={() => {
                  setDebut(fromMinutes(plage.start));
                  setFin(fromMinutes(Math.min(plage.start + 90, plage.end)));
                }}
                testID={`demande-libre-${fromMinutes(plage.start)}`}
              />
            ))}
          </View>
        </View>
      ) : null}
      {pourLaMairie ? (
        <Input
          // eslint-disable-next-line max-len
          label={t('collectiviteDemandes.club.motPourLaMairie', 'Un mot pour la mairie (facultatif)')}
          multiline
          onChangeText={(/** @type {string} */ valeur) => setMot(valeur)}
          testID="demande-mot"
          value={mot}
        />
      ) : null}
      {pourLaMairie ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteDemandes.club.quiDecide',
            'La {{ville}} accepte ou refuse ; tu reçois sa réponse en notification.',
            // eslint-disable-next-line max-len
            { ville: nomDeLaVille || t('collectiviteDemandes.club.laVille', 'Ville'), ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : null}
      {/* FINITIONS12-COLL (03/10) — `creation` : ce qui arrive si la mairie refuse, comme au */}
      {/* déplacement (FINITIONS11-COLL point 7, même clé). Prouvé côté serveur : une séance */}
      {/* créée hors créneau puis refusée est annulée (banc vrai moteur ; admin COLL3A T5). */}
      {pourLaMairie && !refusee ? (
        <Text style={[Fonts.p3Bold, Fonts.neutral200]} testID="demande-si-refus">
          {t(
            'collectiviteDemandes.decision.siRefusAnnulee',
            'Si la mairie refuse, la séance sera annulée.',
          )}
        </Text>
      ) : null}
      {issue === 'dirigeant' ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteDemandes.decision.quiDecideDirigeant',
            'Ton dirigeant accepte ou refuse ; tu reçois sa réponse en notification.',
          )}
        </Text>
      ) : null}
      {erreur ? <Text style={[Fonts.p3Bold, Fonts.error500]}>{erreur}</Text> : null}
      <Button
        // eslint-disable-next-line max-len
        disabled={envoi || Boolean(horsHeures) || refusee || !equipe || !installationId || !jourIso || !heuresLisibles || !typeEntrainement}
        isLoading={envoi}
        onPress={envoyer}
        title={titreDuBouton}
        variant="Primary"
      />
    </View>
  );

  // COLL-C3B-BIS (planche 43, état A) — sur ordinateur, à droite du planning : le titre de la
  // planche, la saisie puis la place, en une colonne (le panneau défile déjà).
  if (enPanneau) {
    return (
      <View style={{ gap: 16, padding: 16 }} testID="demande-panneau">
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('collectiviteDemandes.club.titrePanneau', 'Demander ce créneau')}
        </Text>
        {saisie}
        {placeEtEnvoi}
      </View>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingTop: 16 }}>
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>
          {t('collectiviteDemandes.club.titre', 'Demander un créneau')}
        </Text>
        {deuxColonnes ? (
          <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
            <View style={{ flex: 1 }}>{saisie}</View>
            <View style={[ApplicationStyle.borderRadius16, Spaces.padding[0], { flex: 1 }]}>
              {placeEtEnvoi}
            </View>
          </View>
        ) : (
          <>
            {saisie}
            {placeEtEnvoi}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

export default ClubSlotRequest;
