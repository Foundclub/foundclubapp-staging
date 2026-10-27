import { format, isValid, parse } from 'date-fns';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Switch, Text, TouchableOpacity, View,
} from 'react-native';

import {
  etapesDuTunnel,
  etatDepuisLaVue,
  etatInitial,
  EVENEMENT_TYPES,
  finAutomatique,
  garderBrouillon,
  lieuLabel,
  lireBrouillon,
  NOM_MAX,
  occupationLabel,
  oublierBrouillon,
  placesLabel,
  quandLabel,
  quiLeVoitLabel,
  repetitionLabel,
  verifierEvenement,
  versCorpsDeLApi,
} from '@/domains/collectivite/evenementDeLaVille';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import AutocompleteAddressInput
  from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import DateEtHoraire from '@/components/organisms/dateEtHoraire/DateEtHoraire';
import SeancesTouchees from '@/components/organisms/evenementVille/SeancesTouchees';
import { PuceDeChoix } from '@/components/organisms/seasonSlot/SeasonSlotForm';

import { uploadActualiteFile } from '@/services/collectivite/collectiviteActualiteService';
import {
  useApercuEvenement,
  useOccupationDesLieux,
  useRelireLesOccupations,
} from '@/services/collectivite/collectiviteEvenementQueries';

import { getErrorStatus } from '@/utils/errors/displayError';
import { resolveMediaUrl } from '@/utils/mediaUrl';

import MediaPlatform from '@/platform/media';

// R17-EVT-1-BIS (f) : comme les photos de la page d'un complexe (ComplexeMaPage).
const AFFICHE_OCTETS_MAX = 10 * 1024 * 1024;

/**
 * 🏛️ R17-EVT-1 (20/10/2026, REC17-005) — « AJOUTER UN ÉVÉNEMENT DE LA VILLE ».
 *
 * Planches validées : P10-evenement-tel (le tunnel plein écran), P10-evenement-ordi (le panneau
 * de droite, au gabarit d'« Attribuer un créneau »), P11-evenement-v2-tel (« Où ? », « Qui le
 * voit ? » en 3 niveaux, le récapitulatif ; « Une réponse ? » = R17-EVT-2). Deux présentations, les
 * mêmes champs :
 *   - `tunnel` (téléphone) : Quel événement ? · Quand ? · Où ? · Quelle place ? · Qui le voit ? ·
 *     Récapitulatif ; depuis une case du planning (`initial.facilityId` + jour + heure),
 *     « Quand ? » et « Où ? » sont sautées ; « Ailleurs » saute « Quelle place ? » ;
 *   - `panneau` (ordinateur) : tous les champs dans un panneau, « Annuler » / « Publier ».
 * Le vous de la Ville partout. Les refus (planche, état 10) se disent sous le champ ; un envoi
 * perdu garde la saisie et propose « Réessayer ».
 * R17-EVT-1-BIS (e) : « Ailleurs » se saisit dans la saisie d'adresse partagée (R17-ADRESSE) :
 * suggestions, ou « Adresse introuvable ? » et un point posé sur la carte, qui part de la commune
 * de la Ville (`collectiviteVille`).
 * R17-EVT-1-BIS (c) : `etroit` — posé dans le panneau de droite du planning (380 px, qui défile
 * déjà) : une colonne, aucun défilement à lui.
 * 🏛️ VILLEEVT-CODE (27/10/2026, décisions d'Adel du 25/10 « 9- 1a 2B 3B ») : ce que l'entraîneur
 * avait de mieux — une phrase d'aide sous le type (ligne 1), le bloc partagé « Date & horaire » de
 * DATESDABORD avec la fin qui suit le début et le refus d'un début passé (ligne 3), « Impossible de
 * vérifier » + « Réessayer » et « Changer la date » à « Où ? » (ligne 5), une ligne « Quand » et un
 * « Modifier » écrit au récapitulatif (ligne 10), le brouillon gardé sur le site (ligne 12) ; puis
 * « Répéter » (« Sauf vacances scolaires » compris, à la création seulement) et « Nombre de
 * places ».
 * @param {{ collectiviteId: string, collectiviteNom?: string, collectiviteVille?: string,
 *   etroit?: boolean, evenement?: any, initial?: any, installations?: any[],
 *   onClose: () => void, onPublier: (corps: any) => Promise<any>,
 *   presentation?: 'tunnel' | 'panneau' }} props
 * @returns {import('react').ReactElement} Le formulaire.
 */
