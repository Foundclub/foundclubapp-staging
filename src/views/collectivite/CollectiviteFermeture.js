import { useNavigation, useRoute } from '@react-navigation/native';
import { format, isValid, parse } from 'date-fns';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { lieuAvecArticle } from '@/domains/collectivite/collectiviteDemandes';
import { formatOpeningHours } from '@/domains/collectivite/collectiviteDisplay';
import {
  CLOSURE_MAX_NAME_LENGTH,
  CLOSURE_REASONS,
  closureDaysLabel,
  closureErrorMessage,
  phraseForFacilityType,
  reasonLabel,
  touchedSessionLine,
} from '@/domains/facilityClosure/facilityClosureDisplay';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import { PuceDeChoix } from '@/components/organisms/seasonSlot/SeasonSlotForm';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useCollectiviteInstallations } from '@/services/collectivite/collectiviteQueries';
import {
  useCloseFacility,
  useFacilityClosurePreview,
  useFacilityClosures,
  useModifyFacilityClosure,
} from '@/services/facilityClosure/facilityClosureQueries';

import { getErrorMessage } from '@/utils/errors/displayError';
import { getFacilityTypeNoun } from '@/utils/facilityTypes';

import { useIsDesktop } from '@/responsive';

const HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SAISIE = 'dd/MM/yyyy';

/**
 * La cle d une ligne de la carte : le jour, l heure, le club et l equipe la rendent unique.
 * @param {any} seance - La seance touchee.
 * @returns {string} La cle.
 */
const cleDeSeance = (seance) => [
  seance?.date, seance?.startTime, seance?.club?.name, seance?.team?.name,
].join('|');

/**
 * « 02/10/2026 » (le champ date) en « 2026-10-02 » (le serveur), ou null.
 * @param {string} valeur - La saisie.
 * @returns {string | null} Le jour civil.
 */
const versJour = (valeur) => {
  const date = valeur ? parse(valeur, SAISIE, new Date()) : null;
  return date && isValid(date) ? format(date, 'yyyy-MM-dd') : null;
};

/**
 * « 2026-10-02 » en « 02/10/2026 ».
 * @param {string | null | undefined} jour - Le jour civil.
 * @returns {string} La saisie.
 */
const versSaisie = (jour) => {
  const date = jour ? parse(jour, 'yyyy-MM-dd', new Date()) : null;
  return date && isValid(date) ? format(date, SAISIE) : '';
};

/**
 * 🚧 COLL-C4B (02/10) — FERMER UNE INSTALLATION, BLOQUER UN CRENEAU (design HY521H1 page 4,
 * « P4v3-fermer-tel » ecrans 1, 2 et 3 ; « P4v3-fermer-ordi » ; contrat C2A §13).
 *
 * FERMER : des journees (du … au …), un motif (travaux, vacances, manifestation, autre), un mot
 * facultatif aux clubs, et « Publier aussi une actualite Fermeture », cochee par defaut (lot C4A).
 * BLOQUER : une plage d UN jour pour la Ville (« Forum des associations »). Pendant la saisie, une
 * carte nomme les seances touchees et les clubs prevenus. La confirmation redit le lieu, les jours
 * et les clubs ; le geste se defait par « Rouvrir » (onglet « Fermetures »).
 *
 * D16 : rien n est annule a la place des clubs — l ecran le dit, le serveur le garantit.
 * Le serveur est le seul juge des droits : l ecran envoie, puis dit le refus s il y en a un.
 * Parametres : `facilityId` (ou un choix parmi les installations de `collectiviteId`), `mode`
 * (`fermer` | `bloquer`), `closureId` (Modifier : relue au serveur, une adresse du site ne porte
 * pas d objet), et pour un blocage venu du planning : `date`, `startTime`, `endTime`.
 *
 * 🖥️ COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») — SUR ORDINATEUR, le formulaire vit dans le
 * PANNEAU DE DROITE du planning de l installation (« le panneau a droite, la semaine a gauche ») :
 * des que l installation est connue, l ecran cede la place a ce planning, panneau ouvert. Toutes
 * les entrees (accueil, fiche de l installation) passent par ici : aucune n a a changer. Les
 * parametres sont SCALAIRES, l adresse du site les porte.
 * @returns {import('react').ReactElement} L ecran.
 */
