import {
  format, isValid, parse, parseISO,
} from 'date-fns';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground, Modal, Text, TouchableOpacity, View,
} from 'react-native';

import {
  formatDay,
  formatDayMonth,
  freeRanges,
  fromMinutes,
  fullRanges,
  fullRangesOfSlots,
  isoWeekdayOf,
  isTime,
  overCapacityPreviewOf,
  SEASON_SLOT_WEEKDAYS,
  seasonSlotErrorMessage,
  slotOccursOn,
  slotWho,
  timeRange,
  toMinutes,
  weekdayName,
} from '@/domains/seasonSlot/seasonSlotDisplay';
import {
  nomDeVacances, periodesGardeesDuCreneau, vacancesDesSeances,
} from '@/domains/seasonSlot/seasonSlotHolidays';
import {
  corpsDuQuand,
  creneauDuQuand,
  fermeturesTouchees,
  quandDeLaRepetition,
  quandDuCreneau,
  saisonDuJour,
  seancesDuQuand,
} from '@/domains/seasonSlot/seasonSlotWhen';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import DateEtHoraire, {
  debutDeRepetitionSuivant,
  joursDeRepetitionSuivants,
} from '@/components/organisms/dateEtHoraire/DateEtHoraire';
import RondsDePlaces from '@/components/organisms/seasonSlot/RondsDePlaces';
import SeasonSlotDatesCalendar from '@/components/organisms/seasonSlot/SeasonSlotDatesCalendar';

import {
  useAttributeSeasonSlot,
  useClubTeamsForSlot,
  useFacilitySeasonSlots,
  useModifySeasonSlot,
  useSeasonSlotPreview,
} from '@/services/seasonSlot/seasonSlotQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { getFacilityTypeLabel } from '@/utils/facilityTypes';
import texteInsecable from '@/utils/texteInsecable';

import { useAppFeedback } from '@/context/AppFeedbackContext';

// Deux elements aux deux bouts d une rangee.
const ENTRE_DEUX = /** @type {const} */ ({ gap: 8, justifyContent: 'space-between' });

/**
 * SAIS (08/10, tournée T20 lot 1, capture T07b) — la part de l écran que la FEUILLE « Attribuer
 * un créneau » peut prendre au téléphone (`maxContentHeightRatio` de BottomModal, 0,7 par
 * défaut). À 0,7, le formulaire dépassait : « Annuler » finissait coupé au bas de la feuille.
 * ponytail: un ratio, pas un pied fixe ; avec beaucoup de clubs rattachés (plusieurs rangées de
 * pastilles), la feuille défile de nouveau. Voie de sortie : les deux boutons en
 * `footerComponent` de BottomModal.
 */