function EvenementDeLaVilleForm({
  collectiviteId,
  collectiviteNom = '',
  collectiviteVille = '',
  etroit = false,
  evenement = null,
  initial = null,
  installations = [],
  onClose,
  onPublier,
  presentation = 'tunnel',
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const modification = Boolean(evenement?.documentId);
  const depuisUneCase = Boolean(
    !modification && initial?.facilityId && initial?.date && initial?.startTime,
  );
  // VILLEEVT-CODE (ligne 12) : le brouillon d'une création (pas depuis une case : elle dit déjà
  // le jour, l'heure et le lieu).
  const avecBrouillon = !modification && !depuisUneCase;
  const [etat, setEtat] = useState(() => {
    if (modification) return etatDepuisLaVue(evenement);
    const brouillon = avecBrouillon ? lireBrouillon(collectiviteId) : null;
    // VILLEEVT-CODE (ligne 3) : la date part d'aujourd'hui, comme chez l'entraîneur.
    return brouillon || etatInitial({
      ...(initial || {}),
      date: initial?.date || format(new Date(), 'yyyy-MM-dd'),
    });
  });
  useEffect(() => {
    if (avecBrouillon) garderBrouillon(collectiviteId, etat);
  }, [avecBrouillon, collectiviteId, etat]);
  const [etape, setEtape] = useState(0);
  const [essaye, setEssaye] = useState(false);
  const [envoi, setEnvoi] = useState(
    /** @type {{ enCours: boolean, panne: any }} */ ({ enCours: false, panne: null }),
  );
  const [avecDescription, setAvecDescription] = useState(Boolean(etat.description));
  const [afficheEnvoi, setAfficheEnvoi] = useState({ enCours: false, refus: '' });
  const changer = (/** @type {Record<string, any>} */ champs) => setEtat(
    (/** @type {Record<string, any>} */ avant) => ({ ...avant, ...champs }),
  );

  const etapes = etapesDuTunnel({ ailleurs: etat.ailleurs, depuisUneCase });
  const etapeCourante = etapes[Math.min(etape, etapes.length - 1)];
  const erreurs = verifierEvenement(etat, { modification });
  const installation = installations.find((item) => item?.documentId === etat.facilityId) || null;
  const installationNom = etat.ailleurs ? null : installation?.name || null;
  const apercu = useApercuEvenement(collectiviteId, {
    endDate: etat.plusieursJours ? etat.dateFin : null,
    endTime: etat.heureFin,
    facilityId: etat.ailleurs ? null : etat.facilityId,
    startDate: etat.date,
    startTime: etat.heureDebut,
    takesPlace: !etat.ailleurs && etat.takesPlace && !erreurs.heures,
  });
  const touchees = apercu.data && !etat.ailleurs && etat.takesPlace ? apercu.data : null;
  // R17-EVT-1-BIS (d) : « Où ? » dit l'occupation de chaque installation aux jours et heures.
  const occupations = useOccupationDesLieux(collectiviteId, installations, {
    date: etat.date,
    dateFin: etat.plusieursJours ? etat.dateFin : '',
    heureDebut: etat.heureDebut,
    heureFin: etat.heureFin,
  });

  const quand = quandLabel(t, {
    endDate: etat.plusieursJours ? etat.dateFin : null,
    endTime: etat.heureFin,
    startDate: etat.date,
    startTime: etat.heureDebut,
  });
  const lieu = lieuLabel(t, {
    address: etat.adresse,
    facilityName: installationNom,
    takesPlace: etat.takesPlace,
  });
  const erreurDe = (/** @type {string} */ champ) => (
    essaye && erreurs[champ] ? t(erreurs[champ]) : undefined
  );

  const publier = async () => {
    setEssaye(true);
    if (Object.keys(erreurs).length) return;
    setEnvoi({ enCours: true, panne: null });
    try {
      await onPublier(versCorpsDeLApi(etat));
      if (avecBrouillon) oublierBrouillon(collectiviteId);
      setEnvoi({ enCours: false, panne: null });
    } catch (error) {
      setEnvoi({ enCours: false, panne: error || true });
    }
  };

  // « Annuler » (ou fermer) abandonne la saisie : le brouillon s'oublie.
  const fermer = () => {
    if (avecBrouillon) oublierBrouillon(collectiviteId);
    onClose();
  };

  // ---------------------------------------------------------------------------------------------
  // Les morceaux, communs au tunnel et au panneau
  // ---------------------------------------------------------------------------------------------

  const titreDeChamp = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3Bold, Fonts.neutral100]}>{texte}</Text>
  );

  /**
   * Une ligne à cocher (un seul choix par question).
   * @param {{ actif: boolean, aide?: string, onPress: () => void, pastille?: string,
   *   testID: string, titre: string }} props
   * @returns {import('react').ReactElement}
   */
  const ligneRadio = ({
    actif, aide, onPress, pastille, testID, titre,
  }) => (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: actif }}
      key={testID}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: actif
            ? withAlpha(Colors.primary500, 0.12)
            : withAlpha(Colors.neutral00, 0.04),
          borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.18),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          minHeight: 56,
          padding: 12,
        },
      ]}
      testID={testID}
    >
      {pastille !== undefined ? (
        <View
          style={{
            alignItems: 'center',
            backgroundColor: actif ? Colors.primary500 : 'transparent',
            borderColor: actif ? Colors.primary500 : withAlpha(Colors.neutral00, 0.4),
            borderRadius: 12,
            borderWidth: 1.5,
            height: 24,
            justifyContent: 'center',
            width: 24,
          }}
        >
          <Text style={[Fonts.p4Bold, { color: actif ? Colors.primary900 : Colors.neutral00 }]}>
            {pastille}
          </Text>
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        {aide ? <Text style={[Fonts.p3, Fonts.neutral200]}>{aide}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  const champNom = (
    <Input
      error={erreurDe('name')}
      label={
        presentation === 'panneau'
          ? t('collectiviteEvenement.quoi.nomPanneau', 'Nom de l’événement')
          : t('collectiviteEvenement.quoi.nom', 'Son nom')
      }
      maxLength={NOM_MAX}
      onChangeText={(/** @type {string} */ valeur) => changer({ name: valeur })}
      placeholder={t('collectiviteEvenement.quoi.nomExemple', 'Fête du sport')}
      testID="evenement-nom"
      value={etat.name}
    />
  );

  const champType = (
    <View style={{ gap: 8 }}>
      {titreDeChamp(t('collectiviteEvenement.quoi.type', 'Type'))}
      <View accessibilityRole="radiogroup" style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}>
        {EVENEMENT_TYPES.map((type) => (
          <PuceDeChoix
            actif={etat.kind === type}
            key={type}
            libelle={t(`collectiviteEvenement.types.${type}`)}
            onPress={() => changer({ kind: type })}
            testID={`evenement-type-${type}`}
          />
        ))}
      </View>
      {/* VILLEEVT-CODE (ligne 1) : ce que le type choisi veut dire, comme chez l'entraîneur. */}
      <Text style={[Fonts.p3, Fonts.neutral200]} testID="evenement-type-aide">
        {t(`collectiviteEvenement.typesAide.${etat.kind}`)}
      </Text>
    </View>
  );

  // VILLEEVT-CODE (3B) : « Nombre de places », facultatif ; vide = sans limite.
  const champPlaces = (
    <Input
      error={erreurDe('capacite')}
      keyboardType="number-pad"
      label={t('collectiviteEvenement.places.label', 'Nombre de places (facultatif)')}
      maxLength={6}
      onChangeText={(/** @type {string} */ valeur) => changer({
        capacite: String(valeur || '').replace(/\D/g, ''),
      })}
      placeholder={t('collectiviteEvenement.places.exemple', 'Sans limite')}
      testID="evenement-places"
      value={etat.capacite}
    />
  );

  const versSaisie = (/** @type {string} */ jour) => {
    const date = jour ? parse(jour, 'yyyy-MM-dd', new Date()) : null;
    return date && isValid(date) ? format(date, 'dd/MM/yyyy') : '';
  };
  const versJour = (/** @type {string} */ saisie) => {
    const date = saisie ? parse(saisie, 'dd/MM/yyyy', new Date()) : null;
    return date && isValid(date) ? format(date, 'yyyy-MM-dd') : '';
  };

  // 🗓️ VILLEEVT-CODE (ligne 3) — LE BLOC PARTAGÉ « DATE & HORAIRE » (DATESDABORD), le même que
  // la création d'événement et « Attribuer un créneau » : la fin suit le début ; « Répéter » à la
  // création (2B), jamais avec « Sur plusieurs jours » ; « Sauf vacances scolaires » dedans.
  const dateChoisie = (() => {
    const date = etat.date ? parse(etat.date, 'yyyy-MM-dd', new Date()) : new Date();
    return isValid(date) ? date : new Date();
  })();
  const heureDuBloc = (/** @type {string} */ heure) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(heure || ''));
    if (!match) return null;
    const instant = new Date(dateChoisie);
    instant.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return instant;
  };
  const refus = (/** @type {string} */ champ, /** @type {string} */ testID) => (
    erreurDe(champ) ? (
      <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.error300 }]} testID={testID}>
        {erreurDe(champ)}
      </Text>
    ) : null
  );
  const champsQuand = (
    <View style={{ gap: 12 }} testID="evenement-quand-colonnes">
      <DateEtHoraire
        date={dateChoisie}
        debut={heureDuBloc(etat.heureDebut)}
        fin={heureDuBloc(etat.heureFin)}
        finApres={etat.heureDebut || null}
        libelleDate={t('collectiviteEvenement.quand.le', 'Le')}
        libelleDebut={t('collectiviteEvenement.quand.de', 'De')}
        libelleFin={t('collectiviteEvenement.quand.a', 'À')}
        onDate={(/** @type {Date} */ valeur) => changer({ date: format(valeur, 'yyyy-MM-dd') })}
        onDebut={(/** @type {Date} */ valeur) => {
          const debut = format(valeur, 'HH:mm');
          changer({ heureDebut: debut, heureFin: finAutomatique(debut, etat.heureFin) });
        }}
        onFin={(/** @type {Date} */ valeur) => changer({ heureFin: format(valeur, 'HH:mm') })}
        // « Du » de la répétition EST la date de l'événement : les deux bougent ensemble.
        onRepetition={(/** @type {any} */ repetition) => changer(repetition
          ? {
            repetition,
            ...(repetition.du && isValid(repetition.du)
              ? { date: format(repetition.du, 'yyyy-MM-dd') }
              : {}),
          }
          : { repetition: null })}
        repetition={etat.repetition ? { ...etat.repetition, actif: true } : null}
        sansRepetition={modification || etat.plusieursJours}
        sousLaDate={refus('date', 'evenement-refus-date')}
        sousLesHeures={refus('heures', 'evenement-refus-heures')}
        testIDDate="evenement-date"
        titreRepeter={t('collectiviteEvenement.quand.repeterTitre', 'Répéter l’événement')}
        vacances={{
          actif: Boolean(etat.saufVacances),
          onBasculer: () => changer({ saufVacances: !etat.saufVacances }),
          testID: 'evenement-sauf-vacances',
          zone: t('collectiviteEvenement.quand.vacancesZone', 'La zone de votre commune'),
        }}
        webZIndex={presentation === 'tunnel' ? 10000 : undefined}
      />
      {refus('repetition', 'evenement-refus-repetition')}
      {etat.repetition ? null : (
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {t('collectiviteEvenement.quand.plusieursJours', 'Sur plusieurs jours')}
          </Text>
          <Switch
            accessibilityLabel={t(
              'collectiviteEvenement.quand.plusieursJours',
              'Sur plusieurs jours',
            )}
            onValueChange={(/** @type {boolean} */ valeur) => changer({
              dateFin: valeur ? etat.dateFin : '',
              plusieursJours: valeur,
            })}
            testID="evenement-plusieurs-jours"
            thumbColor={Colors.neutral00}
            trackColor={{ false: withAlpha(Colors.primary500, 0.3), true: Colors.primary500 }}
            value={etat.plusieursJours}
          />
        </View>
      )}
      {etat.plusieursJours ? (
        <DatePickerInput
          error={erreurDe('dateFin')}
          label={t('collectiviteEvenement.quand.jusquau', 'Jusqu’au')}
          minimumDate={new Date()}
          onChange={(/** @type {string} */ valeur) => changer({ dateFin: versJour(valeur) })}
          placeholder={t('collectiviteEvenement.quand.choisir', 'Choisir')}
          testID="evenement-date-fin"
          value={versSaisie(etat.dateFin)}
        />
      ) : null}
      {etat.plusieursJours ? (
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('collectiviteEvenement.quand.memesHeures', 'Les mêmes heures chaque jour.')}
        </Text>
      ) : null}
    </View>
  );

  const champAdresse = etat.ailleurs ? (
    <AutocompleteAddressInput
      address={etat.adresseLieu || (etat.adresse ? { label: etat.adresse } : undefined)}
      error={erreurDe('lieu')}
      label={t('collectiviteEvenement.ou.adresse', 'Adresse ou lieu')}
      permettreLieuSurCarte
      placeholder={t('collectiviteEvenement.ou.adresseExemple', 'Place de la mairie')}
      setAddress={(/** @type {any} */ option) => changer({
        adresse: String(option?.label || '').slice(0, 200),
        adresseLieu: option?.label ? option : null,
      })}
      villeConnue={collectiviteVille}
      vouvoyer
    />
  ) : null;

  const fermetureChoisie = !etat.ailleurs && etat.facilityId
    ? occupations[etat.facilityId]?.fermeture
    : null;
  // VILLEEVT-CODE (ligne 5) : une occupation illisible se dit et se relit ; une installation pleine
  // ou fermée propose de revenir à « Quand ? » (le tunnel).
  const relireLesOccupations = useRelireLesOccupations();
  const lectureEnEchec = installations.some((item) => occupations[item?.documentId]?.erreur);
  const choisieOccupee = !etat.ailleurs && etat.facilityId
    && (occupations[etat.facilityId]?.complet || fermetureChoisie);
  const lienDuBas = (/** @type {string} */ testID, /** @type {string} */ texte, /** @type {() => void} */ onPress) => (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
      testID={testID}
    >
      <Text style={[Fonts.p2Bold, Fonts.primary200]}>{texte}</Text>
    </TouchableOpacity>
  );
  const lignesOu = (
    <View
      accessibilityLabel={t('collectiviteEvenement.ou.titre', 'Où ?')}
      accessibilityRole="radiogroup"
      style={{ gap: 8 }}
    >
      {installations.map((item) => ligneRadio({
        actif: !etat.ailleurs && etat.facilityId === item.documentId,
        aide: occupationLabel(t, occupations[item.documentId]) || undefined,
        onPress: () => changer({ ailleurs: false, facilityId: item.documentId }),
        testID: `evenement-lieu-${item.documentId}`,
        titre: String(item.name || ''),
      }))}
      {ligneRadio({
        actif: etat.ailleurs,
        aide: t('collectiviteEvenement.ou.ailleursAide', 'Place, parc, salle des fêtes…'),
        onPress: () => changer({ ailleurs: true }),
        testID: 'evenement-lieu-ailleurs',
        titre: t('collectiviteEvenement.ou.ailleurs', 'Ailleurs dans la commune'),
      })}
      {fermetureChoisie ? (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: withAlpha(Colors.warning500, 0.12),
            borderColor: withAlpha(Colors.warning500, 0.5),
            borderRadius: 12,
            borderWidth: 1,
            padding: 12,
          }}
          testID="evenement-lieu-ferme"
        >
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'collectiviteEvenement.ou.fermeeAvertissement',
              '{{installation}} : fermeture ce jour-là. '
                + 'Vous pouvez quand même y tenir l’événement.',
              {
                installation: installation?.name || '',
                interpolation: { escapeValue: false },
              },
            )}
          </Text>
        </View>
      ) : null}
      {lectureEnEchec ? lienDuBas(
        'evenement-lieu-reessayer',
        t('collectiviteEvenement.ou.reessayer', 'Réessayer la vérification'),
        relireLesOccupations,
      ) : null}
      {choisieOccupee && presentation === 'tunnel' && etapes.includes('quand') ? lienDuBas(
        'evenement-lieu-changer-date',
        t('collectiviteEvenement.ou.changerDate', 'Changer la date'),
        () => setEtape(etapes.indexOf('quand')),
      ) : null}
      {champAdresse}
      {!etat.ailleurs && erreurDe('lieu') ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.error300 }]}>
          {erreurDe('lieu')}
        </Text>
      ) : null}
    </View>
  );

  // R17-EVT-1-BIS (h) : l'encart est partagé avec la fiche de la Ville (SeancesTouchees).
  const encadreTouchees = (
    <SeancesTouchees
      explication={t(
        'collectiviteEvenement.touchees.explication',
        'Son club la verra « Bloqué par la Ville · à déplacer » et pourra la déplacer.',
      )}
      touchees={touchees}
    />
  );

  const lignesPlace = (
    <View
      accessibilityLabel={t('collectiviteEvenement.place.titre', 'Quelle place prend-il ?')}
      accessibilityRole="radiogroup"
      style={{ gap: 8 }}
    >
      {ligneRadio({
        actif: etat.takesPlace,
        aide: t('collectiviteEvenement.place.touteAide', 'Aucun club n’y est pendant l’événement.'),
        onPress: () => changer({ takesPlace: true }),
        testID: 'evenement-place-toute',
        titre: t('collectiviteEvenement.place.toute', 'Toute l’installation'),
      })}
      {ligneRadio({
        actif: !etat.takesPlace,
        aide: t(
          'collectiviteEvenement.place.aucuneAide',
          'À côté : abords, parking, salle voisine.',
        ),
        onPress: () => changer({ takesPlace: false }),
        testID: 'evenement-place-aucune',
        titre: t('collectiviteEvenement.place.aucune', 'Aucune'),
      })}
      {encadreTouchees}
    </View>
  );

  const lignesQui = (
    <View
      accessibilityLabel={t('collectiviteEvenement.qui.titre', 'Qui le voit ?')}
      accessibilityRole="radiogroup"
      style={{ gap: 8 }}
    >
      {ligneRadio({
        actif: etat.visibility === 'clubs',
        aide: t(
          'collectiviteEvenement.qui.clubsAide',
          'Sur les plannings des installations. Pas d’actualité.',
        ),
        onPress: () => changer({ visibility: 'clubs' }),
        pastille: '1',
        testID: 'evenement-qui-clubs',
        titre: t('collectiviteEvenement.qui.clubs', 'Les clubs'),
      })}
      {ligneRadio({
        actif: etat.visibility === 'actualite',
        aide: t(
          'collectiviteEvenement.qui.actualiteAide',
          'En plus : une actualité de la Ville, avec la date et le lieu.',
        ),
        onPress: () => changer({ visibility: 'actualite' }),
        pastille: '2',
        testID: 'evenement-qui-actualite',
        titre: t('collectiviteEvenement.qui.actualite', 'Les clubs et une actualité'),
      })}
      {etat.visibility === 'actualite' ? (
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.08),
            borderLeftColor: Colors.primary500,
            borderLeftWidth: 2,
            gap: 8,
            marginLeft: 24,
            padding: 12,
          }}
        >
          {titreDeChamp(t('collectiviteEvenement.qui.actualiteVa', 'L’actualité va à'))}
          <View
            accessibilityRole="radiogroup"
            style={[Alignments.row, { flexWrap: 'wrap', gap: 8 }]}
          >
            <PuceDeChoix
              actif={etat.audience !== 'membres'}
              libelle={t('collectiviteEvenement.qui.dirigeants', 'Les dirigeants')}
              onPress={() => changer({ audience: 'dirigeants' })}
              testID="evenement-audience-dirigeants"
            />
            <PuceDeChoix
              actif={etat.audience === 'membres'}
              libelle={t('collectiviteEvenement.qui.membres', 'Tous les membres')}
              onPress={() => changer({ audience: 'membres' })}
              testID="evenement-audience-membres"
            />
          </View>
        </View>
      ) : null}
      {ligneRadio({
        actif: etat.visibility === 'public',
        aide: t(
          'collectiviteEvenement.qui.publicAide',
        ),
        onPress: () => changer({ visibility: 'public' }),
        pastille: '3',
        testID: 'evenement-qui-public',
        titre: t('collectiviteEvenement.qui.public', 'Tout le monde'),
      })}
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'collectiviteEvenement.qui.regle',
          'Le club dont une séance est touchée est prévenu dans tous les cas.',
        )}
      </Text>
    </View>
  );

  const champDescription = avecDescription ? (
    <Input
      label={t('collectiviteEvenement.description.label', 'Description')}
      maxLength={2000}
      multiline
      numberOfLines={4}
      onChangeText={(/** @type {string} */ valeur) => changer({ description: valeur })}
      placeholder={t(
        'collectiviteEvenement.description.exemple',
        'Stands des clubs, initiations, remise des trophées à 16:00.',
      )}
      testID="evenement-description"
      value={etat.description}
    />
  ) : (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={() => setAvecDescription(true)}
      style={{ justifyContent: 'center', minHeight: 44 }}
      testID="evenement-ajouter-description"
    >
      <Text style={[Fonts.p2Bold, Fonts.primary200]}>
        {t('collectiviteEvenement.description.ajouter', '+ Ajouter une description')}
      </Text>
    </TouchableOpacity>
  );

  // R17-EVT-1-BIS (f) (20/10) : l'affiche (facultative), choisie puis envoyée comme les pièces
  // des actualités de la Ville ; 10 Mo au plus.
  const choisirAffiche = async () => {
    const choisie = await MediaPlatform.pickImage();
    if (!choisie || choisie?.didCancel) return;
    const fichier = choisie?.assets?.[0] || choisie;
    if (Number(fichier?.fileSize ?? fichier?.size ?? 0) > AFFICHE_OCTETS_MAX) {
      setAfficheEnvoi({
        enCours: false,
        refus: t('collectiviteEvenement.affiche.tropLourde', 'Cette image dépasse 10 Mo.'),
      });
      return;
    }
    setAfficheEnvoi({ enCours: true, refus: '' });
    try {
      const envoyee = await uploadActualiteFile(choisie);
      if (envoyee?.id) {
        changer({ affiche: { id: envoyee.id, url: envoyee.url || null }, afficheModifiee: true });
      }
      setAfficheEnvoi({ enCours: false, refus: '' });
    } catch {
      setAfficheEnvoi({
        enCours: false,
        refus: t('collectiviteEvenement.affiche.echec', 'L’affiche n’est pas partie. Réessayez.'),
      });
    }
  };

  const champAffiche = (
    <View style={{ gap: 8 }}>
      {etat.affiche?.url ? (
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
          <Image
            accessibilityIgnoresInvertColors
            source={{ uri: resolveMediaUrl(etat.affiche.url) }}
            style={{ borderRadius: 8, height: 72, width: 54 }}
          />
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => changer({ affiche: null, afficheModifiee: true })}
            style={{ justifyContent: 'center', minHeight: 44 }}
            testID="evenement-retirer-affiche"
          >
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {t('collectiviteEvenement.affiche.retirer', 'Retirer l’affiche')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={afficheEnvoi.enCours}
          onPress={choisirAffiche}
          style={{ justifyContent: 'center', minHeight: 44 }}
          testID="evenement-ajouter-affiche"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {afficheEnvoi.enCours
              ? t('collectiviteEvenement.affiche.envoi', 'Envoi de l’affiche…')
              : t('collectiviteEvenement.affiche.ajouter', '+ Ajouter une affiche')}
          </Text>
        </TouchableOpacity>
      )}
      {afficheEnvoi.refus ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, { color: Colors.error300 }]}>
          {afficheEnvoi.refus}
        </Text>
      ) : null}
    </View>
  );

  const encadrePanne = envoi.panne ? (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: withAlpha(Colors.error500, 0.12),
        borderColor: withAlpha(Colors.error500, 0.5),
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
        padding: 12,
      }}
      testID="evenement-panne"
    >
      <Text style={[Fonts.p2Bold, { color: Colors.error300 }]}>
        {t('collectiviteEvenement.panne.titre', 'L’événement n’a pas été publié.')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral100]}>
        {/* C05 (Q2-11) : les intercepteurs HTTP rejettent `response.data.error` ({ status,
            message }) : un statut du serveur est un refus, qui dit sa raison. */}
        {Number(getErrorStatus(envoi.panne)) > 0
          ? String(envoi.panne?.message || envoi.panne?.response?.data?.error?.message || '')
          : t(
            'collectiviteEvenement.panne.connexion',
            'La connexion a été perdue. Ce que vous avez saisi est gardé.',
          )}
      </Text>
      <View style={{ alignSelf: 'flex-start' }}>
        <Button
          onPress={publier}
          size="small"
          title={t('collectiviteEvenement.panne.reessayer', 'Réessayer')}
          variant="Secondary"
        />
      </View>
    </View>
  ) : null;

  const libellePublier = modification
    ? t('collectiviteEvenement.enregistrer', 'Enregistrer')
    : t('collectiviteEvenement.publier', 'Publier l’événement');

  // ---------------------------------------------------------------------------------------------
  // Le PANNEAU (ordinateur) : tous les champs, « Annuler » / « Publier l'événement ».
  // ---------------------------------------------------------------------------------------------
  if (presentation === 'panneau') {
    // R17-EVT-1-BIS (c) : les champs une fois ; étroit, l'hôte (le panneau du planning) défile.
    const corpsDuPanneau = (
      <>
        {champNom}
        {champType}
        {champPlaces}
        {champsQuand}
        <View style={{ gap: 8 }}>
          {titreDeChamp(t('collectiviteEvenement.ou.titrePanneau', 'Où'))}
          {lignesOu}
        </View>
        {etat.ailleurs ? null : (
          <View style={{ gap: 8 }}>
            {titreDeChamp(t('collectiviteEvenement.place.titre', 'Quelle place prend-il ?'))}
            {lignesPlace}
          </View>
        )}
        <View style={{ gap: 8 }}>
          {titreDeChamp(t('collectiviteEvenement.qui.titre', 'Qui le voit ?'))}
          {lignesQui}
        </View>
        {champDescription}
        {champAffiche}
        {encadrePanne}
      </>
    );
    return (
      <View style={{ flex: 1, gap: 12 }} testID="evenement-panneau">
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
          <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
            {modification
              ? t('collectiviteEvenement.titreModifier', 'Modifier l’événement')
              : t('collectiviteEvenement.titre', 'Ajouter un événement de la Ville')}
          </Text>
          <TouchableOpacity
            accessibilityLabel={t('collectiviteEvenement.fermerLePanneau', 'Fermer le panneau')}
            accessibilityRole="button"
            onPress={fermer}
            style={{
              alignItems: 'center',
              height: 44,
              justifyContent: 'center',
              width: 44,
            }}
            testID="evenement-fermer"
          >
            <SvgIcon color={Colors.neutral200} height={14} name="close" width={14} />
          </TouchableOpacity>
        </View>
        {etroit ? (
          <View style={{ gap: 16, paddingBottom: 12 }}>{corpsDuPanneau}</View>
        ) : (
          <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 12 }} style={{ flex: 1 }}>
            {corpsDuPanneau}
          </ScrollView>
        )}
        <View style={[Alignments.row, { gap: 12 }]}>
          <Button
            onPress={fermer}
            style={{ flex: 1 }}
            title={t('collectiviteEvenement.annulerSaisie', 'Annuler')}
            variant="Secondary"
          />
          <Button
            disabled={envoi.enCours}
            isLoading={envoi.enCours}
            onPress={publier}
            style={{ flex: 1 }}
            title={libellePublier}
            variant="Primary"
          />
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Le TUNNEL (téléphone) : une question par étape, le récapitulatif, « Publier l'événement ».
  // ---------------------------------------------------------------------------------------------
  /** @type {Record<string, string>} */
  const titres = {
    ou: t('collectiviteEvenement.ou.titre', 'Où ?'),
    place: t('collectiviteEvenement.place.titre', 'Quelle place prend-il ?'),
    quand: t('collectiviteEvenement.quand.titre', 'Quand ?'),
    qui: t('collectiviteEvenement.qui.titre', 'Qui le voit ?'),
    quoi: t('collectiviteEvenement.quoi.titre', 'Quel événement ?'),
    recap: t('collectiviteEvenement.recap.titre', 'Récapitulatif'),
  };
  /** @type {Record<string, string>} */
  const sousTitres = {
    ou: [etat.name, quand].filter(Boolean).join(' · '),
    place: [installationNom, quand].filter(Boolean).join(' · '),
    quand: etat.name,
    qui: [etat.name, installationNom || etat.adresse].filter(Boolean).join(' · '),
    quoi: collectiviteNom,
    recap: t('collectiviteEvenement.recap.sousTitre', 'Relisez, puis publiez.'),
  };
  // Une étape ne s'ouvre pas tant que la sienne a un refus : il se dit sous le champ.
  /** @type {Record<string, string[]>} */
  const refusDeLEtape = {
    ou: ['lieu'],
    place: [],
    quand: ['date', 'heures', 'dateFin', 'repetition'],
    qui: [],
    quoi: ['name', 'capacite'],
    recap: Object.keys(erreurs),
  };
  const avancer = () => {
    if (refusDeLEtape[etapeCourante].some((champ) => erreurs[champ])) {
      setEssaye(true);
      return;
    }
    setEtape((avant) => Math.min(avant + 1, etapes.length - 1));
  };
  const allerA = (/** @type {string} */ cle) => {
    const index = etapes.indexOf(cle);
    if (index >= 0) setEtape(index);
  };
  const ligneDuRecap = (
    /** @type {string} */ cle,
    /** @type {string} */ libelle,
    /** @type {string} */ valeur,
    /** @type {string} */ cible,
  ) => (
    <TouchableOpacity
      accessibilityHint={t('collectiviteEvenement.recap.modifier', 'Modifier')}
      accessibilityLabel={`${libelle} : ${valeur}`}
      accessibilityRole="button"
      key={cle}
      onPress={() => allerA(cible)}
      style={[Alignments.row, Alignments.alignCenter, {
        borderBottomColor: withAlpha(Colors.neutral00, 0.08),
        borderBottomWidth: 1,
        gap: 12,
        minHeight: 56,
        paddingVertical: 8,
      }]}
      testID={`evenement-recap-${cle}`}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p4, Fonts.primary200]}>{libelle}</Text>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{valeur}</Text>
      </View>
      {/* VILLEEVT-CODE (ligne 10) : « Modifier » se lit, comme chez l'entraîneur. */}
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('collectiviteEvenement.recap.modifier', 'Modifier')}
      </Text>
    </TouchableOpacity>
  );
  const repetitionEnvoyee = versCorpsDeLApi(etat).data.repetition;
  const places = placesLabel(t, versCorpsDeLApi(etat).data.capacity);
  const recap = (
    <View style={{ gap: 12 }}>
      <View>
        {ligneDuRecap(
          'evenement',
          t('collectiviteEvenement.recap.evenement', 'Événement'),
          [etat.name, places].filter(Boolean).join(' · '),
          'quoi',
        )}
        {/* VILLEEVT-CODE (ligne 10) : « Quand » a sa ligne, qui va droit à « Quand ? ». */}
        {ligneDuRecap(
          'quand',
          t('collectiviteEvenement.recap.quand', 'Quand'),
          [quand, repetitionLabel(t, repetitionEnvoyee)].filter(Boolean).join(' · '),
          etapes.includes('quand') ? 'quand' : 'quoi',
        )}
        {ligneDuRecap(
          'ou',
          t('collectiviteEvenement.recap.ou', 'Où · place prise'),
          lieu,
          depuisUneCase ? 'place' : 'ou',
        )}
        {ligneDuRecap(
          'qui',
          t('collectiviteEvenement.recap.qui', 'Qui le voit'),
          quiLeVoitLabel(t, { audience: etat.audience, visibility: etat.visibility }),
          'qui',
        )}
      </View>
      {/* VILLEEVT-CODE : un refus au moment de publier (un jour passé, un brouillon relu) se dit
          ici aussi ; sinon « Publier » ne ferait rien de visible. */}
      {essaye && Object.keys(erreurs).length ? (
        <Text
          accessibilityRole="alert"
          style={[Fonts.p3, { color: Colors.error300 }]}
          testID="evenement-refus-recap"
        >
          {t(Object.values(erreurs)[0])}
        </Text>
      ) : null}
      <Text style={[Fonts.p3, Fonts.neutral200]} testID="evenement-recap-modifiable">
        {t('collectiviteEvenement.recap.modifiable', 'Tout reste modifiable après.')}
      </Text>
      {encadreTouchees}
      {champDescription}
      {champAffiche}
      {encadrePanne}
    </View>
  );
  /** @type {Record<string, import('react').ReactNode>} */
  const corps = {
    ou: lignesOu,
    place: lignesPlace,
    quand: champsQuand,
    qui: lignesQui,
    quoi: (
      <View style={{ gap: 16 }}>
        {champNom}
        <Text style={[Fonts.p3, Fonts.neutral200, { marginTop: -8 }]}>
          {t(
            'collectiviteEvenement.quoi.nomAide',
            'Les clubs le liront tel quel sur leurs plannings.',
          )}
        </Text>
        {champType}
        {champPlaces}
      </View>
    ),
    recap,
  };
  const derniere = etapeCourante === 'recap';
  return (
    <WizardStepLayout
      headerVariant="focus"
      isNextLoading={envoi.enCours}
      nextLabel={derniere ? libellePublier : t('common.next', 'Suivant')}
      onBack={etape > 0 ? () => setEtape((avant) => Math.max(avant - 1, 0)) : undefined}
      onClose={fermer}
      onNext={derniere ? publier : avancer}
      stepCount={etapes.length}
      stepIndex={Math.min(etape, etapes.length - 1) + 1}
      subtitle={sousTitres[etapeCourante] || undefined}
      title={titres[etapeCourante] || ''}
    >
      <View
        style={[Spaces.paddingBottom[16], { gap: 12 }]}
        testID={`evenement-etape-${etapeCourante}`}
      >
        {corps[etapeCourante]}
      </View>
    </WizardStepLayout>
  );
}

export default EvenementDeLaVilleForm;