function CollectiviteFermeture() {
  const parametresDeLaRoute = useRoute().params;
  const params = useMemo(
    () => /** @type {any} */ (parametresDeLaRoute) || {},
    [parametresDeLaRoute],
  );
  const navigation = /** @type {any} */ (useNavigation());
  const isDesktop = useIsDesktop();
  const versLePlanning = isDesktop && Boolean(params.facilityId);
  const ouvrirLePanneau = useCallback((
    /** @type {string} */ facilityId,
    /** @type {string | null | undefined} */ facilityName,
  ) => {
    let fermeture = params.mode === 'bloquer' ? 'bloquer' : 'fermer';
    if (params.closureId) fermeture = 'modifier';
    /** @type {Record<string, string>} */
    const parametres = { facilityId, fermeture, sourceType: 'facility' };
    if (facilityName) parametres.contextDetailLabel = facilityName;
    ['closureId', 'date', 'startTime', 'endTime'].forEach((cle) => {
      if (params[cle]) parametres[cle] = String(params[cle]);
    });
    navigation.replace?.(RouteNames.PlanningWeekFullscreen, parametres);
  }, [navigation, params]);
  useEffect(() => {
    if (versLePlanning) ouvrirLePanneau(params.facilityId, params.facilityName);
  }, [ouvrirLePanneau, params.facilityId, params.facilityName, versLePlanning]);

  const fermetures = useFacilityClosures(
    params.closureId && !versLePlanning ? params.facilityId : null,
  );
  if (versLePlanning) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader />
      </ScreenContainer>
    );
  }
  if (!params.closureId) {
    return (
      <FormulaireDeFermeture
        existante={null}
        onFacilityChange={isDesktop ? ouvrirLePanneau : undefined}
        params={params}
      />
    );
  }
  const lignes = Array.isArray(fermetures.data?.data) ? fermetures.data.data : [];
  const existante = lignes
    .find((/** @type {any} */ ligne) => ligne?.documentId === params.closureId) || null;
  if (!existante) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <Loader />
      </ScreenContainer>
    );
  }
  return <FormulaireDeFermeture existante={existante} key={existante.documentId} params={params} />;
}

/**
 * 🖥️ COLL-C4B-BIS (03/10) — LE PANNEAU DE DROITE du planning d une installation, sur ordinateur
 * (« P4v3-fermer-ordi ») : le meme formulaire, sans ecran autour ni choix d installation (le
 * planning la nomme deja). Pour « Modifier », la fermeture est relue au serveur, comme l ecran.
 * Pendant la saisie, `onDraftChange` dit au planning ce qui serait ferme : il le hachure, et cerne
 * les seances touchees.
 * @param {{
 *   closureId?: string | null,
 *   collectiviteId?: string | null,
 *   date?: string | null,
 *   endTime?: string | null,
 *   facilityId: string,
 *   facilityName?: string | null,
 *   mode?: string | null,
 *   onCancel: () => void,
 *   onDone: () => void,
 *   onDraftChange?: (brouillon: any) => void,
 *   startTime?: string | null,
 * }} props
 * @returns {import('react').ReactElement} Le panneau.
 */
export function PanneauDeFermeture({
  closureId = null,
  collectiviteId = null,
  date = null,
  endTime = null,
  facilityId,
  facilityName = null,
  mode = null,
  onCancel,
  onDone,
  onDraftChange,
  startTime = null,
}) {
  const fermetures = useFacilityClosures(closureId ? facilityId : null);
  const params = {
    collectiviteId, date, endTime, facilityId, facilityName, mode, startTime,
  };
  const lignes = Array.isArray(fermetures.data?.data) ? fermetures.data.data : [];
  const existante = closureId
    ? lignes.find((/** @type {any} */ ligne) => ligne?.documentId === closureId) || null
    : null;
  if (closureId && !existante) return <Loader />;
  return (
    <FormulaireDeFermeture
      enPanneau
      existante={existante}
      key={existante?.documentId || mode || 'fermer'}
      onCancel={onCancel}
      onDone={onDone}
      onDraftChange={onDraftChange}
      params={params}
    />
  );
}