export const HAUTEUR_DE_LA_FEUILLE = 0.85;

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
          // A7-UX (20/10) — 44 px, la cible minimale (mesuré au banc du site : 36 px).
          minHeight: 44,
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
 * 📐 COLL-R-A7 (COL-005, planche P4v4-attribuer) — une ligne a cocher du tunnel plein ecran
 * (`radio-row` du systeme de design) : le rond a gauche, l ecusson du club s il y en a un, le nom
 * EN ENTIER (« STADE MARSEILLAIS UNIVERSITE CLUB (SMUC) » passe a la ligne), une ligne de plus
 * en dessous (la place d une installation, « complet … » d un jour). Moins de gris (Adel, 13/10).
 * ponytail: `WizardOptionCard` (la carte des tunnels) coupe le nom a une ligne et met son rond a
 * droite ; la planche validee dit l inverse. Voie de sortie : lui donner ces deux options.
 * @param {{
 *   actif: boolean,
 *   avertissement?: boolean,
 *   club?: { logoUrl?: string | null, name: string } | null,
 *   couleur?: string | null,
 *   detail?: string | null,
 *   libelle: string,
 *   onPress: () => void,
 *   testID?: string,
 * }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDeChoix({
  actif, avertissement = false, club = null, couleur = null, detail = null, libelle, onPress,
  testID,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: actif
            ? withAlpha(Colors.primary500, 0.08)
            : withAlpha(Colors.primary800, 0.7),
          borderColor: actif ? Colors.primary500 : withAlpha(Colors.primary500, 0.3),
          borderLeftColor: couleur || undefined,
          borderLeftWidth: couleur ? 4 : 1,
          borderRadius: 12,
          borderWidth: 1,
          gap: 12,
          minHeight: 56,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      ]}
      testID={testID}
    >
      <View
        style={{
          alignItems: 'center',
          borderColor: actif ? Colors.primary500 : Colors.primary200,
          borderRadius: 12,
          borderWidth: 2,
          height: 24,
          justifyContent: 'center',
          width: 24,
        }}
      >
        {actif ? (
          <View
            style={{
              backgroundColor: Colors.primary500, borderRadius: 6, height: 12, width: 12,
            }}
          />
        ) : null}
      </View>
      {club ? (
        <ClubLogoMark logoUrl={club.logoUrl || undefined} name={club.name} size={28} />
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{libelle}</Text>
        {detail ? (
          <Text style={[Fonts.p3, avertissement ? Fonts.warning500 : Fonts.neutral200]}>
            {detail}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

/**
 * 📐 COLL-R-A7 — une ligne du recapitulatif (planche P4v4-attribuer, 5/5) : ce qu elle dit, en
 * petit ; sa valeur ; un crayon quand elle se touche (elle ramene a son etape, rien n est perdu).
 * @param {{
 *   cle: string,
 *   derniere?: boolean,
 *   detail?: string | null,
 *   libelleModifier: string,
 *   onPress?: () => void,
 *   testID: string,
 *   valeur: string,
 * }} props
 * @returns {import('react').ReactElement} La ligne.
 */
function LigneDuRecap({
  cle, derniere = false, detail = null, libelleModifier, onPress, testID, valeur,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  const contenu = (
    <>
      <View style={{ flex: 1 }}>
        <Text style={[Fonts.p3, Fonts.primary200]}>{cle}</Text>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{valeur}</Text>
        {detail ? <Text style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text> : null}
      </View>
      {onPress ? <SvgIcon color={Colors.neutral200} height={16} name="edit" width={16} /> : null}
    </>
  );
  const style = [
    Alignments.row,
    Alignments.alignCenter,
    {
      borderBottomColor: withAlpha(Colors.neutral00, 0.08),
      borderBottomWidth: derniere ? 0 : 1,
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
    },
  ];
  return onPress ? (
    <TouchableOpacity
      accessibilityLabel={libelleModifier}
      accessibilityRole="button"
      onPress={onPress}
      style={style}
      testID={testID}
    >
      {contenu}
    </TouchableOpacity>
  ) : <View style={style} testID={testID}>{contenu}</View>;
}

/**
 * 📐 COLL-R-A7 — la fenetre plein ecran du tunnel (le motif de « Convoquer », ConvocationWizard),
 * posee par l ecran : aucune route neuve. Elle passe sous les barres d Android
 * (`statusBarTranslucent`) ; le gabarit des tunnels reserve le haut (ScreenContainer) et le bas
 * (`insets.bottom + 12`). Le retour d Android appelle `onRequestClose`.
 * Elle peint son propre fond (le fond de l app) : sur le site, une fenetre est BLANCHE par defaut
 * et le gabarit compte sur le fond de la page (banc du site, 13/10 : titre blanc sur blanc).
 * @param {{ children: import('react').ReactNode, onRequestClose: () => void }} props
 * @returns {import('react').ReactElement} La fenetre.
 */
export function FenetrePleinEcran({ children, onRequestClose }) {
  const { Colors, Images } = useTheme();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onRequestClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
      transparent={false}
      visible
    >
      <ImageBackground
        resizeMode="cover"
        source={Images.bg2}
        style={{ backgroundColor: Colors.primary700, flex: 1 }}
      >
        {children}
      </ImageBackground>
    </Modal>
  );
}

/**
 * 📐 COLL-R-A7 — le meme plein ecran quand le tunnel ne peut pas encore s ouvrir (chargement,
 * erreur, Ville sans installation) : la question de l etape, la croix, ce qui l empeche.
 * Ici, et pas dans l ecran qui l ouvre : le gabarit des tunnels reste hors de `src/views`, ou
 * ANDROIDBAR-6 exige qu il soit rendu en racine (WizardStepLayoutANDROIDBAR6.clavier.test.js).
 * @param {{
 *   children: import('react').ReactNode,
 *   onClose: () => void,
 *   sousTitre?: string,
 *   titre: string,
 * }} props
 * @returns {import('react').ReactElement} La fenetre.
 */
export function TunnelEnAttente({
  children, onClose, sousTitre, titre,
}) {
  return (
    <FenetrePleinEcran onRequestClose={onClose}>
      <WizardStepLayout headerVariant="focus" onClose={onClose} subtitle={sousTitre} title={titre}>
        {children}
      </WizardStepLayout>
    </FenetrePleinEcran>
  );
}

/**
 * Les choix en cours de lecture, avec le squelette déjà utilisé dans l'app.
 * @returns {import('react').ReactElement} Trois lignes en attente.
 */
export function ChargementDesChoix() {
  const { Colors } = useTheme();
  return (
    <View accessibilityState={{ busy: true }} testID="season-slot-chargement">
      <SkeletonLoader
        backgroundColor={Colors.primary200}
        highlightColor={Colors.neutral200}
        isActive
      >
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((ligne) => (
            <View
              key={ligne}
              style={{ backgroundColor: Colors.primary200, borderRadius: 12, height: 56 }}
            />
          ))}
        </View>
      </SkeletonLoader>
    </View>
  );
}

/**
 * Une lecture refusée ou interrompue, avec son geste de reprise.
 * @param {{ erreur: any, onRetry?: () => any }} props - Lecture concernée.
 * @returns {import('react').ReactElement} Le message et Réessayer.
 */
export function LectureEnErreur({ erreur: refus, onRetry }) {
  const { t } = useTranslation();
  const { Fonts } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.neutral200]}>
        {getErrorMessage(refus)}
      </Text>
      <Button onPress={onRetry} title={t('common.retry', 'Réessayer')} variant="Secondary" />
    </View>
  );
}

/**
 * Les creneaux d un jour de la semaine type, sans celui qu on modifie.
 * @param {any} creneaux - Les creneaux de l installation (lecture).
 * @param {number | null} numero - Le jour ISO.
 * @param {string | undefined} exclu - Le creneau modifie.
 * @returns {any[]} Les creneaux de ce jour.
 */
const creneauxDuJour = (creneaux, numero, exclu) => (Array.isArray(creneaux) ? creneaux : [])
  .filter((creneau) => Number(creneau?.weekday) === Number(numero)
    && creneau?.documentId !== exclu);

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
 *
 * 📐 COLL-R-A7 (13/10, COL-005, decision d'Adel D4 A, planche P4v4-attribuer) — `pleinEcran` :
 * au telephone, le tunnel s ouvre dans une FENETRE PLEIN ECRAN posee par l ecran (aucune route
 * neuve), avec le gabarit des tunnels « Creer un evenement » (`WizardStepLayout`, en-tete
 * `focus`) : un titre en question par etape, la croix quitte, la fleche (et le retour d Android)
 * revient d une etape sans rien perdre, le recapitulatif se touche ligne par ligne. Sans lui (le
 * panneau de droite du site en grand ecran), rien ne change.
 * @param {{
 *   actionSecondaire?: { libelle: string, onPress: () => void } | null,
 *   ajouterUnClub?: () => void,
 *   clubs?: Array<{ documentId: string, logoUrl?: string | null, name: string }>,
 *   compact?: boolean,
 *   facilities?: Array<{ documentId: string, name: string }>,
 *   facilityId?: string | null,
 *   fixedClubId?: string | null,
 *   guided?: boolean,
 *   initial?: { weekday?: number, startTime?: string, endTime?: string, plateau?: number | null },
 *   lectureDesClubs?: { isLoading?: boolean, error?: any, refetch?: () => any } | null,
 *   onCancel?: () => void,
 *   onDone: (creneau: any) => void,
 *   pleinEcran?: boolean,
 *   repartition?: boolean,
 *   slot?: any,
 * }} props
 * @returns {import('react').ReactElement} Le formulaire.
 */
function SeasonSlotForm({
  actionSecondaire = null,
  ajouterUnClub,
  clubs = [],
  compact = false,
  facilities = [],
  facilityId: installationFixee = null,
  fixedClubId = null,
  guided = false,
  initial = {},
  lectureDesClubs = null,
  onCancel,
  onDone,
  pleinEcran = false,
  repartition = false,
  slot = null,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { showBanner } = useAppFeedback();
  const modification = Boolean(slot?.documentId);
  // IPH09 : tunnel local. La repartition du dirigeant garde son seul choix d'equipe.
  const parcoursGuide = guided && !repartition;
  // 📐 COLL-R-A7 (13/10, COL-005, decision d'Adel D4 A) — une etape sans rien a choisir est
  // SAUTEE : « Periode » (toute la saison, ecrite au recapitulatif), « Club » quand il est fixe
  // (fiche d'un club), « Jour » et « Horaires » depuis une heure libre du planning (la case les
  // apporte ; « Changer l'heure » les ROUVRE). « Modifier » garde ses 4 etapes : la periode s'y
  // choisit (COLL-C2B-BIS).
  const [heuresRouvertes, setHeuresRouvertes] = useState(false);
  const heuresFigees = compact && !heuresRouvertes;
  // 🗓️ R17-QUAND-1, point 4 (planche P10-quand-tel, état 0) — l'étape « Quand ? » vient APRÈS le
  // jour et l'heure (5 → 6 étapes) ; « Modifier » : « Période » devient « Quand ? ». Depuis une
  // case du planning (compact), pas d'étape de plus : la ligne « Quand » du récapitulatif la
  // rouvre. DATESDABORD (23/10) : à la création, « Jour », « Horaires » et « Quand ? » ne font
  // plus qu'une étape (« Date & horaire ») ; « Modifier » garde les siennes.
  const etapesDu = (/** @type {boolean} */ rouvertes) => (modification
    ? ['jour', 'horaires', 'quand', 'recap']
    : [
      ...(!installationFixee && facilities.length > 1 ? ['installation'] : []),
      // ⏰ A7-UX-2 (22/10, Adel « P2 oui ») — le club et l'équipe sur UNE étape (« Pour qui ? ») ;
      // un club fixé (fiche d'un club) garde l'étape « Pour quelle équipe ? » seule.
      fixedClubId ? 'equipe' : 'club',
      // DATESDABORD — depuis une case du planning, l'étape se rouvre (« Changer l'heure », la
      // ligne « Quand » du récapitulatif) ; sinon elle suit « Pour qui ? ».
      ...(compact && !rouvertes ? [] : ['dateHoraire']),
      'recap',
    ]);
  const etapes = etapesDu(heuresRouvertes);
  const [etape, setEtape] = useState(0);
  const etapeCourante = etapes[etape];
  // 🗓️ DATESDABORD (23/10, point 9 d'Adel) — à la création, « Quel jour ? », « À quelle heure ? »
  // et « Quand ? » deviennent UNE étape « Date & horaire », le modèle de la création d'événement
  // (le bloc partagé `DateEtHoraire`) ; ce qui les entourait (heures libres, carte de place,
  // plateau, vacances, séances) y reste. « Modifier » et la répartition ne changent pas.
  const avecLeModele = !modification && !repartition;
  const visible = (/** @type {string} */ champ) => !parcoursGuide || etapeCourante === champ
    || (champ === 'equipe' && etapeCourante === 'club')
    || (etapeCourante === 'dateHoraire' && ['horaires', 'jour', 'quand'].includes(champ));
  const confirmationFinale = !parcoursGuide || etapeCourante === 'recap';
  const tunnelPleinEcran = pleinEcran && parcoursGuide;
  // Aller a une etape par son nom ; « Jour » et « Horaires » sautes (planning) se rouvrent.
  const allerA = (/** @type {string} */ demande) => {
    const nom = avecLeModele && ['horaires', 'jour', 'quand'].includes(demande)
      ? 'dateHoraire'
      : demande;
    if (etapes.includes(nom)) {
      setEtape(etapes.indexOf(nom));
      return;
    }
    setHeuresRouvertes(true);
    setEtape(etapesDu(true).indexOf(nom));
  };

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
  // SAIS (T20 lot 1) — « Attribuer » s'ouvre sur un jour, comme au site : aujourd'hui, sauf si
  // l'écran en apporte un (une case du planning) ; « Modifier » garde le sien.
  const [jour, setJour] = useState(
    Number(slot?.weekday || initial.weekday)
      || (modification || repartition ? null : isoWeekdayOf(new Date())),
  );
  const [debut, setDebut] = useState(
    String(slot?.startTime || initial.startTime || '').slice(0, 5),
  );
  const [fin, setFin] = useState(String(slot?.endTime || initial.endTime || '').slice(0, 5));
  // COLL-R-A6 (COL-018) : une case de la semaine type apporte le jour ET les heures.
  const depuisUneCase = !modification
    && Boolean(initial.weekday && initial.startTime && initial.endTime);
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
  // 🗓️ R17-QUAND-1, point 4 — LA FORME (« Quand ? ») : toute la saison par défaut (un appui
  // sur « Suivant » suffit) ; un créneau qu'on modifie rouvre la sienne. « Des jours
  // différents » (Q4 B) ouvre directement le calendrier libre.
  const saisonLue = meta.season || saisonDuJour(debutActuel || aujourdhui);
  const [quandDeDepart] = useState(() => (
    modification ? quandDuCreneau(slot, saisonDuJour(debutActuel)) : null
  ));
  const [forme, setForme] = useState(quandDeDepart?.forme || 'saison');
  const [joursDifferents, setJoursDifferents] = useState(quandDeDepart?.forme === 'dates');
  const [deuxDu, setDeuxDu] = useState(versSaisie(quandDeDepart?.deuxDu));
  const [deuxJusqua, setDeuxJusqua] = useState(
    quandDeDepart?.deuxAu && quandDeDepart.deuxAu !== saisonDuJour(debutActuel)?.validUntil
      ? 'date'
      : 'fin',
  );
  const [deuxAu, setDeuxAu] = useState(versSaisie(quandDeDepart?.deuxAu));
  const [datesChoisies, setDatesChoisies] = useState(
    /** @type {string[]} */ (quandDeDepart?.dates || []),
  );
  const formeChoisie = joursDifferents ? 'dates' : forme;
  // 🗓️ DATESDABORD — le modèle de l'événement : une date (le 1er jour, celui du jour retenu), et
  // « Répéter » ; par défaut, toutes les semaines jusqu'à la fin de saison (le « toute la saison »
  // d'avant, dit avec les mots de l'événement). Chaque geste réécrit la forme du « Quand ? »
  // (`quandDeLaRepetition`) : l'aperçu, les vacances, les fermetures et l'envoi la lisent.
  const [dateDuModele, setDateDuModele] = useState(() => prochainJour(jour || isoWeekdayOf(new Date())));
  const [repetitionDuModele, setRepetitionDuModele] = useState(() => ({
    actif: true,
    au: parseISO(saisonDuJour(format(new Date(), 'yyyy-MM-dd'))?.validUntil || ''),
    du: null,
    frequence: 'week',
    intervalleTexte: '1',
    jours: /** @type {any[]} */ ([]),
  }));
  // 🌴 R17-QUAND-2 (REC17-007 Q3, planches P11-quand-v2-tel / -ordi) — « Sauf vacances scolaires »
  // (zone et dates : le serveur, calendrier officiel) ; les périodes gardées malgré tout
  // (décochées : un stage pendant les vacances ; `null` = pas touchées) ; la liste des dates
  // retirées, dépliée.
  const [saufVacances, setSaufVacances] = useState(slot?.exceptHolidays === true);
  const [vacancesGardees, setVacancesGardees] = useState(/** @type {string[] | null} */ (null));
  const [vacancesDepliees, setVacancesDepliees] = useState(false);
  const quand = {
    dates: datesChoisies,
    deuxAu: deuxJusqua === 'date' ? versJourCivil(deuxAu) : null,
    deuxDu: versJourCivil(deuxDu),
    forme: formeChoisie,
    jour: joursDifferents ? null : jour,
    periodeAu: versJourCivil(periodeAu),
    periodeDu: dejaCommence ? debutActuel : versJourCivil(periodeDu),
    saison: saisonLue,
  };
  // « Modifier » : la période de la forme (COLL-C2B-BIS : un début neuf seulement avant que le
  // créneau commence, rien dans le passé). Des dates choisies donnent la leur (serveur).
  const bornesDeLaForme = (() => {
    const debutDeSaison = saisonLue && saisonLue.validFrom > aujourdhui
      ? saisonLue.validFrom
      : aujourdhui;
    if (formeChoisie === 'saison') {
      return {
        debut: dejaCommence ? debutActuel : debutDeSaison, fin: saisonLue?.validUntil || null,
      };
    }
    if (formeChoisie === 'deuxSemaines') {
      return {
        debut: dejaCommence ? debutActuel : quand.deuxDu,
        fin: quand.deuxAu || saisonLue?.validUntil || null,
      };
    }
    if (formeChoisie === 'dates') return { debut: null, fin: null };
    return { debut: quand.periodeDu, fin: quand.periodeAu };
  })();
  const nouveauDebut = bornesDeLaForme.debut;
  const nouvelleFin = bornesDeLaForme.fin;
  const periodeJuste = !avecPeriode || formeChoisie === 'dates'
    || Boolean(nouveauDebut && nouvelleFin && nouvelleFin >= nouveauDebut);

  // Ce que la forme donne : les séances à venir (celles qui tombent dans une fermeture de la
  // Ville se lisent dans l'aperçu, plus bas).
  const seances = jour || joursDifferents ? seancesDuQuand(creneauDuQuand(quand), aujourdhui) : [];
  const finDeSaison = saisonLue?.validUntil || null;
  const erreurDuQuand = (() => {
    /** @type {Array<string | null>} */
    let bornes = [null, null];
    if (formeChoisie === 'periode') bornes = [quand.periodeDu, quand.periodeAu];
    if (formeChoisie === 'deuxSemaines') bornes = [quand.deuxDu, quand.deuxAu];
    const [du, au] = bornes;
    if (du && au && au < du) {
      return t('collectiviteCreneaux.quand.ordre', '« Au » doit venir après « Du ».');
    }
    if (finDeSaison && au && au > finDeSaison) {
      return t(
        'collectiviteCreneaux.quand.apresSaison',
        'La saison finit le {{date}} : choisissez une date avant.',
        { date: formatDayMonth(finDeSaison), ...SANS_ECHAPPEMENT },
      );
    }
    if (formeChoisie === 'dates' && !datesChoisies.length) {
      return t('collectiviteCreneaux.quand.aucuneDate', 'Aucune date cochée.');
    }
    // « Toute la saison » : la saison du serveur fait foi (il la prend par défaut), rien à bloquer.
    const lisible = formeChoisie === 'dates'
      || (formeChoisie === 'periode' && Boolean(du && au))
      || (formeChoisie === 'deuxSemaines' && Boolean(du));
    if (lisible && (jour || joursDifferents) && !seances.length) {
      return t(
        'collectiviteCreneaux.quand.aucuneSeance',
        'Aucune séance à venir dans cette période.',
      );
    }
    return null;
  })();
  const quandJuste = repartition
    || (!erreurDuQuand && (formeChoisie === 'saison' || seances.length > 0));
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
  // R17-QUAND-1 — l'aperçu lit la forme : des dates choisies (« a,b »), « 1 sur 2 » et sa 1re date,
  // une période. Une forme encore fausse (erreur affichée) se juge sur la saison.
  const formeDeLApercu = (() => {
    if (formeChoisie === 'dates') {
      return datesChoisies.length
        ? { dates: [...datesChoisies].sort().join(','), recurrence: 'dates' }
        : null;
    }
    if (erreurDuQuand) return {};
    const corps = corpsDuQuand(quand);
    if (apercuDu) return { ...corps, validFrom: apercuDu, validUntil: apercuAu };
    return modification ? {} : corps;
  })();
  // La clé de lecture se calcule sur le contenu (react-query) : un objet neuf ne relit rien.
  const parametresApercu = facilityId && (jour || formeChoisie === 'dates') && ordreJuste
    && !repartition && formeDeLApercu ? {
      endTime: fin,
      excludeSlot: slot?.documentId || undefined,
      plateau: plateau || undefined,
      startTime: debut,
      ...(formeChoisie === 'dates' ? {} : { weekday: jour }),
      ...formeDeLApercu,
      ...(saufVacances ? { exceptHolidays: '1' } : {}),
      ...(saufVacances && vacancesGardees?.length
        ? { keepHolidays: vacancesGardees.join(',') }
        : {}),
    } : null;
  const apercu = useSeasonSlotPreview(facilityId, parametresApercu);
  // 🌴 R17-QUAND-2 — la zone et ses périodes (aperçu du serveur), gardées d'une lecture à l'autre :
  // la case ne disparaît pas pendant qu'un nouvel aperçu se lit. `null` : zone inconnue, pas de
  // case.
  const vacancesLues = /** @type {any} */ (apercu.data)?.data?.holidays;
  const vacancesConnues = useRef(/** @type {any} */ (null));
  if (vacancesLues !== undefined) vacancesConnues.current = vacancesLues;
  // Avant le 1er aperçu (calendrier libre sans date cochée) : la zone de la liste des créneaux.
  const vacances = vacancesConnues.current ?? meta.holidays ?? null;
  /** @type {import('@/domains/seasonSlot/seasonSlotHolidays').PeriodeDeVacances[]} */
  const periodesDeVacances = Array.isArray(vacances?.periods) ? vacances.periods : [];
  const gardees = vacancesGardees
    ?? (modification ? periodesGardeesDuCreneau(slot, periodesDeVacances) : []);
  const vacancesDeLaForme = vacancesDesSeances(seances, periodesDeVacances, gardees);
  const avecVacances = Boolean(saufVacances && vacances);
  // Les séances qui restent : sans celles des vacances quand la case est cochée.
  const seancesVues = avecVacances
    ? seances.filter((jourCivil) => !vacancesDeLaForme.retirees.includes(jourCivil))
    : seances;
  const basculerLaPeriode = (/** @type {string} */ cle) => {
    setVacancesGardees((avant) => {
      const base = avant ?? gardees;
      return base.includes(cle) ? base.filter((autre) => autre !== cle) : [...base, cle].sort();
    });
    toucherLaSaisie();
  };
  // R17-QUAND-1 — les fermetures de la saison, rendues par l'aperçu (serveur) : les séances
  // fermées.
  const fermeturesLues = /** @type {any} */ (apercu.data)?.data?.closures;
  const fermetures = Array.isArray(fermeturesLues) ? fermeturesLues : [];
  const seancesFermees = fermeturesTouchees(seancesVues, fermetures, debut, fin);
  const disponibilitesEnCours = !repartition && (lecture.isLoading
    || Boolean(parametresApercu && apercu.isFetching));
  const disponibilitesEnErreur = !repartition && (lecture.error
    || (parametresApercu ? apercu.error : null));
  const place = conflit || apercu.data?.data || null;
  // VILLE-T18A — planche 23, etat 3 : le « complet » se decide pendant la saisie, ou par le 409.
  const besoinDeConfirmer = Boolean(conflit)
    || Boolean(parametresApercu && apercu.data?.data?.needsConfirmation);

  // VILLE-T18A — les heures ou il reste une place ce jour-la : la semaine type de l installation
  // (deja lue), moins les moments complets ; le creneau qu on modifie ne compte pas.
  // ponytail: ouverture 08:00 – 22:00 (defaut de `freeRanges`) : la liste des creneaux ne dit pas
  // les horaires de l installation, et leur retrait est decide (VILLE-INSTALLATION). Le serveur
  // refuse toujours une heure hors horaires (`seasonSlotErrorMessage`).
  // A7-UX-2 (22/10, Adel « P4 oui ») : les moments complets, aussi passés à la grille du Début.
  const heuresPleines = useMemo(() => (jour && !joursDifferents
    ? fullRangesOfSlots(creneauxDuJour(lecture.data?.data, jour, slot?.documentId), capacite)
    : []), [capacite, jour, joursDifferents, lecture.data, slot?.documentId]);
  const heuresLibres = useMemo(
    () => (jour ? freeRanges(heuresPleines) : []),
    [heuresPleines, jour],
  );

  const nomDuClub = slot?.club?.name
    || clubs.find((ligne) => ligne.documentId === club)?.name
    || '';
  const pret = Boolean(facilityId && club && (jour || joursDifferents) && ordreJuste)
    && !disponibilitesEnCours
    && !disponibilitesEnErreur
    && (!modification || Boolean(aPartirDu))
    && periodeJuste
    && quandJuste;

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

  // 🗓️ DATESDABORD — la date et « Répéter » du modèle deviennent le jour et la forme du créneau.
  const appliquerLeModele = (/** @type {Date} */ date, /** @type {any} */ repetition) => {
    const jourCivil = (/** @type {any} */ valeur) => (
      valeur && isValid(valeur) ? format(valeur, 'yyyy-MM-dd') : null
    );
    const lue = quandDeLaRepetition({
      aujourdhui,
      date: format(date, 'yyyy-MM-dd'),
      finDeSaison: finDeSaison || saisonDuJour(aujourdhui)?.validUntil || '',
      repetition: { ...repetition, au: jourCivil(repetition.au), du: jourCivil(repetition.du) },
    });
    setJour(lue.jour);
    setJoursDifferents(lue.joursDifferents);
    if (lue.forme === 'dates') setDatesChoisies(lue.dates || []);
    if (lue.forme === 'periode') {
      setForme('periode');
      setPeriodeDu(versSaisie(lue.periodeDu));
      setPeriodeAu(versSaisie(lue.periodeAu));
    }
    if (lue.forme === 'deuxSemaines') {
      setForme('deuxSemaines');
      setDeuxDu(versSaisie(lue.deuxDu));
      setDeuxJusqua(lue.deuxAu ? 'date' : 'fin');
      setDeuxAu(versSaisie(lue.deuxAu));
    }
    toucherLaSaisie();
  };
  const changerLaDateDuModele = (/** @type {Date} */ nouvelle) => {
    const suite = {
      ...repetitionDuModele,
      du: repetitionDuModele.du
        ? debutDeRepetitionSuivant(repetitionDuModele.du, dateDuModele, nouvelle)
        : null,
      jours: joursDeRepetitionSuivants(repetitionDuModele.jours, dateDuModele, nouvelle),
    };
    setDateDuModele(nouvelle);
    setRepetitionDuModele(suite);
    appliquerLeModele(nouvelle, suite);
  };
  const changerLaRepetition = (/** @type {any} */ suite) => {
    const repetition = suite ? { ...suite, actif: true } : { ...repetitionDuModele, actif: false };
    setRepetitionDuModele(repetition);
    appliquerLeModele(dateDuModele, repetition);
  };
  // Une heure « HH:MM » posée sur la date du modèle (null tant qu'elle n'est pas choisie).
  const heureDuModele = (/** @type {string} */ heure) => {
    if (!isTime(heure)) return null;
    const [heures, minutes] = heure.split(':').map(Number);
    const date = new Date(dateDuModele);
    date.setHours(heures, minutes, 0, 0);
    return date;
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
  // ⏰ A7-UX (20/10) — LA FIN SE PROPOSE TOUTE SEULE : le Début choisi pose la Fin à + 1 h 30 (la
  // durée de « Voir les heures libres ») ; un créneau déjà lisible garde sa durée (la Fin suit) ;
  // une Fin déjà après le Début, sans durée connue, reste. Rien au-delà de 23:55 (elle se choisit).
  const changerLeDebut = (/** @type {string} */ valeur) => {
    const nouveau = String(valeur || '').trim();
    setDebut(nouveau);
    toucherLaSaisie();
    const depart = isTime(nouveau) ? Number(toMinutes(nouveau)) : null;
    if (depart === null) return;
    if (!ordreJuste && finLisible && Number(toMinutes(fin)) > depart) return;
    const proposee = depart + (ordreJuste ? Number(toMinutes(fin)) - Number(toMinutes(debut)) : 90);
    if (proposee <= (23 * 60) + 55) setFin(fromMinutes(proposee));
  };
  // « Changer l heure » : les heures sont a choisir de nouveau, les heures libres sous les yeux.
  // En mode compact (planning), les heures viennent de la case : rien a vider.
  // COLL-R-A7 : depuis le planning, l etape « Horaires » etait sautee ; elle se rouvre ici.
  const changerLHeure = () => {
    if (parcoursGuide) allerA('horaires');
    if (!compact) {
      setDebut('');
      setFin('');
    }
    setVoirLibres(true);
    toucherLaSaisie();
  };

  // R17-QUAND-1 — « Modifier » : la forme choisie (ses bornes partent à côté, seulement si elles
  // changent). Des dates choisies : la liste ; le serveur en tire la fin.
  const formeAEnvoyer = () => {
    // Forme inchangée : rien ne part (le corps d'une modification reste celui d'avant le lot).
    const avant = quandDeDepart?.forme || 'saison';
    const memeRythme = (avant === formeChoisie)
      || (['periode', 'saison'].includes(avant) && ['periode', 'saison'].includes(formeChoisie));
    const memesDates = formeChoisie !== 'dates'
      || JSON.stringify([...datesChoisies].sort()) === JSON.stringify(quandDeDepart?.dates || []);
    const memePremiere = formeChoisie !== 'deuxSemaines' || quand.deuxDu === quandDeDepart?.deuxDu;
    if (memeRythme && memesDates && memePremiere) return {};
    if (formeChoisie === 'dates') return { dates: [...datesChoisies].sort(), recurrence: 'dates' };
    if (formeChoisie === 'deuxSemaines') {
      // Déjà « 1 sur 2 », 1re date inchangée : aucun ancrage ne part, le serveur garde la parité.
      const inchange = quandDeDepart?.forme === 'deuxSemaines'
        && quand.deuxDu === quandDeDepart.deuxDu;
      const { anchorDate } = corpsDuQuand({ ...quand, deuxDu: quand.deuxDu || nouveauDebut });
      return {
        ...(anchorDate && !inchange ? { anchorDate } : {}), everyWeeks: 2, recurrence: 'weekly',
      };
    }
    return { everyWeeks: 1, recurrence: 'weekly' };
  };
  // 🌴 R17-QUAND-2 — « Modifier » : la case, si elle change ; les périodes gardées, si la Ville
  // les a touchées (sinon le serveur garde celles du créneau).
  const vacancesAEnvoyer = () => {
    const avant = slot?.exceptHolidays === true;
    /** @type {Record<string, unknown>} */
    const champs = {};
    if (saufVacances !== avant) champs.exceptHolidays = saufVacances;
    if (saufVacances && vacancesGardees !== null) champs.keepHolidays = vacancesGardees;
    return champs;
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
              ...(formeChoisie === 'dates' ? {} : { weekday: jour }),
              ...champPlateau,
              // R17-QUAND-1 — la forme part toujours (le serveur ne coupe que si elle change).
              ...formeAEnvoyer(),
              ...vacancesAEnvoyer(),
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
            ...(formeChoisie === 'dates' ? {} : { weekday: jour }),
            // R17-QUAND-1 — la création envoie enfin la forme et sa période (« Quand ? »).
            ...corpsDuQuand(quand),
            // R17-QUAND-2 — « Sauf vacances scolaires », et les périodes gardées.
            ...(avecVacances ? { exceptHolidays: true } : {}),
            ...(avecVacances && gardees.length ? { keepHolidays: gardees } : {}),
            ...(equipe ? { team: equipe } : {}),
            ...(plateau ? { plateau } : {}),
            ...confirmation,
          },
          facilityId,
        });
      }
      setConflit(null);
      // 📐 COLL-R-A7-FINITIONS (planche P4v4-attribuer-entrees-tel, « Attribué ») : le tunnel se
      // ferme, la bannière de l'app confirme sur l'écran d'origine. Même retour après la
      // fermeture du panneau large ; la répartition du dirigeant garde son propre parcours.
      if (parcoursGuide) {
        showBanner({
          body: nomDuClub
            ? t('collectiviteCreneaux.tunnel.estPrevenu', '{{club}} est prévenu.', {
              club: nomDuClub, ...SANS_ECHAPPEMENT,
            })
            : undefined,
          title: modification
            ? t('collectiviteCreneaux.tunnel.modifie', 'Créneau modifié')
            : t('collectiviteCreneaux.tunnel.attribue', 'Créneau attribué'),
          tone: 'success',
        });
      }
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

  // ─── R17-QUAND-1 : ce que la forme dit, en mots (planches P10-quand-tel, P11-quand-v2-tel) ───
  const nomDuJour = jour && !joursDifferents
    ? weekdayName(Number(jour), { inSentence: true })
    : '';
  const quandDuDepassement = (() => {
    if (formeChoisie === 'dates') {
      return t('collectiviteCreneaux.quand.aLeursDates', 'aux dates choisies');
    }
    if (formeChoisie === 'deuxSemaines') {
      return t('collectiviteCreneaux.quand.unSurDeuxCourt', 'un {{jour}} sur deux', {
        jour: nomDuJour, ...SANS_ECHAPPEMENT,
      });
    }
    if (formeChoisie === 'periode') {
      return t('collectiviteCreneaux.quand.chaqueDeLaPeriode', 'chaque {{jour}} de la période', {
        jour: nomDuJour, ...SANS_ECHAPPEMENT,
      });
    }
    return t('collectiviteCreneaux.quand.chaqueDeLaSaison', 'chaque {{jour}} de la saison', {
      jour: nomDuJour, ...SANS_ECHAPPEMENT,
    });
  })();
  const listeDeDates = (/** @type {string[]} */ jours, /** @type {number} */ max = 4) => {
    const lus = jours.slice(0, max).map((jourCivil) => formatDay(jourCivil, { withYear: false }));
    return jours.length > max
      ? t('collectiviteCreneaux.quand.etAutres', '{{dates}} et {{count}} autres', {
        count: jours.length - max, dates: lus.join(' · '), ...SANS_ECHAPPEMENT,
      })
      : lus.join(' · ');
  };
  // « 37 mercredis » / « 3 dates choisies ».
  const titreDesSeances = formeChoisie === 'dates'
    ? t('collectiviteCreneaux.quand.datesChoisies', {
      count: seancesVues.length,
      defaultValue_one: '{{count}} date choisie',
      defaultValue_other: '{{count}} dates choisies',
    })
    : t('collectiviteCreneaux.quand.seances', {
      count: seancesVues.length,
      defaultValue_one: '{{count}} {{jour}}',
      defaultValue_other: '{{count}} {{jour}}s',
      jour: nomDuJour,
      ...SANS_ECHAPPEMENT,
    });
  // Les séances qui tombent dans une fermeture : « 2 tombent dans « Vacances de Noël » (23 et
  // 30 déc.) ».
  const texteDesFermetures = (() => {
    if (!seancesVues.length) return null;
    if (!seancesFermees.length) {
      return t('collectiviteCreneaux.quand.aucuneFermee', 'Aucune ne tombe dans une fermeture.');
    }
    const noms = [...new Set(seancesFermees.map((ligne) => ligne.label).filter(Boolean))];
    const dates = seancesFermees.slice(0, 4).map((ligne) => formatDayMonth(ligne.date)).join(', ');
    if (seancesFermees.length === seancesVues.length) {
      return t(
        'collectiviteCreneaux.quand.toutesFermees',
        'Toutes tombent dans une fermeture ({{fermeture}}). Vous pouvez attribuer quand même : '
          + 'le club verra ses séances « fermé ».',
        { fermeture: noms.join(', '), ...SANS_ECHAPPEMENT },
      );
    }
    return t('collectiviteCreneaux.quand.fermees', {
      count: seancesFermees.length,
      dates,
      defaultValue_one: 'Le {{dates}} tombe dans « {{fermeture}} » : le club y verra « fermé », '
        + 'comme aujourd’hui.',
      defaultValue_other: '{{count}} tombent dans « {{fermeture}} » ({{dates}}) : le club y verra '
        + '« fermé », comme aujourd’hui.',
      fermeture: noms.join(', '),
      ...SANS_ECHAPPEMENT,
    });
  })();
  // La ligne « Quand » du récapitulatif : la forme et ses bornes, puis le compte.
  const libelleDuQuand = (() => {
    const premiere = seances[0] || null;
    const derniere = seances[seances.length - 1] || null;
    const bornes = {
      au: formatDayMonth(derniere), du: formatDayMonth(premiere), ...SANS_ECHAPPEMENT,
    };
    if (formeChoisie === 'dates') return titreDesSeances;
    if (formeChoisie === 'deuxSemaines') {
      return t(
        'collectiviteCreneaux.quand.recapDeux',
        'Toutes les 2 semaines · {{du}} – {{au}}',
        bornes,
      );
    }
    if (formeChoisie === 'periode') {
      return t('collectiviteCreneaux.quand.recapPeriode', 'Une période · {{du}} – {{au}}', bornes);
    }
    return t('collectiviteCreneaux.quand.recapSaison', 'Toute la saison · {{du}} – {{au}}', bornes);
  })();
  // 🌴 R17-QUAND-2 — « 8 retirés pendant les vacances : Toussaint, Noël, hiver, printemps. »
  const texteDesVacances = (() => {
    if (!avecVacances) return null;
    const { retirees } = vacancesDeLaForme;
    if (!retirees.length) {
      return t(
        'collectiviteCreneaux.quand.vacances.aucune',
        'Aucune séance ne tombe pendant les vacances.',
      );
    }
    const noms = vacancesDeLaForme.parPeriode
      .filter((ligne) => !ligne.gardee)
      .map((ligne) => nomDeVacances(ligne.periode.name))
      .join(', ');
    return formeChoisie === 'dates'
      ? t('collectiviteCreneaux.quand.vacances.retireesDates', {
        count: retirees.length,
        defaultValue_one: '{{count}} date retirée pendant les vacances : {{noms}}.',
        defaultValue_other: '{{count}} dates retirées pendant les vacances : {{noms}}.',
        noms,
        ...SANS_ECHAPPEMENT,
      })
      : t('collectiviteCreneaux.quand.vacances.retirees', {
        count: retirees.length,
        defaultValue_one: '{{count}} retiré pendant les vacances : {{noms}}.',
        defaultValue_other: '{{count}} retirés pendant les vacances : {{noms}}.',
        noms,
        ...SANS_ECHAPPEMENT,
      });
  })();
  // « Calendrier officiel 2026-2027 » : les années des périodes lues.
  const anneesScolaires = [...new Set(periodesDeVacances.map((periode) => (
    String(periode.key).split(':')[0]
  )))].join(', ');
  const zoneDesVacances = vacances?.academie
    ? t('collectiviteCreneaux.quand.vacances.zone', '{{zone}} · académie de {{academie}}', {
      academie: vacances.academie, zone: vacances.label, ...SANS_ECHAPPEMENT,
    })
    : (vacances?.label || '');
  const origineDesVacances = vacances?.origin === 'console'
    ? t(
      'collectiviteCreneaux.quand.vacances.origineConsole',
      'Zone choisie par FoundClub. Une erreur ? Écrivez à FoundClub : nous la corrigeons.',
    )
    : t(
      'collectiviteCreneaux.quand.vacances.origineDeduite',
      'Zone déduite de votre commune ({{departement}}). Une erreur ? Écrivez à FoundClub : nous la '
        + 'corrigeons.',
      { departement: vacances?.departementName || '', ...SANS_ECHAPPEMENT },
    );
  const detailSansVacances = (() => {
    if (formeChoisie === 'dates') return listeDeDates(seancesVues);
    if (!seancesFermees.length) return titreDesSeances;
    return t('collectiviteCreneaux.quand.recapDontFermees', {
      count: seancesFermees.length,
      dates: seancesFermees.slice(0, 4).map((ligne) => formatDayMonth(ligne.date)).join(', '),
      defaultValue_one: '{{seances}}, dont 1 fermé ({{dates}})',
      defaultValue_other: '{{seances}}, dont {{count}} fermés ({{dates}})',
      seances: titreDesSeances,
      ...SANS_ECHAPPEMENT,
    });
  })();
  const detailDuQuand = avecVacances
    ? t(
      'collectiviteCreneaux.quand.vacances.recap',
      '{{detail}}, sauf vacances scolaires ({{zone}})',
      { detail: detailSansVacances, zone: vacances.label, ...SANS_ECHAPPEMENT },
    )
    : detailSansVacances;

  // ─── La carte « Place libre » (§4.2) ────────────────────────────────────────────────
  const carteDeLaPlace = (() => {
    if (!parametresApercu || !place) return null;
    const moment = formeChoisie === 'dates'
      ? timeRange(debut, fin)
      : `${weekdayName(Number(jour))} ${timeRange(debut, fin)}`;
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
        defaultValue_one: 'Attribuer met {{count}} équipe pour {{capacite}} places, {{quand}}.',
        defaultValue_other: 'Attribuer met {{count}} équipes pour {{capacite}} places, {{quand}}.',
        // R17-QUAND-1 — « chaque mercredi de la saison » n'est vrai que pour toute la saison.
        quand: quandDuDepassement,
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
            style={[Alignments.row, Alignments.alignCenter, { minHeight: 44 }]}
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
  const lesHeuresLibres = voirLibres && jour && !repartition
    && !lecture.isLoading && !lecture.error ? (
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
  // COLL-R-A7 — en plein ecran, le titre de l etape pose deja la question : pas de libelle.
  // A7-UX-2 (22/10, Adel « P6 oui ») — le panneau du site pose aussi la question : pareil.
  const libelleDuChamp = (/** @type {string} */ texte) => (
    parcoursGuide ? null : titreDuChamp(texte)
  );
  // A7-UX (20/10) — `flex-start` : une puce suivie de « complet … » étirait toutes ses voisines
  // en ovales (capture du banc, « Quel jour ? », panneau du site).
  const rangee = (/** @type {import('react').ReactNode} */ enfants) => (
    <View style={[Alignments.row, Alignments.wrap, { alignItems: 'flex-start', gap: 8 }]}>
      {enfants}
    </View>
  );
  // 🌴 R17-QUAND-2 — le carré d'une case à cocher (« Sauf vacances scolaires », une période).
  const coche = (/** @type {boolean} */ actif) => (
    <View
      style={[Alignments.center, {
        backgroundColor: actif ? Colors.primary500 : 'transparent',
        borderColor: actif ? Colors.primary500 : Colors.primary200,
        borderRadius: 6,
        borderWidth: 2,
        height: 24,
        width: 24,
      }]}
    >
      {actif ? <SvgIcon color={Colors.primary900} height={14} name="check" width={14} /> : null}
    </View>
  );
  /**
   * COLL-R-A7 — une liste de choix : des puces dans le panneau du site, des lignes a cocher en
   * plein ecran (planche P4v4-attribuer).
   * @param {Array<{
   *   actif: boolean, avertissement?: boolean, club?: any, couleur?: string | null,
   *   detail?: string | null, key: string, libelle: string, libelleCourt?: string,
   *   onPress: () => void, testID?: string,
   * }>} options
   * @returns {import('react').ReactElement} La liste.
   */
  const listeDeChoix = (options) => (tunnelPleinEcran ? (
    <View style={{ gap: 8 }}>
      {options.map((option) => (
        <LigneDeChoix
          actif={option.actif}
          avertissement={option.avertissement}
          club={option.club}
          couleur={option.couleur}
          detail={option.detail}
          key={option.key}
          libelle={option.libelle}
          onPress={option.onPress}
          testID={option.testID}
        />
      ))}
    </View>
  ) : rangee(options.map((option) => {
    const puce = (
      <PuceDeChoix
        actif={option.actif}
        key={option.key}
        libelle={option.libelleCourt || option.libelle}
        onPress={option.onPress}
        testID={option.testID}
      />
    );
    if (!option.key.startsWith('jour-') || !option.detail) return puce;
    return (
      <View key={option.key} style={{ gap: 4, maxWidth: 160 }}>
        {puce}
        <Text style={[Fonts.p3, Fonts.warning500]}>{option.detail}</Text>
      </View>
    );
  })));

  const nomEquipe = equipe
    ? equipes.data?.find((/** @type {any} */ ligne) => ligne.documentId === equipe)?.name
    : t('collectiviteCreneaux.attribuer.toutLeClub', 'Tout le club');

  const capaciteLue = t('collectiviteCreneaux.liste.capacite', {
    count: capacite,
    defaultValue_one: '{{count}} équipe à la fois',
    defaultValue_other: '{{count}} équipes à la fois',
  });
  const reculer = () => {
    if (envoiEnCours) return;
    if (etape > 0) setEtape(etape - 1);
    else onCancel?.();
  };
  const suivantBloque = envoiEnCours || (() => {
    if (etapeCourante === 'installation') return !facilityId;
    if (etapeCourante === 'club') {
      return !club || Boolean(lectureDesClubs?.isLoading || lectureDesClubs?.error)
        || equipes.isLoading || Boolean(equipes.error);
    }
    if (etapeCourante === 'equipe') return !club || equipes.isLoading || Boolean(equipes.error);
    if (etapeCourante === 'jour') {
      return (!jour && !joursDifferents) || lecture.isLoading || Boolean(lecture.error);
    }
    if (etapeCourante === 'horaires') {
      return !ordreJuste || disponibilitesEnCours || Boolean(disponibilitesEnErreur);
    }
    // DATESDABORD — l'étape réunit les trois : un jour, des heures dans l'ordre, une séance.
    if (etapeCourante === 'dateHoraire') {
      return (!jour && !joursDifferents) || lecture.isLoading || Boolean(lecture.error)
        || !ordreJuste || disponibilitesEnCours || Boolean(disponibilitesEnErreur) || !quandJuste;
    }
    const dateEffetValide = isValid(parse(aPartirDu, 'dd/MM/yyyy', new Date()));
    // R17-QUAND-1 — « Suivant » reste grisé tant que la forme n'a pas au moins une date.
    if (etapeCourante === 'quand' && !quandJuste) return true;
    return !periodeJuste || (modification && !dateEffetValide);
  })();
  const avancer = () => setEtape(Math.min(etape + 1, etapes.length - 1));
  const libelleDeConfirmation = (() => {
    if (modification) {
      return besoinDeConfirmer
        ? t('collectiviteCreneaux.attribuer.enregistrerQuandMeme', 'Enregistrer quand même')
        : t('collectiviteCreneaux.attribuer.enregistrer', 'Enregistrer');
    }
    if (besoinDeConfirmer) {
      return t('collectiviteCreneaux.attribuer.quandMeme', 'Attribuer quand même');
    }
    // R17-QUAND-1 — « pour la saison » seulement quand c'est vrai.
    if (compact && !tunnelPleinEcran && formeChoisie === 'saison') {
      return t('collectiviteCreneaux.attribuer.pourLaSaison', 'Attribuer pour la saison');
    }
    return t('collectiviteCreneaux.attribuer.valider', 'Attribuer le créneau');
  })();

  // ─── COLL-R-A7 : la question de chaque etape, et ce que son sous-titre relit ───────────────
  const leJour = jour ? weekdayName(Number(jour)).toLocaleLowerCase() : '';
  const lesHeures = timeRange(debut, fin);
  const chaqueJour = (/** @type {string} */ suite) => t(
    'collectiviteCreneaux.tunnel.chaqueJour',
    'Chaque {{jour}} · {{suite}}',
    { jour: leJour, suite, ...SANS_ECHAPPEMENT },
  );
  // R17-QUAND-1 — le rythme dit la forme choisie : « chaque mercredi » n'est plus toujours vrai.
  const rythme = (/** @type {string} */ suite) => {
    if (formeChoisie === 'dates') {
      return t('collectiviteCreneaux.quand.rythmeDates', 'Dates choisies · {{suite}}', {
        suite, ...SANS_ECHAPPEMENT,
      });
    }
    if (formeChoisie === 'deuxSemaines') {
      return t('collectiviteCreneaux.quand.rythmeDeux', 'Un {{jour}} sur deux · {{suite}}', {
        jour: leJour, suite, ...SANS_ECHAPPEMENT,
      });
    }
    return chaqueJour(suite);
  };
  // « Mercredi 17:30 – 19:00 » ; des jours différents : les heures seules.
  const momentDuCreneau = joursDifferents
    ? lesHeures
    : `${weekdayName(Number(jour))} ${lesHeures}`;
  const quiEtEquipe = modification
    ? slotWho(slot)
    : [nomDuClub, nomEquipe].filter(Boolean).join(' · ');
  /** @type {Record<string, string>} */
  const titres = {
    club: t('collectiviteCreneaux.tunnel.pourQui', 'Pour qui ?'),
    dateHoraire: t('eventWizard.steps.logistics.focusTitle', 'Date & horaire'),
    equipe: t('collectiviteCreneaux.tunnel.equipe', 'Pour quelle équipe ?'),
    horaires: t('collectiviteCreneaux.tunnel.horaires', 'À quelle heure ?'),
    installation: t('collectiviteCreneaux.tunnel.installation', 'Dans quelle installation ?'),
    jour: t('collectiviteCreneaux.tunnel.jour', 'Quel jour ?'),
    quand: joursDifferents
      ? t('collectiviteCreneaux.quand.titreDates', 'Quelles dates ?')
      : t('collectiviteCreneaux.quand.titre', 'Quand ?'),
    recap: t('eventWizard.steps.recap.title', 'Récapitulatif'),
  };
  /** @type {Record<string, string>} */
  const sousTitres = {
    club: (heuresFigees
      ? [`${weekdayName(Number(jour))} ${lesHeures}`, installation?.name]
      : [installation?.name, installation ? capaciteLue : null]
    ).filter(Boolean).join(' · '),
    dateHoraire: [quiEtEquipe, installation?.name].filter(Boolean).join(' · '),
    equipe: t('collectiviteCreneaux.tunnel.equipeFacultative', '{{club}} · facultatif', {
      club: nomDuClub, ...SANS_ECHAPPEMENT,
    }),
    horaires: rythme(installation?.name || ''),
    installation: t('collectiviteCreneaux.tunnel.pourLeClub', 'Pour {{club}}', {
      club: nomDuClub, ...SANS_ECHAPPEMENT,
    }),
    // R17-QUAND-1 — « chaque semaine de la saison » mentait : la forme se choisit plus loin.
    jour: modification
      ? [slotWho(slot), installation?.name].filter(Boolean).join(' · ')
      : quiEtEquipe,
    quand: [momentDuCreneau, installation?.name].filter(Boolean).join(' · '),
    recap: modification
      ? t(
        'collectiviteCreneaux.tunnel.relisezEnregistrez',
        'Relisez, puis enregistrez. Le club est prévenu.',
      )
      : t(
        'collectiviteCreneaux.tunnel.relisezAttribuez',
        'Relisez, puis attribuez. Le club est prévenu.',
      ),
  };

  // COLL-R-A7 — le recapitulatif se touche ligne par ligne (« Creer un evenement ») : chaque
  // ligne ramene a son etape, celles qui ne se choisissent pas ne se touchent pas.
  const lignesDuRecap = [
    {
      cle: t('collectiviteCreneaux.tunnel.recapClub', 'Club · équipe'),
      id: 'club',
      onPress: modification ? undefined : () => allerA(etapes.includes('club') ? 'club' : 'equipe'),
      valeur: quiEtEquipe,
    },
    {
      cle: t('collectiviteCreneaux.attribuer.installation', 'Installation'),
      id: 'installation',
      onPress: etapes.includes('installation') ? () => allerA('installation') : undefined,
      valeur: installation?.name || '',
    },
    {
      cle: joursDifferents
        ? t('collectiviteCreneaux.quand.recapHeures', 'Heures')
        : t('collectiviteCreneaux.tunnel.recapHeures', 'Jour et heures'),
      id: 'heures',
      onPress: () => allerA('jour'),
      valeur: joursDifferents ? lesHeures : `${weekdayName(Number(jour))} · ${lesHeures}`,
    },
    // R17-QUAND-1 — la ligne « Quand » dit la forme, ses bornes et ses séances ; elle se touche,
    // même depuis une case du planning (elle était figée : « Toute la saison »).
    {
      cle: t('collectiviteCreneaux.quand.recap', 'Quand'),
      detail: detailDuQuand,
      id: 'quand',
      onPress: () => allerA('quand'),
      valeur: libelleDuQuand,
    },
    ...(modification ? [{
      cle: t('collectiviteCreneaux.attribuer.aPartirDu', 'À partir du'),
      id: 'effet',
      onPress: () => allerA('quand'),
      valeur: aPartirDu,
    }] : []),
    ...(plateau && plateaux.length ? [{
      cle: t('collectiviteCreneaux.attribuer.plateau', 'Plateau'),
      id: 'plateau',
      onPress: () => allerA('horaires'),
      valeur: String(plateaux[plateau - 1]),
    }] : []),
  ];
  const recapEnLignes = (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.06),
        borderColor: withAlpha(Colors.primary500, 0.22),
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 14,
      }}
      testID="season-slot-recap"
    >
      {lignesDuRecap.map((ligne, rang) => (
        <LigneDuRecap
          cle={ligne.cle}
          derniere={rang === lignesDuRecap.length - 1}
          detail={/** @type {any} */ (ligne).detail}
          key={ligne.id}
          libelleModifier={t(
            'collectiviteCreneaux.tunnel.modifierLaLigne',
            '{{cle}} : {{valeur}}. Modifier',
            { cle: ligne.cle, valeur: ligne.valeur, ...SANS_ECHAPPEMENT },
          )}
          onPress={ligne.onPress}
          testID={`recap-${ligne.id}`}
          valeur={ligne.valeur}
        />
      ))}
    </View>
  );

  // Planche P4v4-attribuer, 4/5 : les heures libres du jour se lisent sous les selecteurs.
  // A7-UX-2 (22/10, Adel « P4 oui ») : aussi au panneau du site (avant : plein écran seulement).
  const libresDuJour = parcoursGuide && visible('horaires') && !voirLibres && jour
    && !joursDifferents
    && !lecture.isLoading && !lecture.error
    && !heuresFigees && !repartition ? (
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {heuresLibres.length
          ? t('collectiviteCreneaux.tunnel.libresDuJour', 'Libre ce {{jour}} : {{heures}}.', {
            heures: heuresLibres
              .map((plage) => timeRange(fromMinutes(plage.start), fromMinutes(plage.end)))
              .join(', '),
            jour: leJour,
            ...SANS_ECHAPPEMENT,
          })
          : t('collectiviteCreneaux.attribuer.aucuneLibre', 'Aucune heure libre ce {{jour}}.', {
            jour: leJour,
            ...SANS_ECHAPPEMENT,
          })}
      </Text>
    ) : null;

  // R17-QUAND-1 — les quatre formes de « Quand ? », avec ce que chacune donne.
  const seancesDeLaSaison = jour && !joursDifferents
    ? seancesDuQuand(creneauDuQuand({ ...quand, forme: 'saison' }), aujourdhui)
    : [];
  const toutFerme = seancesVues.length > 0 && seancesFermees.length === seancesVues.length;
  const choisirForme = (/** @type {string} */ nouvelle) => {
    setForme(nouvelle);
    // « Toutes les 2 semaines » s'ouvre sur le prochain jour choisi (il fixe la semaine « paire »).
    if (nouvelle === 'deuxSemaines' && !deuxDu && seancesDeLaSaison[0]) {
      setDeuxDu(versSaisie(seancesDeLaSaison[0]));
    }
    toucherLaSaisie();
  };
  const formesProposees = [
    {
      actif: formeChoisie === 'saison',
      detail: t('collectiviteCreneaux.quand.saisonDetail', 'Chaque {{jour}}, du {{du}} au {{au}}', {
        au: formatDayMonth(finDeSaison),
        du: formatDayMonth(seancesDeLaSaison[0]),
        jour: nomDuJour,
        ...SANS_ECHAPPEMENT,
      }),
      key: 'quand-saison',
      libelle: t('collectiviteCreneaux.quand.saison', 'Toute la saison'),
      onPress: () => choisirForme('saison'),
      testID: 'quand-saison',
    },
    {
      actif: formeChoisie === 'periode',
      detail: t('collectiviteCreneaux.quand.periodeDetail', 'Chaque {{jour}}, du … au …', {
        jour: nomDuJour, ...SANS_ECHAPPEMENT,
      }),
      key: 'quand-periode',
      libelle: t('collectiviteCreneaux.quand.periode', 'Une période'),
      onPress: () => choisirForme('periode'),
      testID: 'quand-periode',
    },
    {
      actif: formeChoisie === 'deuxSemaines',
      detail: t('collectiviteCreneaux.quand.deuxSemainesDetail', 'Un {{jour}} sur deux', {
        jour: nomDuJour, ...SANS_ECHAPPEMENT,
      }),
      key: 'quand-deux',
      libelle: t('collectiviteCreneaux.quand.deuxSemaines', 'Toutes les 2 semaines'),
      onPress: () => choisirForme('deuxSemaines'),
      testID: 'quand-deux',
    },
    {
      actif: formeChoisie === 'dates',
      detail: t('collectiviteCreneaux.quand.datesDetail', 'Les jours que vous cochez'),
      key: 'quand-dates',
      libelle: t('collectiviteCreneaux.quand.dates', 'Des dates choisies'),
      onPress: () => choisirForme('dates'),
      testID: 'quand-dates',
    },
  ];
  // Un jour du calendrier où l'installation est déjà pleine aux heures choisies :
  // « 18:00 – 19:30 ».
  const completLe = (/** @type {string} */ jourCivil) => {
    const de = toMinutes(debut);
    const a = toMinutes(fin);
    if (de === null || a === null) return null;
    const presents = (Array.isArray(lecture.data?.data) ? lecture.data.data : [])
      .filter((/** @type {any} */ creneau) => creneau?.documentId !== slot?.documentId
        && slotOccursOn(creneau, jourCivil))
      .map((/** @type {any} */ creneau) => ({
        end: toMinutes(creneau?.endTime) ?? 0,
        start: toMinutes(creneau?.startTime) ?? 0,
      }));
    const plage = fullRanges(presents, capacite).find((ligne) => ligne.start < a && de < ligne.end);
    return plage ? timeRange(fromMinutes(plage.start), fromMinutes(plage.end)) : null;
  };

  const corps = (
    <View style={{ gap: 16 }}>
      {parcoursGuide && !tunnelPleinEcran ? (
        <View
          accessibilityLabel={t('eventWizard.common.stepCounter', {
            current: etape + 1, total: etapes.length,
          })}
          style={{ gap: 12 }}
          testID="season-slot-step"
        >
          <Button
            disabled={envoiEnCours}
            icon="arrowLeft"
            // A7-UX (20/10) — les boutons discrets du tunnel en cyan pâle, comme la planche P4v4
            // (`btn-g` = primary200, « moins de gris ») : « Retour » mesuré à 4,35:1 en gris sur le
            // fond du site, 6,5:1 ainsi.
            iconColor={Colors.primary200}
            // COL-005 : la fleche avant le mot (elle etait apres, capture S04).
            iconPosition="before"
            onPress={reculer}
            style={{ alignSelf: 'flex-start', minHeight: 44 }}
            textStyle={{ color: Colors.primary200 }}
            title={t('common.back', 'Retour')}
            variant="Ghost"
          />
          <Text accessibilityLiveRegion="polite" style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t('eventWizard.common.stepCounter', { current: etape + 1, total: etapes.length })}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{
              max: etapes.length, min: 1, now: etape + 1,
            }}
            style={{ backgroundColor: Colors.neutral700, borderRadius: 2, height: 4 }}
          >
            <View style={{
              backgroundColor: Colors.primary500,
              borderRadius: 2,
              height: 4,
              width: `${((etape + 1) / etapes.length) * 100}%`,
            }}
            />
          </View>
          {/* A7-UX-2 (22/10, Adel « P6 oui ») — le panneau du site pose la question de l'étape en
              titre, comme le téléphone (le récapitulatif a déjà le sien, plus bas). */}
          {etapeCourante === 'recap' ? null : (
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {titres[etapeCourante]}
            </Text>
          )}
        </View>
      ) : null}
      {compact || tunnelPleinEcran ? null : (
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {modification
            ? [slotWho(slot), installation?.name].filter(Boolean).join(' · ')
            : [installation?.name, installation ? capaciteLue : null].filter(Boolean).join(' · ')}
        </Text>
      )}
      {/* 📍 COLL-R-A6 (13/10, COL-018) — ouvert depuis une case vide de la semaine type (le site
          apporte le jour ET les heures), le panneau le dit dès l'étape 1, à chaque étape (le
          récapitulatif le redit) : planche P4v2-creneaux-ordi, « déjà rempli du jour et de
          l'heure ». Le panneau compact du planning garde sa ligne, plus bas. */}
      {parcoursGuide && !compact && depuisUneCase && etapeCourante !== 'recap' ? (
        <Text style={[Fonts.p2Bold, Fonts.neutral00]} testID="season-slot-moment">
          {/* R17-QUAND-1 : des jours différents n ont pas de jour fixe, les heures seules. */}
          {joursDifferents ? lesHeures : `${weekdayName(Number(jour))} · ${lesHeures}`}
        </Text>
      ) : null}

      {/* Depuis la fiche d un club (point 6) : l installation se choisit ici. */}
      {visible('installation') && !installationFixee && !modification && facilities.length > 1 ? (
        <View style={{ gap: 8 }}>
          {libelleDuChamp(t('collectiviteCreneaux.attribuer.installation', 'Installation'))}
          {listeDeChoix(facilities.map((/** @type {any} */ ligne) => ({
            actif: ligne.documentId === installationChoisie,
            couleur: ligne.planningColor || null,
            detail: [
              getFacilityTypeLabel(ligne.type),
              t('collectiviteCreneaux.liste.capacite', {
                count: Math.max(1, Number(ligne.maxSlots) || 1),
                defaultValue_one: '{{count}} équipe à la fois',
                defaultValue_other: '{{count}} équipes à la fois',
              }),
            ].filter(Boolean).join(' · '),
            key: ligne.documentId,
            libelle: ligne.name,
            onPress: () => {
              setInstallationChoisie(ligne.documentId);
              setPlateau(null);
              toucherLaSaisie();
            },
          })))}
        </View>
      ) : null}

      {!visible('club') || modification ? null : (
        <View style={{ gap: 8 }}>
          {libelleDuChamp(compact
            ? t('collectiviteCreneaux.attribuer.attribuerA', 'Attribuer à')
            : t('collectiviteCreneaux.attribuer.club', 'Club'))}
          {(() => {
            if (lectureDesClubs?.error) {
              return (
                <LectureEnErreur erreur={lectureDesClubs.error} onRetry={lectureDesClubs.refetch} />
              );
            }
            if (lectureDesClubs?.isLoading) return <ChargementDesChoix />;
            if (clubs.length === 0) {
              return (
                <View style={{ alignItems: 'center', gap: 12 }}>
                  <SvgIcon color={Colors.primary200} height={40} name="shield" width={40} />
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {t(
                      'collectiviteCreneaux.attribuer.aucunClub',
                      'Aucun club n’est rattaché à la Ville : invitez-en un depuis « Clubs ».',
                    )}
                  </Text>
                  {ajouterUnClub ? (
                    <Button
                      onPress={ajouterUnClub}
                      title={t('collectiviteRattachement.add.button', 'Ajouter un club')}
                      variant="Primary"
                    />
                  ) : null}
                </View>
              );
            }
            return listeDeChoix((fixedClubId
              ? clubs.filter((ligne) => ligne.documentId === fixedClubId)
              : clubs).map((ligne) => ({
              actif: ligne.documentId === club,
              club: { logoUrl: ligne.logoUrl || null, name: ligne.name },
              key: ligne.documentId,
              libelle: ligne.name,
              onPress: () => {
                setClub(ligne.documentId);
                setEquipe(null);
                toucherLaSaisie();
              },
            })));
          })()}
        </View>
      )}

      {visible('equipe') && (!modification || repartition) && club ? (
        <View style={{ gap: 8 }}>
          {/* A7-UX-2 : sur l'étape « Pour qui ? », la liste des équipes suit celle des clubs ; elle
              garde son titre, même en plein écran. */}
          {parcoursGuide && etapeCourante === 'club'
            ? titreDuChamp(t('collectiviteCreneaux.attribuer.equipe', 'Équipe (facultatif)'))
            : libelleDuChamp(t('collectiviteCreneaux.attribuer.equipe', 'Équipe (facultatif)'))}
          {(() => {
            if (equipes.error) {
              return <LectureEnErreur erreur={equipes.error} onRetry={equipes.refetch} />;
            }
            if (equipes.isLoading) return <ChargementDesChoix />;
            return listeDeChoix([
              {
                actif: !equipe,
                detail: t(
                  'collectiviteCreneaux.tunnel.toutLeClubDit',
                  'Le club répartit lui-même ses équipes.',
                ),
                key: 'tout-le-club',
                libelle: t('collectiviteCreneaux.attribuer.toutLeClub', 'Tout le club'),
                onPress: () => setEquipe(null),
              },
              ...(Array.isArray(equipes.data) ? equipes.data : []).map((/** @type {any} */ e) => ({
                actif: e.documentId === equipe,
                key: e.documentId,
                libelle: e.name,
                onPress: () => setEquipe(e.documentId),
              })),
            ]);
          })()}
        </View>
      ) : null}

      {!visible('jour') || heuresFigees || repartition || avecLeModele ? null : (
        <View style={{ gap: 8 }}>
          {libelleDuChamp(t('collectiviteCreneaux.attribuer.jour', 'Jour'))}
          {(() => {
            if (lecture.error) {
              return <LectureEnErreur erreur={lecture.error} onRetry={lecture.refetch} />;
            }
            if (lecture.isLoading) return <ChargementDesChoix />;
            return listeDeChoix(SEASON_SLOT_WEEKDAYS.map((numero) => {
            // « Jours : oui » (Adel, 13/10, planche P4v4-attribuer 3/5) : un jour plein a
            // certaines heures le dit sous son nom (les mots de la planche P4v2).
              const ceJour = creneauxDuJour(lecture.data?.data, numero, slot?.documentId);
              const pleines = fullRangesOfSlots(ceJour, capacite);
              return {
                actif: numero === jour && !joursDifferents,
                avertissement: pleines.length > 0,
                detail: pleines.length
                  ? t('collectiviteCreneaux.creneaux.completDe', 'complet {{heures}}', {
                    heures: pleines
                      .map((plage) => timeRange(fromMinutes(plage.start), fromMinutes(plage.end)))
                      .join(', '),
                    ...SANS_ECHAPPEMENT,
                  })
                  : null,
                key: `jour-${numero}`,
                libelle: weekdayName(numero),
                libelleCourt: weekdayName(numero, { short: true }),
                onPress: () => {
                  setJour(numero);
                  setJoursDifferents(false);
                  toucherLaSaisie();
                },
                testID: `jour-${numero}`,
              };
            }).concat(repartition ? [] : [{
              // 🗓️ R17-QUAND-1 (Q4 B, planche P11-quand-v2-tel 3/6) — des dates sur des jours
              // différents : « Quand ? » s'ouvrira sur le calendrier libre ; les heures vaudront
              // pour toutes.
              actif: joursDifferents,
              avertissement: false,
              detail: t(
                'collectiviteCreneaux.quand.joursDifferentsDetail',
                'Vous les choisirez dans un calendrier',
              ),
              key: 'joursDifferents',
              libelle: t('collectiviteCreneaux.quand.joursDifferents', 'Des jours différents'),
              libelleCourt: t(
                'collectiviteCreneaux.quand.joursDifferents',
                'Des jours différents',
              ),
              onPress: () => {
                setJoursDifferents(true);
                toucherLaSaisie();
              },
              testID: 'jour-dates',
            }]));
          })()}
        </View>
      )}

      {/* VILLE-T18A (T18 G29a, G32a) — les heures se CHOISISSENT : le sélecteur d heure de la
          création d événement (décision d Adel du 07/10, « réutiliser ce qu on a déjà ») ; elles
          se tapaient au clavier. Même valeur « HH:MM ». */}
      {/* 🗓️ DATESDABORD (point 9 d'Adel) — LE MÊME MODÈLE que l'étape « Date & horaire » de la
          création d'événement : le bloc partagé, avec les heures pleines de l'installation. */}
      {avecLeModele && visible('horaires') && !heuresFigees ? (
        <DateEtHoraire
          date={dateDuModele}
          debut={heureDuModele(debut)}
          fin={heureDuModele(fin)}
          finApres={debutLisible ? debut : null}
          libelleDebut={t('collectiviteCreneaux.attribuer.debut', 'Début')}
          libelleFin={t('collectiviteCreneaux.attribuer.fin', 'Fin')}
          onDate={changerLaDateDuModele}
          onDebut={(/** @type {Date} */ valeur) => changerLeDebut(format(valeur, 'HH:mm'))}
          onFin={(/** @type {Date} */ valeur) => {
            setFin(format(valeur, 'HH:mm'));
            toucherLaSaisie();
          }}
          onRepetition={changerLaRepetition}
          pleines={heuresPleines}
          repetition={repetitionDuModele}
        />
      ) : null}
      {!visible('horaires') || heuresFigees || repartition || avecLeModele ? null : (
        <View style={[Alignments.row, { gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <TimePickerInput
              label={t('collectiviteCreneaux.attribuer.debut', 'Début')}
              onChange={changerLeDebut}
              placeholder="17:30"
              pleines={heuresPleines}
              value={debut}
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePickerInput
              apres={debutLisible ? debut : null}
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
      {visible('horaires') && erreurHeures ? (
        <Text style={[Fonts.p3, Fonts.error500]}>{erreurHeures}</Text>
      ) : null}

      {/* 🗓️ R17-QUAND-1, point 4 — L'ÉTAPE « QUAND ? » (planches P10-quand-tel, P10-quand-ordi,
          P11-quand-v2-tel, validées par Adel le 19/10) : quatre formes, chacune dit ses séances
          et celles qui tombent dans une fermeture. « Modifier » : elle remplace « Période » ;
          « À partir du » reste (changer la forme coupe la série à cette date, comme un
          changement d'heure). */}
      {visible('quand') && !repartition ? (
        <View style={{ gap: 12 }} testID="season-slot-quand">
          {avecLeModele ? null : libelleDuChamp(titres.quand)}
          {/* DATESDABORD — à la création, la forme se choisit dans « Répéter » (au-dessus). */}
          {!avecLeModele && joursDifferents ? (
            <Button
              icon="arrowLeft"
              iconColor={Colors.primary200}
              iconPosition="before"
              onPress={() => allerA('jour')}
              style={{ alignSelf: 'flex-start', minHeight: 44 }}
              textStyle={{ color: Colors.primary200 }}
              title={t('collectiviteCreneaux.quand.unJourFixe', 'Un jour fixe chaque semaine')}
              variant="Ghost"
            />
          ) : null}
          {!avecLeModele && !joursDifferents ? listeDeChoix(formesProposees) : null}

          {formeChoisie === 'periode' && !avecLeModele ? (
            <View style={{ gap: 8 }}>
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
            </View>
          ) : null}

          {formeChoisie === 'deuxSemaines' && !avecLeModele ? (
            <View style={{ gap: 8 }}>
              {modification && dejaCommence ? null : (
                <DatePickerInput
                  label={modification
                    ? t('collectiviteCreneaux.quand.premiereDate', 'Première date')
                    : t('collectiviteCreneaux.quand.aPartirDu', 'À partir du')}
                  minimumDate={new Date()}
                  onChange={(/** @type {string} */ valeur) => {
                    setDeuxDu(valeur);
                    toucherLaSaisie();
                  }}
                  value={deuxDu}
                />
              )}
              {titreDuChamp(t('collectiviteCreneaux.quand.jusqua', 'Jusqu’à'))}
              {rangee([
                <PuceDeChoix
                  actif={deuxJusqua === 'fin'}
                  key="deux-fin"
                  libelle={t('collectiviteCreneaux.quand.finDeSaison', 'Fin de saison')}
                  onPress={() => {
                    setDeuxJusqua('fin');
                    toucherLaSaisie();
                  }}
                  testID="quand-jusqua-fin"
                />,
                <PuceDeChoix
                  actif={deuxJusqua === 'date'}
                  key="deux-date"
                  libelle={t('collectiviteCreneaux.quand.uneDate', 'Une date')}
                  onPress={() => {
                    setDeuxJusqua('date');
                    toucherLaSaisie();
                  }}
                  testID="quand-jusqua-date"
                />,
              ])}
              {deuxJusqua === 'date' ? (
                <DatePickerInput
                  label={t('collectiviteCreneaux.quand.jusquau', 'Jusqu’au')}
                  minimumDate={new Date()}
                  onChange={(/** @type {string} */ valeur) => {
                    setDeuxAu(valeur);
                    toucherLaSaisie();
                  }}
                  value={deuxAu}
                />
              ) : null}
              {seancesVues.length ? (
                <View
                  accessibilityLabel={t(
                    'collectiviteCreneaux.quand.prochaines',
                    'Prochaines dates : {{dates}}',
                    { dates: listeDeDates(seancesVues, 6), ...SANS_ECHAPPEMENT },
                  )}
                  style={[Alignments.row, Alignments.wrap, { gap: 6 }]}
                  testID="quand-prochaines-dates"
                >
                  {seancesVues.slice(0, 6).map((jourCivil) => {
                    const ferme = seancesFermees.some((ligne) => ligne.date === jourCivil);
                    return (
                      <Text
                        key={jourCivil}
                        style={[Fonts.p3Bold, {
                          borderColor: ferme
                            ? Colors.warning500
                            : withAlpha(Colors.primary500, 0.45),
                          borderRadius: 100,
                          borderStyle: ferme ? 'dashed' : 'solid',
                          borderWidth: 1,
                          color: ferme ? Colors.warning400 : Colors.neutral00,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          textDecorationLine: ferme ? 'line-through' : 'none',
                        }]}
                      >
                        {formatDayMonth(jourCivil)}
                      </Text>
                    );
                  })}
                  {seancesVues.length > 6 ? (
                    <Text style={[Fonts.p3Bold, Fonts.neutral200]}>…</Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {formeChoisie === 'dates' && !avecLeModele ? (
            <SeasonSlotDatesCalendar
              completDe={completLe}
              dates={datesChoisies}
              depuis={aujourdhui}
              fermeDe={(/** @type {string} */ jourCivil) => (
                fermeturesTouchees([jourCivil], fermetures, debut, fin)[0]?.label || null
              )}
              jusqua={finDeSaison}
              legendeVacances={vacances ? t(
                'collectiviteCreneaux.quand.calendrier.legendeVacances',
                'Vacances ({{zone}})',
                { zone: vacances.label, ...SANS_ECHAPPEMENT },
              ) : null}
              onToggle={(/** @type {string} */ jourCivil) => {
                setDatesChoisies((avant) => (avant.includes(jourCivil)
                  ? avant.filter((autre) => autre !== jourCivil)
                  : [...avant, jourCivil].sort()));
                toucherLaSaisie();
              }}
              vacancesDe={(/** @type {string} */ jourCivil) => (
                periodesDeVacances.find((periode) => (
                  periode.start <= jourCivil && jourCivil <= periode.end
                ))?.name || null
              )}
            />
          ) : null}

          {vacances ? (
            <TouchableOpacity
              accessibilityRole="checkbox"
              accessibilityState={{ checked: saufVacances }}
              onPress={() => {
                setSaufVacances((avant) => !avant);
                toucherLaSaisie();
              }}
              style={[Alignments.row, {
                alignItems: 'flex-start',
                backgroundColor: withAlpha(Colors.primary500, 0.08),
                borderColor: Colors.primary500,
                borderRadius: 12,
                borderWidth: 1,
                gap: 12,
                minHeight: 48,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }]}
              testID="quand-sauf-vacances"
            >
              {coche(saufVacances)}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('collectiviteCreneaux.quand.vacances.case', 'Sauf vacances scolaires')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>{zoneDesVacances}</Text>
              </View>
            </TouchableOpacity>
          ) : null}

          {/* R17-QUAND-2-BIS (planches P11-quand-v2-tel / -ordi) — les dates retirees dans une
              FEUILLE DU BAS, au telephone comme sur le site. */}
          {avecVacances ? (
            <BottomModal
              close={() => setVacancesDepliees(false)}
              footerComponent={(
                <Button
                  onPress={() => setVacancesDepliees(false)}
                  title={t('common.close', 'Fermer')}
                  variant="Secondary"
                />
              )}
              isVisible={vacancesDepliees}
              webPresentation="sheet"
              // Le tunnel plein ecran est un <Modal> (couche 9999 sur le site) : la feuille
              // passe dessus. `webZIndex` n'existe que sur le site (BottomModal.web.js).
              {.../** @type {any} */ ({ webZIndex: tunnelPleinEcran ? 10000 : undefined })}
            >
              <View style={{ gap: 4 }} testID="quand-vacances-liste">
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t(
                    'collectiviteCreneaux.quand.vacances.titreListe',
                    'Vacances retirées · {{zone}}',
                    { zone: vacances.label, ...SANS_ECHAPPEMENT },
                  )}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t(
                    'collectiviteCreneaux.quand.vacances.calendrierOfficiel',
                    'Calendrier officiel {{annees}}',
                    { annees: anneesScolaires, ...SANS_ECHAPPEMENT },
                  )}
                </Text>
                {vacancesDeLaForme.parPeriode.map(({ gardee, jours, periode }) => (
                  <TouchableOpacity
                    accessibilityLabel={t(
                      'collectiviteCreneaux.quand.vacances.periode',
                      '{{nom}} : retirer ces séances',
                      { nom: periode.name, ...SANS_ECHAPPEMENT },
                    )}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !gardee }}
                    key={periode.key}
                    onPress={() => basculerLaPeriode(periode.key)}
                    style={[Alignments.row, Alignments.alignCenter, {
                      borderBottomColor: withAlpha(Colors.neutral00, 0.08),
                      borderBottomWidth: 1,
                      gap: 8,
                      minHeight: 48,
                      paddingVertical: 8,
                    }]}
                    testID={`vacances-${periode.key}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{periode.name}</Text>
                      <Text style={[Fonts.p3, Fonts.neutral200]}>
                        {t(
                          'collectiviteCreneaux.quand.vacances.ligne',
                          '{{du}} – {{au}} · {{jours}}',
                          {
                            au: formatDayMonth(periode.end),
                            du: formatDayMonth(periode.start),
                            jours: listeDeDates(jours, 6),
                            ...SANS_ECHAPPEMENT,
                          },
                        )}
                      </Text>
                    </View>
                    {coche(!gardee)}
                  </TouchableOpacity>
                ))}
                <Text style={[Fonts.p3, Fonts.neutral300]}>{origineDesVacances}</Text>
              </View>
            </BottomModal>
          ) : null}

          {erreurDuQuand ? (
            <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>
              {erreurDuQuand}
            </Text>
          ) : null}
          {seances.length ? (
            <View
              accessibilityLiveRegion="polite"
              style={{
                backgroundColor: withAlpha(toutFerme ? Colors.warning500 : Colors.success500, 0.1),
                borderColor: withAlpha(toutFerme ? Colors.warning500 : Colors.success500, 0.4),
                borderRadius: 16,
                borderWidth: 1,
                gap: 4,
                padding: 12,
              }}
              testID="season-slot-seances"
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titreDesSeances}</Text>
              {formeChoisie === 'dates' ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>{listeDeDates(seancesVues)}</Text>
              ) : null}
              {texteDesFermetures ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>{texteDesFermetures}</Text>
              ) : null}
              {texteDesVacances ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>{texteDesVacances}</Text>
              ) : null}
              {avecVacances && vacancesDeLaForme.parPeriode.length ? (
                <Button
                  onPress={() => setVacancesDepliees(true)}
                  style={{ alignSelf: 'flex-start', minHeight: 44 }}
                  title={t('collectiviteCreneaux.quand.vacances.voir', 'Voir les dates retirées')}
                  variant="Ghost"
                />
              ) : null}
            </View>
          ) : null}

        </View>
      ) : null}
      {/* « À partir du » : la date d'effet d'une modification, répartition comprise (COLL-C2C). */}
      {visible('quand') && modification ? (
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

      {/* COLL-R-A7 — en plein écran, le récapitulatif ouvre l'étape, la place vient dessous. */}
      {tunnelPleinEcran && confirmationFinale ? recapEnLignes : null}
      {libresDuJour}
      {visible('horaires') || confirmationFinale ? (
        (() => {
          if (disponibilitesEnErreur) {
            return (
              <LectureEnErreur
                erreur={disponibilitesEnErreur}
                onRetry={lecture.error ? lecture.refetch : apercu.refetch}
              />
            );
          }
          if (disponibilitesEnCours) return <ChargementDesChoix />;
          return carteDeLaPlace;
        })()
      ) : null}
      {visible('horaires') || confirmationFinale ? lesHeuresLibres : null}

      {/* D66 : le champ « Plateau » n existe que si l installation a des plateaux nommes. */}
      {visible('horaires') && plateaux.length && !repartition ? (
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

      {/* R17-QUAND-1 — « Chaque mercredi de la saison » n'est plus toujours vrai : la forme. */}
      {confirmationFinale && compact && (jour || joursDifferents) && !tunnelPleinEcran ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteCreneaux.quand.phraseCompacte',
            '{{quand}} ({{seances}}). Le club est prévenu.',
            { quand: libelleDuQuand, seances: titreDesSeances, ...SANS_ECHAPPEMENT },
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
      {confirmationFinale && (!compact || tunnelPleinEcran) && !repartition && nomDuClub ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
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

      {parcoursGuide && compact && (visible('jour') || visible('horaires')) ? (
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {/* R17-QUAND-1 : des jours différents n ont pas de jour fixe, les heures seules. */}
          {joursDifferents ? lesHeures : `${weekdayName(Number(jour))} · ${lesHeures}`}
        </Text>
      ) : null}
      {parcoursGuide && confirmationFinale && !tunnelPleinEcran ? (
        <View style={{ gap: 8 }} testID="season-slot-recap">
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('eventWizard.steps.recap.title', 'Récapitulatif')}
          </Text>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{quiEtEquipe}</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>{installation?.name}</Text>
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {joursDifferents ? lesHeures : `${weekdayName(Number(jour))} · ${lesHeures}`}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]} testID="season-slot-recap-quand">
            {libelleDuQuand}
          </Text>
          {detailDuQuand ? <Text style={[Fonts.p3, Fonts.neutral200]}>{detailDuQuand}</Text> : null}
          {modification ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {`${t('collectiviteCreneaux.attribuer.aPartirDu', 'À partir du')} ${aPartirDu}`}
            </Text>
          ) : null}
          {plateau && plateaux.length ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>{plateaux[plateau - 1]}</Text>
          ) : null}
        </View>
      ) : null}

      {erreur ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>{erreur}</Text>
      ) : null}

      {tunnelPleinEcran ? null : (() => {
        if (!confirmationFinale) {
          return (
            <Button
              disabled={suivantBloque}
              onPress={avancer}
              title={t('common.next', 'Suivant')}
              variant="Primary"
            />
          );
        }
        return (
          <View style={{ gap: 8 }}>
            <Button
              disabled={!pret}
              isLoading={envoiEnCours}
              onPress={() => envoyer(besoinDeConfirmer)}
              title={libelleDeConfirmation}
              variant="Primary"
            />
            {besoinDeConfirmer ? (
              <Button
                onPress={changerLHeure}
                textStyle={{ color: Colors.primary200 }}
                title={t('collectiviteCreneaux.attribuer.changerHeure', 'Changer l’heure')}
                variant="Ghost"
              />
            ) : null}
            {onCancel && !besoinDeConfirmer && !parcoursGuide ? (
              <Button
                onPress={onCancel}
                textStyle={{ color: Colors.primary200 }}
                title={t('common.cancel', 'Annuler')}
                variant="Ghost"
              />
            ) : null}
          </View>
        );
      })()}
    </View>
  );

  if (!tunnelPleinEcran) return corps;

  // 📐 COLL-R-A7 — la fenetre plein ecran ; le retour d Android recule d une etape.
  // Le bas du gabarit : « Changer l heure » quand c est complet, sinon l action de l ecran.
  let actionDuBas = actionSecondaire;
  if (confirmationFinale && besoinDeConfirmer) {
    actionDuBas = {
      libelle: t('collectiviteCreneaux.attribuer.changerHeure', 'Changer l’heure'),
      onPress: changerLHeure,
    };
  }
  return (
    <FenetrePleinEcran onRequestClose={reculer}>
      <WizardStepLayout
        headerVariant="focus"
        isNextDisabled={confirmationFinale ? !pret : suivantBloque}
        isNextLoading={envoiEnCours}
        nextLabel={confirmationFinale ? libelleDeConfirmation : t('common.next', 'Suivant')}
        onBack={etape > 0 ? reculer : undefined}
        onClose={onCancel}
        onNext={confirmationFinale ? () => envoyer(besoinDeConfirmer) : avancer}
        onSkip={actionDuBas?.onPress}
        showSkip={Boolean(actionDuBas)}
        skipLabel={actionDuBas?.libelle}
        stepCount={etapes.length}
        stepIndex={etape + 1}
        subtitle={sousTitres[etapeCourante] || undefined}
        title={titres[etapeCourante] || ''}
      >
        {corps}
      </WizardStepLayout>
    </FenetrePleinEcran>
  );
}

export default SeasonSlotForm;