/**
 * Le formulaire lui-meme (creation ou modification), monte une fois la fermeture connue.
 * COLL-C4B-BIS : en panneau (ordinateur), il rend la main par `onDone` / `onCancel` au lieu de
 * revenir en arriere, et dit sa saisie par `onDraftChange`. `onFacilityChange` : l installation
 * choisie (ordinateur, depuis l accueil : on part alors vers le planning).
 * @param {{
 *   enPanneau?: boolean,
 *   existante: any,
 *   onCancel?: () => void,
 *   onDone?: () => void,
 *   onDraftChange?: (brouillon: any) => void,
 *   onFacilityChange?: (facilityId: string, facilityName: string | null) => void,
 *   params: any,
 * }} props
 * @returns {import('react').ReactElement} Le formulaire.
 */
function FormulaireDeFermeture({
  enPanneau = false, existante, onCancel, onDone, onDraftChange, onFacilityChange, params,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const modification = Boolean(existante?.documentId);
  const sorte = existante?.kind || (params.mode === 'bloquer' ? 'block' : 'closure');
  const bloquer = sorte === 'block';
  const collectiviteId = params.collectiviteId || existante?.collectivite?.documentId || null;

  const titre = bloquer
    ? t('collectiviteFermetures.form.titreBloquer', 'Bloquer un créneau')
    : t('collectiviteFermetures.form.titreFermer', 'Fermer une installation');
  useLayoutEffect(() => {
    // COLL-C4B-BIS : en panneau, l en-tete est celui du planning ; il ne se reecrit pas.
    if (enPanneau) return;
    navigation.setOptions?.({
      headerTitle: modification
        ? t('collectiviteFermetures.form.titreModifier', 'Modifier la fermeture')
        : titre,
    });
  }, [enPanneau, modification, navigation, t, titre]);

  const installations = useCollectiviteInstallations(collectiviteId);
  const liste = (Array.isArray(installations.data) ? installations.data : []).filter(
    (installation) => installation?.documentId,
  );
  const [facilityId, setFacilityId] = useState(
    existante?.facility?.documentId || params.facilityId || null,
  );
  const [choisir, setChoisir] = useState(!facilityId);
  const installation = liste.find((ligne) => ligne.documentId === facilityId)
    || (existante?.facility?.documentId === facilityId ? existante.facility : null)
    || (params.facilityName ? { documentId: facilityId, name: params.facilityName } : null);
  const nom = installation?.name || '';

  const [debut, setDebut] = useState(versSaisie(existante?.startDate || params.date));
  const [fin, setFin] = useState(versSaisie(existante?.endDate || params.date));
  const [motif, setMotif] = useState(existante?.reason || (bloquer ? null : 'travaux'));
  const [mot, setMot] = useState(existante?.message || '');
  const [pourQuoi, setPourQuoi] = useState(existante?.label || '');
  // FINITIONS12-COLL (03/10, decision d Adel « ferie B ») — le NOM d une fermeture (« Ascension »).
  const [nomDeFermeture, setNomDeFermeture] = useState(bloquer ? '' : existante?.label || '');
  const [heureDebut, setHeureDebut] = useState(
    String(existante?.startTime || params.startTime || '').slice(0, 5),
  );
  const [heureFin, setHeureFin] = useState(
    String(existante?.endTime || params.endTime || '').slice(0, 5),
  );
  const [publier, setPublier] = useState(true);
  const [confirmer, setConfirmer] = useState(false);
  const [erreur, setErreur] = useState(/** @type {string | null} */ (null));

  const jourDebut = versJour(debut);
  const jourFin = bloquer ? jourDebut : versJour(fin);
  const heuresLisibles = !bloquer
    || (HEURE.test(heureDebut) && HEURE.test(heureFin) && heureDebut < heureFin);
  const datesLisibles = Boolean(jourDebut && jourFin && jourFin >= jourDebut);

  // La carte des seances touchees part des que les dates (et les heures d un blocage) se lisent.
  const apercuParams = useMemo(
    () => (datesLisibles && heuresLisibles
      ? {
        endDate: jourFin,
        kind: bloquer ? 'block' : 'closure',
        startDate: jourDebut,
        ...(bloquer ? { endTime: heureFin, startTime: heureDebut } : {}),
      }
      : null),
    [bloquer, datesLisibles, heureDebut, heureFin, heuresLisibles, jourDebut, jourFin],
  );
  const apercu = useFacilityClosurePreview(facilityId, apercuParams);
  const carte = apercu.data?.data || null;

  // COLL-C4B-BIS (03/10, « P4v3-fermer-ordi ») : la saisie, dite au planning (panneau), qui la
  // hachure et cerne les seances touchees « pendant la saisie ». Rien quand elle ne se lit pas.
  const motDuBlocage = pourQuoi.trim() || null;
  const nomRetenu = nomDeFermeture.trim() || null;
  const motifRetenu = bloquer ? null : motif;
  const idDeLaFermeture = existante?.documentId || null;
  useEffect(() => {
    if (!onDraftChange) return;
    onDraftChange(apercuParams
      ? {
        documentId: idDeLaFermeture,
        endDate: apercuParams.endDate,
        endTime: apercuParams.endTime || null,
        kind: apercuParams.kind,
        label: bloquer ? motDuBlocage : nomRetenu,
        reason: motifRetenu,
        startDate: apercuParams.startDate,
        startTime: apercuParams.startTime || null,
      }
      : null);
  }, [apercuParams, bloquer, idDeLaFermeture, motDuBlocage, motifRetenu, nomRetenu, onDraftChange]);
  // En partant (envoye, annule, autre panneau), le planning efface le brouillon.
  useEffect(() => () => onDraftChange?.(null), [onDraftChange]);

  const fermer = useCloseFacility();
  const modifier = useModifyFacilityClosure();
  const enCours = fermer.isPending || modifier.isPending;
  const pret = Boolean(facilityId)
    && datesLisibles
    && heuresLisibles
    && (bloquer ? Boolean(pourQuoi.trim()) : Boolean(motif));

  let erreurDeSaisie = null;
  if (debut && fin && !bloquer && jourDebut && jourFin && jourFin < jourDebut) {
    erreurDeSaisie = t('collectiviteFermetures.form.ordreDates', 'La fin suit le début.');
  } else if (bloquer && heureDebut && heureFin && !heuresLisibles) {
    erreurDeSaisie = HEURE.test(heureDebut) && HEURE.test(heureFin)
      ? t('collectiviteFermetures.form.ordreHeures', 'L’heure de fin suit l’heure de début.')
      : t(
        'collectiviteFermetures.form.formatHeure',
        'Une heure s’écrit HH:MM (par exemple 09:00).',
      );
  }

  const envoyer = async () => {
    setErreur(null);
    /** @type {Record<string, any>} */
    const data = {
      endDate: jourFin,
      message: mot.trim() || null,
      startDate: jourDebut,
    };
    if (bloquer) {
      data.startTime = heureDebut;
      data.endTime = heureFin;
      data.label = pourQuoi.trim();
    } else {
      data.reason = motif;
      data.label = nomRetenu;
    }
    try {
      if (modification) {
        await modifier.mutateAsync({ closureId: existante.documentId, data });
      } else {
        await fermer.mutateAsync({
          data: {
            ...data,
            kind: bloquer ? 'block' : 'closure',
            ...(bloquer ? {} : { publishActualite: publier }),
          },
          facilityId,
        });
      }
      setConfirmer(false);
      if (onDone) onDone();
      else navigation.goBack?.();
    } catch (refus) {
      setConfirmer(false);
      setErreur(closureErrorMessage(t, refus) || getErrorMessage(/** @type {any} */ (refus)));
    }
  };

  const clubs = Array.isArray(carte?.clubs) ? carte.clubs : [];
  const nomsDesClubs = clubs.map((club) => club.name).filter(Boolean);
  const plusieursJours = Boolean(jourDebut && jourFin && jourDebut !== jourFin);
  const joursLongs = closureDaysLabel(
    t,
    { endDate: jourFin, startDate: jourDebut },
    { long: true },
  );

  const carteDesSeances = carte ? (
    <View
      accessibilityLiveRegion="polite"
      style={[
        Spaces.padding[12],
        {
          backgroundColor: withAlpha(Colors.warning500, 0.08),
          borderColor: withAlpha(Colors.warning500, 0.45),
          borderRadius: 14,
          borderWidth: 1,
          gap: 6,
        },
      ]}
      testID="fermeture-carte"
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {Number(carte.sessionsCount) > 0
          ? `${t('collectiviteFermetures.carte.seances', {
            count: Number(carte.sessionsCount),
            defaultValue_one: '{{count}} séance touchée',
            defaultValue_other: '{{count}} séances touchées',
          })}, ${t('collectiviteFermetures.carte.clubs', {
            count: Number(carte.clubsCount) || 0,
            defaultValue_one: '{{count}} club prévenu',
            defaultValue_other: '{{count}} clubs prévenus',
          })}`
          : t(
            'collectiviteFermetures.carte.aucune',
            'Aucune séance touchée : aucun club à prévenir.',
          )}
      </Text>
      {(Array.isArray(carte.sessions) ? carte.sessions : []).map(
        (/** @type {any} */ seance) => (
          <Text
            key={cleDeSeance(seance)}
            style={[Fonts.p3, Fonts.neutral100]}
            testID="fermeture-carte-seance"
          >
            {touchedSessionLine(seance, { withDay: plusieursJours })}
          </Text>
        ),
      )}
      {Number(carte.sessionsCount) > (Array.isArray(carte.sessions) ? carte.sessions.length : 0) ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('collectiviteFermetures.carte.etAutres', {
            count: Number(carte.sessionsCount) - carte.sessions.length,
            defaultValue_one: 'et {{count}} autre',
            defaultValue_other: 'et {{count}} autres',
          })}
        </Text>
      ) : null}
      {Number(carte.sessionsCount) > 0 ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {Number(carte.sessionsCount) > 1
            ? t(
              'collectiviteFermetures.carte.pasAnnulees',
              // eslint-disable-next-line max-len
              'Leurs séances ne sont pas annulées : chaque club les déplace ou les annule lui-même.',
            )
            : t(
              'collectiviteFermetures.carte.pasAnnulee',
              'Sa séance n’est pas annulée : le club la déplace ou l’annule lui-même.',
            )}
        </Text>
      ) : null}
    </View>
  ) : null;

  const choixDeLInstallation = (
    <View style={{ gap: 8 }}>
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.padding[12],
          {
            backgroundColor: withAlpha(Colors.neutral00, 0.04),
            borderColor: withAlpha(Colors.neutral00, 0.14),
            borderRadius: 14,
            borderWidth: 1,
            gap: 12,
            justifyContent: 'space-between',
          },
        ]}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {nom
              || t('collectiviteFermetures.form.choisirInstallation', 'Choisissez l’installation')}
          </Text>
          {installation?.maxSlots ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {[
                t('collectiviteCreneaux.liste.capacite', {
                  count: Number(installation.maxSlots) || 1,
                  defaultValue_one: '{{count}} équipe à la fois',
                  defaultValue_other: '{{count}} équipes à la fois',
                }),
                // COLL-C4B-BIS : fermer = des journees ; la planche (etat 1) dit les horaires.
                bloquer
                  ? null
                  : formatOpeningHours(installation.openingTime, installation.closingTime),
              ].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
        </View>
        {modification || liste.length < 2 ? null : (
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setChoisir(!choisir)}
            style={{ justifyContent: 'center', minHeight: 44 }}
            testID="fermeture-changer"
          >
            <Text style={[Fonts.p3Bold, Fonts.primary200]}>
              {t('collectiviteFermetures.form.changer', 'Changer')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {choisir && !modification ? (
        <View accessibilityRole="radiogroup" style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
          {liste.map((ligne) => (
            <PuceDeChoix
              actif={ligne.documentId === facilityId}
              key={ligne.documentId}
              libelle={ligne.name}
              onPress={() => {
                setFacilityId(ligne.documentId);
                setChoisir(false);
                onFacilityChange?.(ligne.documentId, ligne.name || null);
              }}
              testID={`fermeture-installation-${ligne.documentId}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );

  const champsDeDates = bloquer ? (
    <View style={{ gap: 12 }}>
      <DatePickerInput
        label={t('collectiviteFermetures.form.jour', 'Jour')}
        minimumDate={new Date()}
        onChange={(/** @type {string} */ valeur) => setDebut(valeur)}
        value={debut}
      />
      <View style={[Alignments.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Input
            density="compact"
            label={t('collectiviteFermetures.form.de', 'De')}
            onChangeText={(/** @type {string} */ valeur) => setHeureDebut(valeur.trim())}
            placeholder="09:00"
            testID="fermeture-heure-debut"
            value={heureDebut}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            density="compact"
            label={t('collectiviteFermetures.form.a', 'À')}
            onChangeText={(/** @type {string} */ valeur) => setHeureFin(valeur.trim())}
            placeholder="13:00"
            testID="fermeture-heure-fin"
            value={heureFin}
          />
        </View>
      </View>
      <Input
        density="compact"
        label={t('collectiviteFermetures.form.pourQuoi', 'Pour quoi')}
        onChangeText={setPourQuoi}
        placeholder={t('collectiviteFermetures.form.pourQuoiExemple', 'Forum des associations')}
        testID="fermeture-pour-quoi"
        value={pourQuoi}
      />
    </View>
  ) : (
    <View style={{ gap: 12 }}>
      <View style={[Alignments.row, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <DatePickerInput
            label={t('collectiviteFermetures.form.du', 'Du')}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ valeur) => {
              setDebut(valeur);
              if (!fin || (versJour(fin) || '') < (versJour(valeur) || '')) setFin(valeur);
            }}
            value={debut}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DatePickerInput
            label={t('collectiviteFermetures.form.au', 'Au')}
            minimumDate={new Date()}
            onChange={(/** @type {string} */ valeur) => setFin(valeur)}
            value={fin}
          />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          {t('collectiviteFermetures.form.motif', 'Motif')}
        </Text>
        <View accessibilityRole="radiogroup" style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
          {CLOSURE_REASONS.map((raison) => (
            <PuceDeChoix
              actif={motif === raison}
              key={raison}
              libelle={reasonLabel(t, raison)}
              onPress={() => setMotif(raison)}
              testID={`fermeture-motif-${raison}`}
            />
          ))}
        </View>
      </View>
      {/* FINITIONS12-COLL : le nom s imprime (planning, bandeau, affiches), donc court. */}
      <Input
        density="compact"
        label={t('collectiviteFermetures.form.nom', 'Nom (facultatif)')}
        maxLength={CLOSURE_MAX_NAME_LENGTH}
        onChangeText={setNomDeFermeture}
        placeholder={t('collectiviteFermetures.form.nomExemple', 'Ascension')}
        testID="fermeture-nom"
        value={nomDeFermeture}
      />
    </View>
  );

  let boutonPrincipal;
  if (modification) {
    boutonPrincipal = t('collectiviteFermetures.form.enregistrer', 'Enregistrer les changements');
  } else if (bloquer) {
    boutonPrincipal = t('collectiviteFermetures.form.boutonBloquer', 'Bloquer pour la Ville');
  } else {
    // FINITIONS11-COLL (03/10, planche 25) : « Fermer le gymnase ce jour-là » (type connu).
    const lieu = getFacilityTypeNoun(installation?.type);
    const valeursDuLieu = { ...SANS_ECHAPPEMENT, lieu: lieu?.nom };
    boutonPrincipal = plusieursJours
      ? phraseForFacilityType(lieu, {
        feminine: t(
          'collectiviteFermetures.form.boutonFermerJoursFeminin',
          'Fermer la {{lieu}} ces jours-là',
          valeursDuLieu,
        ),
        generic: t(
          'collectiviteFermetures.form.boutonFermerJours',
          'Fermer l’installation ces jours-là',
        ),
        masculine: t(
          'collectiviteFermetures.form.boutonFermerJoursMasculin',
          'Fermer le {{lieu}} ces jours-là',
          valeursDuLieu,
        ),
      })
      : phraseForFacilityType(lieu, {
        feminine: t(
          'collectiviteFermetures.form.boutonFermerJourFeminin',
          'Fermer la {{lieu}} ce jour-là',
          valeursDuLieu,
        ),
        generic: t(
          'collectiviteFermetures.form.boutonFermerJour',
          'Fermer l’installation ce jour-là',
        ),
        masculine: t(
          'collectiviteFermetures.form.boutonFermerJourMasculin',
          'Fermer le {{lieu}} ce jour-là',
          valeursDuLieu,
        ),
      });
  }

  const questionDeConfirmation = bloquer
    ? t(
      'collectiviteFermetures.confirmer.titreBloquer',
      'Bloquer {{installation}} {{jours}}, de {{debut}} à {{fin}} ?',
      {
        debut: heureDebut,
        fin: heureFin,
        installation: lieuAvecArticle(nom, t) || nom,
        jours: joursLongs
          ? t('collectiviteFermetures.confirmer.le', 'le {{jour}}', {
            jour: joursLongs,
            ...SANS_ECHAPPEMENT,
          })
          : '',
        ...SANS_ECHAPPEMENT,
      },
    )
    : t('collectiviteFermetures.confirmer.titreFermer', 'Fermer {{installation}} {{jours}} ?', {
      // COLL-FIX2 (T10) : « Fermer le Gymnase des Tilleuls … », comme la maquette.
      installation: lieuAvecArticle(nom, t) || nom,
      jours: plusieursJours
        ? joursLongs
        : t('collectiviteFermetures.confirmer.le', 'le {{jour}}', {
          jour: joursLongs,
          ...SANS_ECHAPPEMENT,
        }),
      ...SANS_ECHAPPEMENT,
    });
  // COLL-FIX2 (T10) : « AS Montrivage seront prévenus. Leurs séances » pour UN club.
  const quiEstPrevenu = nomsDesClubs.length
    ? t(
      nomsDesClubs.length === 1
        ? 'collectiviteFermetures.confirmer.prevenu'
        : 'collectiviteFermetures.confirmer.prevenus',
      nomsDesClubs.length === 1
        ? '{{clubs}} sera prévenu. Ses séances restent à sa charge.'
        : '{{clubs}} seront prévenus. Leurs séances restent à leur charge.',
      {
        clubs:
            nomsDesClubs.length > 1
              ? `${nomsDesClubs.slice(0, -1).join(', ')} ${t(
                'collectiviteFermetures.confirmer.et',
                'et',
              )} ${nomsDesClubs[nomsDesClubs.length - 1]}`
              : nomsDesClubs[0],
        ...SANS_ECHAPPEMENT,
      },
    )
    : t(
      'collectiviteFermetures.confirmer.personne',
      'Aucune séance n’est touchée : aucun club n’est prévenu.',
    );

  // COLL-C4B-BIS : le corps du formulaire, le meme dans l ecran (telephone) et le panneau
  // (ordinateur) ; le panneau n a pas le choix de l installation (le planning la nomme).
  const corps = (
    <>
      {enPanneau ? null : choixDeLInstallation}
      {champsDeDates}
      {erreurDeSaisie ? <Text style={[Fonts.p3, Fonts.error500]}>{erreurDeSaisie}</Text> : null}
      {facilityId ? carteDesSeances : null}
      {apercu.error ? (
        <Text style={[Fonts.p3, Fonts.error500]}>
          {closureErrorMessage(t, apercu.error)
              || getErrorMessage(/** @type {any} */ (apercu.error))}
        </Text>
      ) : null}
      <Input
        density="compact"
        label={t('collectiviteFermetures.form.mot', 'Un mot pour les clubs (facultatif)')}
        onChangeText={setMot}
        placeholder={t('collectiviteFermetures.form.motExemple', 'Réfection du sol')}
        testID="fermeture-mot"
        value={mot}
      />
      {bloquer || modification ? null : (
        <TouchableOpacity
          accessibilityLabel={t(
            'collectiviteFermetures.form.publier',
            'Publier aussi une actualité « Fermeture »',
          )}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: publier }}
          onPress={() => setPublier(!publier)}
          style={[
            Alignments.row,
            {
              alignItems: 'flex-start',
              gap: 12,
              minHeight: 44,
              paddingVertical: 4,
            },
          ]}
          testID="fermeture-publier"
        >
          <View
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: publier ? Colors.primary500 : 'transparent',
                borderColor: publier ? Colors.primary500 : Colors.neutral300,
                borderRadius: 6,
                borderWidth: 1.5,
                height: 22,
                width: 22,
              },
            ]}
          >
            {publier ? (
              <SvgIcon color={Colors.primary900} height={12} name="check" width={12} />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 0 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'collectiviteFermetures.form.publier',
                'Publier aussi une actualité « Fermeture »',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'collectiviteFermetures.form.publierPourQui',
                'Pour tous les membres des clubs rattachés.',
              )}
            </Text>
          </View>
        </TouchableOpacity>
      )}
      {erreur ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>
          {erreur}
        </Text>
      ) : null}
      <Button
        disabled={!pret || enCours}
        isLoading={enCours}
        onPress={() => (modification ? envoyer() : setConfirmer(true))}
        testID="fermeture-envoyer"
        title={boutonPrincipal}
        variant="Primary"
      />
    </>
  );
  const confirmation = (
    <BottomModal close={() => setConfirmer(false)} isVisible={confirmer} webPresentation="dialog">
      <View
        accessibilityRole="alert"
        style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 12 }]}
        testID="fermeture-confirmation"
      >
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{questionDeConfirmation}</Text>
        <Text style={[Fonts.p2, Fonts.neutral200]}>{quiEstPrevenu}</Text>
        <View style={[Alignments.row, { gap: 8, justifyContent: 'flex-end' }]}>
          <Button
            onPress={() => setConfirmer(false)}
            size="small"
            title={t('collectiviteFermetures.confirmer.annuler', 'Annuler')}
            variant="Ghost"
          />
          <Button
            isLoading={enCours}
            onPress={envoyer}
            size="small"
            testID="fermeture-confirmer"
            title={
                bloquer
                  ? t('collectiviteFermetures.confirmer.bloquer', 'Bloquer')
                  : t('collectiviteFermetures.confirmer.fermer', 'Fermer')
              }
            variant="Primary"
          />
        </View>
      </View>
    </BottomModal>
  );

  if (enPanneau) {
    let titreDuPanneau = t('collectiviteFermetures.panneau.titreFermer', 'Fermer l’installation');
    if (modification) {
      titreDuPanneau = t('collectiviteFermetures.form.titreModifier', 'Modifier la fermeture');
    } else if (bloquer) {
      titreDuPanneau = titre;
    }
    return (
      <View style={{ gap: 12 }} testID="fermeture-panneau">
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
            {titreDuPanneau}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t('collectiviteFermetures.panneau.fermer', 'Fermer le panneau')}
            accessibilityRole="button"
            onPress={onCancel}
            style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
            testID="fermeture-panneau-fermer"
          >
            <SvgIcon color={Colors.neutral200} height={14} name="close" width={14} />
          </TouchableOpacity>
        </View>
        {corps}
        {confirmation}
      </View>
    );
  }
  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24, paddingTop: 16 }}>
        <Text accessibilityRole="header" style={[Fonts.h2Black, Fonts.neutral00]}>
          {modification
            ? t('collectiviteFermetures.form.titreModifier', 'Modifier la fermeture')
            : titre}
        </Text>
        {corps}
      </ScrollView>
      {confirmation}
    </ScreenContainer>
  );
}

export default CollectiviteFermeture;
