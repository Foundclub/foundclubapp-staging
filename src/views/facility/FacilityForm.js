import { joiResolver } from '@hookform/resolvers/joi';
import { useNavigation, useRoute } from '@react-navigation/native';
import i18next from 'i18next';
import Joi from 'joi';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { seasonSlotErrorMessage } from '@/domains/seasonSlot/seasonSlotDisplay';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import AutocompleteAddressInput from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteInstallations,
  useSaveCollectiviteInstallation,
} from '@/services/collectivite/collectiviteQueries';
import { useGetFacility } from '@/services/facility/facilityQueries';
import { createFacility, updateFacility } from '@/services/facility/facilityService';

import { getErrorMessage } from '@/utils/errors/displayError';
import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import {
  FACILITY_PLANNING_COLOR_NAMES,
  FACILITY_PLANNING_PALETTE,
  isValidFacilityPlanningColor,
  resolveFacilityPlanningColor,
} from '@/utils/facilityPlanningColor';
// COLL1D (D28) : la liste des types (5 d'avant + 8 des mairies) vit dans utils : les
// cartes des installations y lisent aussi le libelle.
import { FACILITY_TYPES, getFacilityTypeLabel } from '@/utils/facilityTypes';

// COLL-C2B (02/10) — design P4-form, ecran 2 : la feuille « Type » d une MAIRIE propose ses 11
// types ; « Salle video » et « Club House » sont des types de club. Ecrits en NOMS DE PROPRIETE :
// ce sont des valeurs du serveur (meme raison que dans utils/facilityTypes).
const RESERVES_AU_CLUB = { 'Club House': true, 'Salle vidéo': true };
const TYPES_DE_MAIRIE = FACILITY_TYPES.filter(
  (type) => !(/** @type {Record<string, boolean>} */ (RESERVES_AU_CLUB))[type.value],
);
// VILLE-INSTALLATION (07/10) — la feuille « Type » a une HAUTEUR DECLAREE. Taillee sur ses 11
// lignes (~790 pt), elle montait jusqu a son plafond (encoche + 20), sous la fleche de retour de
// l ecran, et sa zone defilante ne descendait pas jusqu a la derniere ligne (essai d Adel, 2.6.70 ;
// piege BottomModal sans `snapPoints`, cf. D19). 78 % : la hauteur des listes de choix
// d AutocompleteSelect. Temoin : __tests__/FacilityForm.VILLE-INSTALLATION.feuilleType.test.js.
const FEUILLE_TYPE_HAUTEUR = ['78%'];
// D66, contrat C2A §8 : un nom par plateau, court (le cycle de vie du serveur refuse au-dela).
const PLATEAU_NOM_MAX = 40;
const LETTRES_DE_PLATEAU = 'ABCDEFGHIJ';

// I18N-4 : le schema est construit a chaque rendu -- ses messages sont lus dans la langue
// courante (un schema de module les figeait dans celle du demarrage).
// TEXTES-COLLECTIVITES (01/10, « ton A ») : en mode collectivite, la mairie est VOUVOYEE —
// ses messages ont leurs propres clefs ; le club garde les siens, au mot pres.
const buildSchema = (isCollectiviteMode = false) => Joi.object({
  // FINITIONS3 : `null` (installation posee en base sans adresse) passe ici ; c est
  // handleSave qui juge l adresse, avec son message et son alerte.
  address: Joi.alternatives().try(
    Joi.string().allow('').optional(),
    Joi.object().optional(),
  ).allow(null),
  capacityConflictMode: Joi.string().valid(
    FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
  ).required(),
  maxSlots: Joi.number().min(1).required().messages({
    'any.required': i18next.t(
      'facilityForm.validation.capacityRequired',
      'La capacité est requise',
    ),
    'number.min': i18next.t(
      'facilityForm.validation.capacityMin',
      "La capacité doit être d'au moins 1",
    ),
  }),
  name: Joi.string().required().messages({
    'string.empty': i18next.t('facilityForm.validation.nameRequired', 'Le nom est requis'),
  }),
  // COLL-C2B (02/10) — les plateaux nommes (mairie seulement) : juges dans handleSave.
  planningColor: Joi.string().valid(...FACILITY_PLANNING_PALETTE).required().messages(
    isCollectiviteMode
      ? {
        'any.only': i18next.t(
          'facilityForm.collectivite.validation.colorInvalid',
          'Sélectionnez une couleur valide',
        ),
        'string.empty': i18next.t(
          'facilityForm.collectivite.validation.colorRequired',
          'Sélectionnez une couleur',
        ),
      }
      : {
        'any.only': i18next.t(
          'facilityForm.validation.colorInvalid',
          'Sélectionne une couleur valide',
        ),
        'string.empty': i18next.t(
          'facilityForm.validation.colorRequired',
          'Sélectionne une couleur',
        ),
      },
  ),
  plateaux: Joi.array().items(Joi.string().allow('')).optional(),
  plateauxActifs: Joi.boolean().optional(),
  type: Joi.string().required().messages({
    'string.empty': i18next.t('facilityForm.validation.typeRequired', 'Le type est requis'),
  }),
});

const getAddressCoordinates = (address) => {
  if (!address || typeof address !== 'object') return null;

  if (typeof address.value === 'string' && address.value.includes('|')) {
    const [lngValue, latValue] = address.value.split('|');
    const lng = Number(lngValue);
    const lat = Number(latValue);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }

  const coordinates = address?.geometry?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      return { lat, lng };
    }
  }

  return null;
};

const normalizeAddressPayload = (address) => {
  const coordinates = getAddressCoordinates(address);
  if (!coordinates) return null;

  const description = typeof address === 'object'
    ? String(address?.label || address?.description || '').trim()
    : '';

  return {
    description: description || 'Adresse',
    geometry: {
      coordinates: [coordinates.lng, coordinates.lat],
      type: 'Point',
    },
  };
};

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return null;
  }

  return normalizedValue;
};

// L'ordre est celui du controle segmente. Les VALEURS sont le contrat avec le
// serveur (`capacityConflictMode`) : seule leur presentation change ici.
const FACILITY_CONFLICT_MODE_OPTIONS = [
  {
    descriptionFallback: 'Le créneau passe en demande, un dirigeant valide avant confirmation.',
    descriptionKey: 'facilityForm.conflictModes.pending.description',
    // D51 : « Demande en attente » decrivait l'etat du creneau, pas le choix
    // qu'on fait. Le libelle dit maintenant ce que l'option DECLENCHE, et il
    // est complet — un libelle systeme ne se tronque jamais.
    labelFallback: 'Demande à valider',
    labelKey: 'facilityForm.conflictModes.pending.label',
    value: FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
  },
  {
    descriptionFallback: 'Le créneau reste confirmé, les dirigeants sont notifiés.',
    descriptionKey: 'facilityForm.conflictModes.allow.description',
    labelFallback: 'Autoriser et notifier',
    labelKey: 'facilityForm.conflictModes.allow.label',
    value: FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
  },
];

/**
 * TEXTES-COLLECTIVITES (01/10) — le NOM de chaque couleur de la palette, pour un lecteur
 * d ecran : les 10 pastilles s appelaient toutes « Couleur de planning ».
 * @param {(cle: string, repli: string) => string} t - La traduction.
 * @param {string} couleur - Une couleur de FACILITY_PLANNING_PALETTE.
 * @returns {string} Son nom, ou la couleur elle-meme si la palette change sans lui.
 */
const nomDeCouleur = (t, couleur) => {
  switch (/** @type {Record<string, string>} */ (FACILITY_PLANNING_COLOR_NAMES)[couleur]) {
    case 'apricot': return t('facilityForm.colors.apricot', 'Abricot');
    case 'emerald': return t('facilityForm.colors.emerald', 'Vert émeraude');
    case 'lightBlue': return t('facilityForm.colors.lightBlue', 'Bleu clair');
    case 'mint': return t('facilityForm.colors.mint', 'Vert menthe');
    case 'orange': return t('facilityForm.colors.orange', 'Orange');
    case 'pink': return t('facilityForm.colors.pink', 'Rose');
    case 'purple': return t('facilityForm.colors.purple', 'Violet');
    case 'red': return t('facilityForm.colors.red', 'Rouge');
    case 'royalBlue': return t('facilityForm.colors.royalBlue', 'Bleu roi');
    case 'skyBlue': return t('facilityForm.colors.skyBlue', 'Bleu ciel');
    default: return couleur;
  }
};

/**
 * Option de conflit correspondant a une valeur, avec repli sur la premiere.
 * Une seule source pour le controle segmente ET la puce de l'apercu.
 * @param {string | undefined | null} value
 * @returns {typeof FACILITY_CONFLICT_MODE_OPTIONS[0]}
 */
const getConflictModeOption = (value) => (
  FACILITY_CONFLICT_MODE_OPTIONS.find((option) => option.value === value)
  || FACILITY_CONFLICT_MODE_OPTIONS[0]
);

// D63 : 30 pt ne tenait que parce que le libelle occupait la meme ligne. La
// maquette sort le libelle au-dessus, ce qui rend la rangee au nombre et a ses
// deux boutons — assez de place pour la cible tactile de 44 pt du pack.
const STEPPER_BUTTON_STYLE = {
  borderRadius: 14,
  height: 44,
  paddingHorizontal: 0,
  width: 44,
};

// Le nombre occupe toute la place entre les deux boutons, avec son unite juste
// dessous : c'est ce centrage qui fait lire « 1 equipe a la fois » d'un trait.
const STEPPER_VALUE_STYLE = {
  textAlign: /** @type {const} */ ('center'),
};

// D51 : 34 pt, la taille du pack. Les 10 pastilles ne tiennent alors PLUS sur
// une ligne (34 x 10 = 340 pt pour 328 pt utiles sur un ecran de 360), donc
// elles passent sur deux rangees — c'est ce que fait le mock de reference.
// Le hitSlop porte la cible reelle a 44 pt sans grossir le rond.
const PLANNING_SWATCH_STYLE = {
  alignItems: /** @type {const} */ ('center'),
  borderRadius: 999,
  height: 34,
  justifyContent: /** @type {const} */ ('center'),
  width: 34,
};

// 5 de marge sur chaque bord : 34 + 5 + 5 = 44 pt de cible effective.
const PLANNING_SWATCH_HIT_SLOP = {
  bottom: 5, left: 5, right: 5, top: 5,
};

// D63 : la maquette detache l'anneau du rond (un ecart sombre entre les deux).
// C'est ce qui le rend lisible sur une pastille deja coloree, la ou une bordure
// collee au bord se confondait avec elle. L'anneau est porte par une enveloppe
// de meme encombrement pour TOUTES les pastilles, sinon la grille sauterait a
// chaque changement de couleur : 34 + 2 x (3 d'ecart + 2 de trait) = 44 pt.
const PLANNING_SWATCH_RING_STYLE = {
  borderRadius: 999,
  borderWidth: 2,
  padding: 3,
};

const TYPE_CHIP_STYLE = {
  height: 32,
  paddingHorizontal: 12,
};

// 38 pt = deux lignes de p3. L'explication sous les pilules change de longueur
// selon le mode choisi : sans plancher, tout ce qui suit remonte ou descend a
// chaque bascule.
const CONFLICT_HINT_STYLE = {
  minHeight: 38,
};

// VILLE-INSTALLATION (07/10) — plus d horaires d ouverture : décision d Adel « on ne met pas
// d ouverture ni de fermeture » (essai de la 2.6.70). Ceux deja en base restent : le formulaire
// ne les envoie plus, et un champ absent reste inchange au serveur (readInstallationPayload).
/**
 * @type {{ address: any, capacityConflictMode: string, maxSlots: number, name: string,
 *   planningColor: string, plateaux: string[], plateauxActifs: boolean, type: string }}
 */
const DEFAULT_FORM_VALUES = {
  address: null,
  capacityConflictMode: FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
  maxSlots: 1,
  name: '',
  planningColor: FACILITY_PLANNING_PALETTE[0],
  // COLL-C2B (02/10) : les plateaux nommes ne se saisissent qu en mode collectivite.
  plateaux: [],
  plateauxActifs: false,
  type: 'Terrain',
};

// COLL-C2B (02/10) — design P4-form, ecran 3 : une installation NEUVE de la Ville n a pas de
// type choisi d avance (« Choisir le type ») ; « Creer » s allume quand il l est.
const DEFAULT_VILLE_VALUES = { ...DEFAULT_FORM_VALUES, type: '' };

/**
 * Facility create/update screen.
 * @returns {import('react').ReactElement}
 */
function FacilityForm() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { userData } = useAuth();
  const routedFacility = route.params?.facility || null;
  const routedFacilityId = sanitizeRouteParam(route.params?.facilityId);
  // 🏛️ COLLECTIVITES 1c — MODE COLLECTIVITE (route CollectiviteInstallationForm) : le
  // gestionnaire cree ou modifie une installation de SA collectivite par la route du
  // serveur (liste blanche, horaires compris). Sur le site, seul l identifiant voyage :
  // l installation se relit dans la liste de la collectivite, jamais par GET /facilities.
  const collectiviteId = sanitizeRouteParam(/** @type {any} */ (route.params)?.collectiviteId);
  const isCollectiviteMode = Boolean(collectiviteId);
  const collectiviteInstallations = useCollectiviteInstallations(collectiviteId, {
    enabled: Boolean(collectiviteId && routedFacilityId && !routedFacility),
  });
  const saveCollectiviteInstallation = useSaveCollectiviteInstallation();
  const facilityQuery = useGetFacility(routedFacilityId, {
    enabled: Boolean(routedFacilityId && !routedFacility && !isCollectiviteMode),
  });
  const collectiviteRows = Array.isArray(collectiviteInstallations.data)
    ? collectiviteInstallations.data
    : [];
  const {
    data: fetchedFacility,
    error: facilityError,
    isLoading: facilityLoading,
    refetch: refetchFacility,
  } = isCollectiviteMode
    ? {
      ...collectiviteInstallations,
      data: collectiviteRows.find((row) => row?.documentId === routedFacilityId) || null,
    }
    : facilityQuery;
  const facility = routedFacility || fetchedFacility || null;
  const isEdit = Boolean(routedFacilityId || facility?.documentId || facility?.id);
  const contextClubId = isCollectiviteMode ? null : route.params?.clubId
    || facility?.club?.documentId
    || facility?.club?.id
    || userData?.club?.documentId
    || userData?.club?.id
    || null;
  const contextCmId = isCollectiviteMode ? null : route.params?.cmId
    || facility?.multisportClub?.documentId
    || facility?.multisportClub?.id
    || null;

  const valeursParDefaut = isCollectiviteMode ? DEFAULT_VILLE_VALUES : DEFAULT_FORM_VALUES;
  const {
    clearErrors,
    control,
    formState: { errors },
    handleSubmit,
    reset,
    setError,
    setValue,
  } = useForm({
    defaultValues: valeursParDefaut,
    resolver: joiResolver(buildSchema(isCollectiviteMode)),
  });
  // COLL-C2B (02/10) — ce que la Ville a deja saisi : « Creer » s allume quand le nom, le type
  // et l adresse sont la ; les plateaux suivent le nombre d equipes a la fois.
  const [nomSaisi, typeChoisi, adresseSaisie, equipesALaFois, plateauxActifs, plateaux] = useWatch({
    control,
    name: ['name', 'type', 'address', 'maxSlots', 'plateauxActifs', 'plateaux'],
  });
  const plateauxPossibles = isCollectiviteMode && Number(equipesALaFois || 1) >= 2;
  const [feuilleTypeOuverte, setFeuilleTypeOuverte] = useState(false);
  // Un refus du serveur, dit au-dessus du bouton (design P4-form, ecran 5) : plus de fenetre.
  const [erreurServeur, setErreurServeur] = useState(/** @type {string | null} */ (null));

  const [loading, setLoading] = useState(false);
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  const retourALaListe = () => {
    const nav = /** @type {any} */ (navigation);
    if (isCollectiviteMode) nav.navigate(RouteNames.CollectiviteInstallations, { collectiviteId });
    else nav.navigate(RouteNames.FacilityList);
  };

  // D51 : les 6 `watch()` sont partis avec l'apercu. Chaque reglage affiche
  // desormais son propre etat depuis son Controller — plus rien a observer
  // depuis l'exterieur du formulaire, donc plus de re-rendu global a chaque
  // frappe dans le champ « Nom ».
  const isMissingCreateContext = !isEdit && !contextClubId && !contextCmId && !isCollectiviteMode;
  const isFacilityNotFound = isEdit && !facilityLoading && !facilityError && !facility;

  useEffect(() => {
    if (facility) {
      reset({
        ...DEFAULT_FORM_VALUES,
        address: facility?.address || null,
        capacityConflictMode: String(getFacilityConflictMode(facility) || FACILITY_CONFLICT_MODES.PENDING_VALIDATION),
        maxSlots: Number(facility?.maxSlots || 1),
        name: facility?.name || '',
        planningColor: resolveFacilityPlanningColor(facility) || FACILITY_PLANNING_PALETTE[0],
        plateaux: Array.isArray(facility?.plateaux) ? facility.plateaux.map(String) : [],
        plateauxActifs: Array.isArray(facility?.plateaux) && facility.plateaux.length > 0,
        type: facility?.type || 'Terrain',
      });
      return;
    }

    if (!isEdit) {
      reset(isCollectiviteMode ? DEFAULT_VILLE_VALUES : DEFAULT_FORM_VALUES);
    }
  }, [facility, isCollectiviteMode, isEdit, reset]);

  const conflictModeOptions = useMemo(() => FACILITY_CONFLICT_MODE_OPTIONS.map((option) => ({
    label: t(option.labelKey, option.labelFallback),
    value: option.value,
  })), [t]);

  // Libelles sortis du JSX : ils y depassaient la longueur de ligne autorisee.
  const conflictModeFieldLabel = t(
    'facilityForm.fields.capacityConflictMode',
    'Comportement en cas de conflit',
  );
  const planningColorFieldLabel = t(
    'facilityForm.fields.planningColor',
    'Couleur dans le planning',
  );
  const capacityFieldLabel = t(
    'facilityForm.fields.capacity',
    'Capacité — équipes simultanées',
  );
  const planningColorHint = t(
    'facilityForm.hints.planningColor',
    'Elle sert à repérer l\'installation dans le planning — elle apparaît en pastille sur sa carte.',
  );
  // TEXTES-COLLECTIVITES (01/10, « ton A ») : en mairie, ce que fait la MAIRIE, au « vous » —
  // « un dirigeant valide » est faux pour une installation de la Ville, qui recoit la demande.
  const conflictModeDescription = (
    /** @type {typeof FACILITY_CONFLICT_MODE_OPTIONS[0]} */ option,
  ) => {
    if (!isCollectiviteMode) return t(option.descriptionKey, option.descriptionFallback);
    return option.value === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY
      ? t(
        'facilityForm.collectivite.conflictModes.allow.description',
        'Le créneau reste confirmé, même au-delà de la capacité : vous n’avez rien à valider.',
      )
      : t(
        'facilityForm.collectivite.conflictModes.pending.description',
        'Le créneau passe en demande : vous l’acceptez ou la refusez avant qu’il soit confirmé.',
      );
  };
  const addressGeocodeRequiredMessage = isCollectiviteMode
    ? t(
      'facilityForm.collectivite.errors.addressGeocodeRequired',
      'Sélectionnez une adresse géolocalisée dans la liste.',
    )
    : t(
      'facilityForm.errors.addressGeocodeRequired',
      'Sélectionne une adresse géolocalisée dans la liste.',
    );

  // D66 : chaque plateau a un nom, court, different des autres. Le serveur juge aussi (cycle de
  // vie de l installation, 400 FACILITY_PLATEAUX_INVALID) ; ici, on le dit avant l envoi.
  const messagePlateaux = (/** @type {string[]} */ noms) => {
    if (noms.some((nom) => !nom)) {
      return t('collectiviteCreneaux.formulaire.plateauVide', 'Nommez chaque plateau.');
    }
    if (noms.some((nom) => nom.length > PLATEAU_NOM_MAX)) {
      return t(
        'collectiviteCreneaux.formulaire.plateauLong',
        'Un nom de plateau tient en {{max}} caractères.',
        { max: PLATEAU_NOM_MAX },
      );
    }
    if (new Set(noms.map((nom) => nom.toLocaleLowerCase())).size < noms.length) {
      return t(
        'collectiviteCreneaux.formulaire.plateauDouble',
        'Deux plateaux portent le même nom.',
      );
    }
    return null;
  };

  // Allumer « Nommer les plateaux » propose « Plateau A », « Plateau B »… a renommer.
  const basculerPlateaux = (/** @type {boolean} */ allume) => {
    setValue('plateauxActifs', allume);
    clearErrors('plateaux');
    if (!allume) return;
    const deja = Array.isArray(plateaux) ? plateaux : [];
    const nombre = Math.max(2, Number(equipesALaFois) || 2);
    setValue('plateaux', Array.from({ length: nombre }, (_, index) => (
      deja[index] || t('collectiviteCreneaux.formulaire.plateauDefaut', 'Plateau {{lettre}}', {
        lettre: LETTRES_DE_PLATEAU.charAt(index),
      })
    )));
  };

  const handleSave = async (data) => {
    const facilityDocumentId = facility?.documentId || facility?.id || routedFacilityId;

    if (!isEdit && !contextClubId && !contextCmId && !isCollectiviteMode) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('facilityForm.errors.contextMissing', 'Impossible de récupérer les informations du club.'),
      );
      return;
    }

    // FINITIONS3 (29/09) : une installation posee hors de l app (base, import, demo) peut
    // n avoir aucune coordonnee. Tant que l adresse n est PAS touchee, on enregistre le reste
    // sans l exiger, et elle ne part pas : le serveur garde la sienne. Des qu on la change
    // (ou qu on la vide), la regle d avant revient. Club et collectivite : meme formulaire.
    const adresseIntacte = isEdit
      && JSON.stringify(data.address ?? null) === JSON.stringify(facility?.address ?? null);
    const normalizedAddress = normalizeAddressPayload(data.address);
    setErreurServeur(null);
    // COLL-C2B (02/10) — design P4-form, ecran 4 : en mairie, chaque erreur se dit sous son
    // champ ET se compte en haut (« 2 champs a corriger ») ; plus de fenetre systeme en double.
    // Le club garde son alerte, au mot pres.
    let refus = 0;
    if (!normalizedAddress && !adresseIntacte) {
      setError('address', {
        message: addressGeocodeRequiredMessage,
        type: 'manual',
      });
      if (!isCollectiviteMode) {
        // Le champ adresse peut etre hors ecran au moment du submit : sans alerte,
        // le bouton Creer semble ne rien faire.
        Alert.alert(
          t('common.error', 'Erreur'),
          addressGeocodeRequiredMessage,
        );
        return;
      }
      refus += 1;
    } else {
      clearErrors('address');
    }

    // Le chemin club garde exactement le corps d avant (les plateaux ne partent pas).
    const {
      address,
      plateaux: plateauxSaisis,
      plateauxActifs: plateauxAllumes,
      ...clubFields
    } = data;
    const addressField = normalizedAddress ? { address: normalizedAddress } : {};
    // D66 (contrat C2A §8) : autant de plateaux que d equipes a la fois, chacun nomme.
    const nombreDePlateaux = Number(data.maxSlots) || 1;
    const nomsDePlateaux = isCollectiviteMode && plateauxAllumes && nombreDePlateaux >= 2
      ? Array.from(
        { length: nombreDePlateaux },
        (_, index) => String((plateauxSaisis || [])[index] || '').trim(),
      )
      : null;
    if (nomsDePlateaux) {
      const refusPlateaux = messagePlateaux(nomsDePlateaux);
      if (refusPlateaux) {
        setError('plateaux', { message: refusPlateaux, type: 'manual' });
        refus += 1;
      } else {
        clearErrors('plateaux');
      }
    }
    if (refus) return;
    const formattedData = {
      ...clubFields,
      ...addressField,
      allowOverflowRequests: true,
      capacityConflictMode: data.capacityConflictMode || FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    };

    // Plateaux : les noms s ils sont allumes ; une liste VIDE pour effacer ceux d avant ; rien
    // du tout sinon (un serveur d avant C2A ne les connait pas).
    let champPlateaux = {};
    if (nomsDePlateaux) {
      champPlateaux = { plateaux: nomsDePlateaux };
    } else if (Array.isArray(facility?.plateaux) && facility.plateaux.length > 0) {
      champPlateaux = { plateaux: [] };
    }

    setLoading(true);
    try {
      if (isCollectiviteMode) {
        await saveCollectiviteInstallation.mutateAsync({
          collectiviteId,
          data: {
            ...addressField,
            capacityConflictMode: formattedData.capacityConflictMode,
            maxSlots: data.maxSlots,
            name: data.name,
            planningColor: data.planningColor,
            type: data.type,
            ...champPlateaux,
          },
          facilityId: isEdit ? facilityDocumentId : null,
        });
        navigation.goBack();
        return;
      }
      if (isEdit) {
        if (!facilityDocumentId) {
          throw new Error('Missing facility id');
        }
        await updateFacility(facilityDocumentId, formattedData);
      } else if (contextClubId) {
        await createFacility({ ...formattedData, club: contextClubId });
      } else if (contextCmId) {
        await createFacility({ ...formattedData, multisportClub: contextCmId });
      } else {
        throw new Error('No clubId or cmId provided');
      }
      navigation.goBack();
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      if (isCollectiviteMode) {
        // COLL-C2B (02/10) — design P4-form, ecran 5 : le refus se lit au-dessus du bouton.
        setErreurServeur(seasonSlotErrorMessage(t, error)
          || getErrorMessage(/** @type {any} */ (error)));
        return;
      }
      Alert.alert(
        t('common.error', 'Erreur'),
        error?.message || t(
          'facilityForm.errors.saveFailed',
          'Une erreur est survenue lors de l\'enregistrement.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  if (isEdit && facilityLoading && !facility) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Loader />
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {i18next.t('facilityForm.state.loading', 'Chargement de l installation...')}
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  if (isEdit && facilityError && !facility) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {i18next.t('facilityForm.state.loadError', 'Impossible de charger l installation')}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {facilityError?.message || (isCollectiviteMode
              ? i18next.t(
                'facilityForm.collectivite.state.retryLater',
                'Réessayez dans quelques instants.',
              )
              : i18next.t('facilityForm.state.retryLater', 'Réessaie dans quelques instants.'))}
          </Text>
          <Button
            onPress={() => refetchFacility()}
            title={i18next.t('facilityForm.state.retry', 'Réessayer')}
            variant="Primary"
          />
          <Button
            onPress={retourALaListe}
            title={i18next.t('facilityForm.state.backToList', 'Retour aux installations')}
            variant="Secondary"
          />
        </View>
      </ScreenContainer>
    );
  }

  if (isFacilityNotFound || isMissingCreateContext) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Spaces.paddingVertical[24], Alignments.fill, Alignments.justifyCenter]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {isFacilityNotFound
              ? i18next.t('facilityForm.state.notFoundTitle', 'Installation introuvable')
              : i18next.t('facilityForm.state.missingClubTitle', 'Contexte club introuvable')}
          </Text>
          <Text style={[Fonts.p2, Fonts.primary100]}>
            {isFacilityNotFound
              ? i18next.t(
                'facilityForm.state.notFoundBody',
                'Le lien est peut-être obsolète ou cette installation a été supprimée.',
              )
              : i18next.t(
                'facilityForm.state.missingClubBody',
                'Impossible de determiner pour quel club créer cette installation.',
              )}
          </Text>
          {/* COLL-C2B — design P4-form, ecran 6 : en mairie, « Retour aux installations » */}
          {/* est le geste principal ; « Reessayer » le suit. */}
          <Button
            onPress={retourALaListe}
            title={i18next.t('facilityForm.state.backToList', 'Retour aux installations')}
            variant={isCollectiviteMode ? 'Primary' : 'Secondary'}
          />
          {isFacilityNotFound ? (
            <Button
              onPress={() => refetchFacility()}
              title={i18next.t('facilityForm.state.retry', 'Réessayer')}
              variant={isCollectiviteMode ? 'Secondary' : 'Primary'}
            />
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  // COLL-C2B (02/10) — design P4-form : la mairie lit ses groupes nommes, dans l ordre ou l on
  // pense (l essentiel, ou, combien, quand c est plein, la couleur ; « quand » est parti avec les
  // horaires, VILLE-INSTALLATION 07/10), « Enregistrer » fixe en bas. Le club garde sa page
  // d avant, a l identique : memes blocs, meme ordre, memes textes.
  const blocNom = (
    <Controller
      control={control}
      name="name"
      render={({ field: { onChange, value } }) => (
        <Input
          density="compact"
          error={errors.name?.message}
          label={t('facilityForm.fields.name', 'Nom de l\'installation')}
          onChangeText={onChange}
          placeholder={t('facilityForm.placeholders.name', 'Ex: Terrain Honneur, Salle A...')}
          value={value}
        />
      )}
    />
  );

  const blocTypeDuClub = (
    <Controller
      control={control}
      name="type"
      render={({ field: { onChange, value } }) => (
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('facilityForm.fields.type', 'Type — requis')}
          </Text>
          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
            {FACILITY_TYPES.map((typeItem) => {
              const isActive = value === typeItem.value;
              return (
                <Button
                  key={typeItem.value}
                  onPress={() => onChange(typeItem.value)}
                  size="small"
                  style={[
                    TYPE_CHIP_STYLE,
                    !isActive ? { borderColor: Colors.primary200 } : null,
                  ]}
                  textStyle={!isActive ? { color: Colors.primary200 } : undefined}
                  title={typeItem.label}
                  variant={isActive ? 'Primary' : 'SecondaryLight'}
                />
              );
            })}
          </View>
          {errors.type?.message ? (
            <Text style={[Fonts.p3, Fonts.error700]}>
              {errors.type.message}
            </Text>
          ) : null}
        </View>
      )}
    />
  );

  // COLL-C2B — design P4-form, ecran 2 : en mairie, le type se choisit dans une FEUILLE, en
  // liste, chacun sur sa ligne (la pastille « Terrain de » perdait « rugby », capture C2b).
  const blocTypeDeLaVille = (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
        {t('collectiviteCreneaux.formulaire.type', 'Type')}
      </Text>
      <TouchableOpacity
        accessibilityHint={t('collectiviteCreneaux.formulaire.typeAide', 'Ouvre la liste des types')}
        accessibilityLabel={typeChoisi
          ? t('collectiviteCreneaux.formulaire.typeChoisi', 'Type : {{type}}. Changer de type', {
            type: getFacilityTypeLabel(typeChoisi),
            ...SANS_ECHAPPEMENT,
          })
          : t('collectiviteCreneaux.formulaire.typeAChoisir', 'Type : à choisir')}
        accessibilityRole="button"
        onPress={() => setFeuilleTypeOuverte(true)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[16],
          {
            borderColor: errors.type ? Colors.error500 : withAlpha(Colors.neutral00, 0.18),
            borderRadius: 14,
            borderWidth: 1,
            gap: 12,
            minHeight: 52,
          },
        ]}
      >
        {typeChoisi ? <SvgIcon color={Colors.primary200} name="stadium" /> : null}
        <Text style={[Fonts.p2, typeChoisi ? Fonts.neutral00 : Fonts.neutral400, { flex: 1 }]}>
          {typeChoisi
            ? getFacilityTypeLabel(typeChoisi)
            : t('collectiviteCreneaux.formulaire.choisirType', 'Choisir le type')}
        </Text>
        <SvgIcon color={Colors.neutral300} name="chevron-down" />
      </TouchableOpacity>
      {errors.type?.message ? (
        <Text style={[Fonts.p3, Fonts.error700]}>{errors.type.message}</Text>
      ) : null}
    </View>
  );

  const feuilleDesTypes = isCollectiviteMode ? (
    <BottomModal
      close={() => setFeuilleTypeOuverte(false)}
      isVisible={feuilleTypeOuverte}
      snapPoints={FEUILLE_TYPE_HAUTEUR}
      webPresentation="dialog"
    >
      <View style={[Spaces.paddingHorizontal[16], Spaces.paddingBottom[16], { gap: 8 }]}>
        <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
          {t('collectiviteCreneaux.formulaire.typeTitre', 'Type d’installation')}
        </Text>
        {TYPES_DE_MAIRIE.map((type) => {
          const choisi = typeChoisi === type.value;
          return (
            <TouchableOpacity
              accessibilityRole="radio"
              accessibilityState={{ checked: choisi }}
              key={type.value}
              onPress={() => {
                setValue('type', type.value);
                clearErrors('type');
                setFeuilleTypeOuverte(false);
              }}
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Spaces.paddingHorizontal[16],
                {
                  backgroundColor: withAlpha(Colors.neutral00, choisi ? 0.08 : 0.03),
                  borderColor: withAlpha(Colors.neutral00, 0.1),
                  borderRadius: 14,
                  borderWidth: 1,
                  gap: 12,
                  minHeight: 52,
                },
              ]}
              testID={`type-${type.value}`}
            >
              <SvgIcon color={Colors.primary200} name="stadium" />
              <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{type.label}</Text>
              {choisi ? <SvgIcon color={Colors.primary500} name="check" /> : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomModal>
  ) : null;

  const blocAdresse = (
    <Controller
      control={control}
      name="address"
      render={({ field: { onChange, value } }) => (
        <View style={[Spaces.gap[4]]}>
          <AutocompleteAddressInput
            address={value}
            error={errors.address?.message}
            label={t('facilityForm.fields.address', 'Adresse (lieu exact)')}
            permettreLieuSurCarte
            placeholder={t('facilityForm.placeholders.address', 'Ex: 12 Rue du Stade...')}
            setAddress={onChange}
          />
          {/* L'astuce d'aide a disparu : elle ne servait qu'a annoncer ce
              que cette ligne CONSTATE. Sans GPS, c'est le message
              d'erreur existant de l'autocomplete qui parle. */}
          {getAddressCoordinates(value) ? (
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
              {/* COLL-C2B : la coche du systeme de design (decision « aucun emoji »). */}
              {isCollectiviteMode ? (
                <SvgIcon color={Colors.success500} height={12} name="check" width={12} />
              ) : null}
              <Text style={[Fonts.small, Fonts.success500]}>
                {t('facilityForm.hints.gpsActive', 'GPS activé')}
              </Text>
            </View>
          ) : null}
        </View>
      )}
    />
  );

  const blocConflit = (
    <Controller
      control={control}
      name="capacityConflictMode"
      render={({ field: { onChange, value } }) => {
        const activeOption = getConflictModeOption(value);
        return (
          <View style={[Spaces.gap[8]]}>
            {/* COLL-C2B : en mairie, la legende du groupe tient lieu de libelle. */}
            {isCollectiviteMode ? null : (
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {conflictModeFieldLabel}
              </Text>
            )}
            {/* D63 : « Demande a valider » s'affichait « Demande a */}
            {/* valid... ». Ce sont des libelles SYSTEME — le pack les */}
            {/* veut entiers, l'ellipse est reservee aux donnees. */}
            <SegmentedControl
              centerContent
              fullLabels
              onChange={onChange}
              options={conflictModeOptions}
              value={value}
            />
            {/* Hauteur reservee : les deux explications ne font pas la */}
            {/* meme longueur, et sans plancher le formulaire sautait a */}
            {/* chaque bascule de pilule. 38 pt = 2 lignes de p3. */}
            <Text
              style={[
                Fonts.p3,
                Fonts.neutral300,
                CONFLICT_HINT_STYLE,
              ]}
            >
              {conflictModeDescription(activeOption)}
            </Text>
          </View>
        );
      }}
    />
  );

  const blocCapacite = (
    <Controller
      control={control}
      name="maxSlots"
      render={({ field: { onChange, value } }) => {
        const safeValue = Number(value || 1);
        return (
          <View style={[Spaces.gap[8]]}>
            {/* D63 : le libelle partageait la ligne des boutons, qui */}
            {/* devaient donc rester a 30 pt. Sorti au-dessus comme */}
            {/* les autres groupes de l'ecran, il rend la rangee au */}
            {/* nombre — gros, centre, son unite juste dessous. */}
            {isCollectiviteMode ? null : (
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {capacityFieldLabel}
              </Text>
            )}
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                ApplicationStyle.backgroundColor.primary900,
                ApplicationStyle.borderRadius16,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                Spaces.gap[12],
                { borderColor: `${Colors.primary500}55`, borderWidth: 1 },
              ]}
            >
              <Button
                onPress={() => onChange(Math.max(1, safeValue - 1))}
                size="small"
                style={STEPPER_BUTTON_STYLE}
                title="-"
                variant="Secondary"
              />
              <View style={[Alignments.fill]}>
                <Text
                  style={[Fonts.h4Black, Fonts.neutral00, STEPPER_VALUE_STYLE]}
                >
                  {safeValue}
                </Text>
                <Text
                  style={[Fonts.small, Fonts.neutral300, STEPPER_VALUE_STYLE]}
                >
                  {safeValue > 1
                    ? t('facilityForm.capacity.plural', 'équipes à la fois')
                    : t('facilityForm.capacity.singular', 'équipe à la fois')}
                </Text>
              </View>
              <Button
                onPress={() => onChange(Math.min(10, safeValue + 1))}
                size="small"
                style={STEPPER_BUTTON_STYLE}
                title="+"
                variant="Primary"
              />
            </View>
            {isCollectiviteMode ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'collectiviteCreneaux.formulaire.capaciteAide',
                  'Un gymnase coupé en 2 plateaux reçoit 2 équipes en même temps. Au-delà, '
                    + 'l’installation est complète.',
                )}
              </Text>
            ) : null}
            {errors.maxSlots?.message ? (
              <Text style={[Fonts.p3, Fonts.error700]}>
                {errors.maxSlots.message}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );

  // COLL-C2B — design P4v3-plateaux, ecran 1 (D66) : juste sous « equipes a la fois », un
  // interrupteur, puis un nom par plateau. Autant de plateaux que d equipes a la fois ; ne
  // rien nommer garde l installation telle qu aujourd hui. Un plateau suppose 2 equipes.
  const nombreDePlateauxAffiches = Math.max(2, Number(equipesALaFois) || 2);
  const blocPlateaux = plateauxPossibles ? (
    <View style={[Spaces.gap[12]]}>
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('collectiviteCreneaux.formulaire.plateaux', 'Nommer les plateaux')}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'collectiviteCreneaux.formulaire.plateauxAide',
              'Pour attribuer un côté précis du gymnase.',
            )}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('collectiviteCreneaux.formulaire.plateaux', 'Nommer les plateaux')}
          accessibilityRole="switch"
          onValueChange={basculerPlateaux}
          thumbColor={plateauxActifs ? Colors.primary900 : Colors.neutral300}
          trackColor={{ false: withAlpha(Colors.neutral00, 0.16), true: Colors.primary500 }}
          value={Boolean(plateauxActifs)}
        />
      </View>
      {plateauxActifs ? Array.from({ length: nombreDePlateauxAffiches }, (_, index) => (
        <Input
          density="compact"
          key={`plateau-${index + 1}`}
          label={t('collectiviteCreneaux.formulaire.plateauNumero', 'Plateau {{numero}}', {
            numero: index + 1,
          })}
          maxLength={PLATEAU_NOM_MAX}
          onChangeText={(/** @type {string} */ nom) => {
            const suivants = Array.isArray(plateaux) ? [...plateaux] : [];
            suivants[index] = nom;
            setValue('plateaux', suivants);
          }}
          value={(Array.isArray(plateaux) ? plateaux[index] : '') || ''}
        />
      )) : null}
      {plateauxActifs ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'collectiviteCreneaux.formulaire.plateauxExemple',
            'Un nom court que les clubs reconnaissent, par exemple « côté tribune ».',
          )}
        </Text>
      ) : null}
      {errors.plateaux?.message ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error700]}>
          {String(errors.plateaux.message)}
        </Text>
      ) : null}
    </View>
  ) : null;

  const blocCouleur = (
    <Controller
      control={control}
      name="planningColor"
      render={({ field: { onChange, value } }) => {
        const selectedColor = isValidFacilityPlanningColor(value)
          ? String(value).toUpperCase()
          : FACILITY_PLANNING_PALETTE[0];

        return (
          <View style={[Spaces.gap[8]]}>
            {isCollectiviteMode ? null : (
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {planningColorFieldLabel}
              </Text>
            )}
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.wrap,
                Spaces.gap[12],
              ]}
            >
              {FACILITY_PLANNING_PALETTE.map((color) => {
                const isSelected = selectedColor === color;
                return (
                  <View
                    key={color}
                    style={[
                      PLANNING_SWATCH_RING_STYLE,
                      {
                        borderColor: isSelected
                          ? Colors.neutral00
                          : Colors.transparent,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      accessibilityHint={t(
                        'facilityForm.accessibility.planningColor',
                        'Couleur de planning',
                      )}
                      accessibilityLabel={nomDeCouleur(t, color)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      activeOpacity={0.85}
                      hitSlop={PLANNING_SWATCH_HIT_SLOP}
                      onPress={() => onChange(color)}
                      style={[
                        PLANNING_SWATCH_STYLE,
                        {
                          backgroundColor: color,
                          borderColor: `${Colors.neutral00}66`,
                          borderWidth: 1,
                        },
                      ]}
                    />
                  </View>
                );
              })}
            </View>
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {isCollectiviteMode
                // COLL-C2B — design P4-form : chaque couleur dit son nom, sous la grille.
                ? t(
                  'collectiviteCreneaux.formulaire.couleurAide',
                  '{{couleur}} — sa couleur dans le planning et sur sa carte.',
                  { couleur: nomDeCouleur(t, selectedColor), ...SANS_ECHAPPEMENT },
                )
                : planningColorHint}
            </Text>
            {errors.planningColor?.message ? (
              <Text style={[Fonts.p3, Fonts.error700]}>
                {isCollectiviteMode
                  ? t(
                    'facilityForm.collectivite.errors.planningColorInvalid',
                    errors.planningColor.message,
                  )
                  : t(
                    'facilityForm.errors.planningColorInvalid',
                    errors.planningColor.message,
                  )}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );

  /**
   * Un groupe du formulaire de la Ville : sa legende, puis ses champs.
   * @param {string} legende - Le nom du groupe.
   * @param {import('react').ReactNode} contenu - Ses champs.
   * @returns {import('react').ReactElement} Le groupe.
   */
  const groupe = (legende, contenu) => (
    <View
      key={legende}
      style={[
        Spaces.gap[12],
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.03),
          borderColor: withAlpha(Colors.neutral00, 0.08),
          borderRadius: 16,
          borderWidth: 1,
        },
      ]}
    >
      <Text
        accessibilityRole="header"
        style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5, textTransform: 'uppercase' }]}
      >
        {legende}
      </Text>
      {contenu}
    </View>
  );

  // « Creer » s allume quand le nom, le type et l adresse sont la (design P4-form, ecran 3).
  const adresseRenseignee = typeof adresseSaisie === 'string'
    ? Boolean(adresseSaisie.trim())
    : Boolean(adresseSaisie);
  const peutEnvoyer = !isCollectiviteMode
    || isEdit
    || Boolean(String(nomSaisi || '').trim() && typeChoisi && adresseRenseignee);
  const nombreDErreurs = Object.keys(errors).length;

  const boutons = (
    <View style={[Spaces.gap[4]]}>
      {isCollectiviteMode && erreurServeur ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.error500]}>
          {erreurServeur}
        </Text>
      ) : null}
      <Button
        disabled={!peutEnvoyer}
        isLoading={loading}
        onPress={handleSubmit(handleSave)}
        title={isEdit
          ? t('facilityForm.actions.save', 'Enregistrer')
          : t('facilityForm.actions.create', 'Créer')}
        variant="Primary"
      />
      <Button
        onPress={() => navigation.goBack()}
        title={t('common.cancel', 'Annuler')}
        variant="Ghost"
      />
    </View>
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[16],
        Alignments.fill,
      ]}
      keyboardAvoiding
    >
      {/* 🤖 ANDROIDBAR-6 — l'évitement du clavier est celui du ScreenContainer : le décalage
          écrit à la main (0 sur Android, 100 sur iPhone) le croyait en haut de l'écran alors
          qu'il vit sous l'en-tête ⇒ 110 dp SOUS le clavier sur Android 15/16 (Pixel 9). */}
      <View style={[Alignments.fill]}>
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[12],
            Spaces.paddingHorizontal[16],
            Spaces.paddingBottom[24],
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Pas de bouton retour ici : le navigateur en pose deja un juste
              au-dessus (ce Stack.Screen est declare avec `headerTitle: ''`,
              donc un en-tete VIDE mais present, cf. PrivateNavigator et
              ClubStack). En ajouter un second faisait deux fleches empilees —
              constate a l'ecran sur emulateur le 2026-08-05. */}
          <View>
            {/* D63 : la maquette ne porte que le titre. Le sous-titre */}
            {/* (« Configure une nouvelle installation pour ton club. ») */}
            {/* redisait le titre en plus long, et poussait le premier champ */}
            {/* vers le bas. Aucune clef de fr.js perdue : facilityForm.* n y */}
            {/* figure pas, tout passait deja par les replis. */}
            <Text numberOfLines={1} style={[Fonts.h4Black, Fonts.neutral00]}>
              {isEdit
                ? t('facilityForm.title.edit', 'Modifier l\'installation')
                : t('facilityForm.title.create', 'Nouvelle installation')}
            </Text>
          </View>

          {/* COLL-C2B — design P4-form, ecran 4 : le recapitulatif des erreurs, en haut (le */}
          {/* champ fautif peut etre hors de l ecran) ; il remplace la fenetre systeme. */}
          {isCollectiviteMode && nombreDErreurs > 0 ? (
            <View
              accessibilityRole="alert"
              style={[
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[12],
                {
                  backgroundColor: withAlpha(Colors.error500, 0.12),
                  borderColor: withAlpha(Colors.error500, 0.45),
                  borderRadius: 14,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('collectiviteCreneaux.formulaire.aCorriger', {
                  count: nombreDErreurs,
                  defaultValue_one: '{{count}} champ à corriger',
                  defaultValue_other: '{{count}} champs à corriger',
                })}
              </Text>
            </View>
          ) : null}

          {/* D63 : ce conteneur etait une CARTE (fond, bordure, rayon 24) qui */}
          {/* enfermait tout le formulaire. Or la rangee de capacite porte deja */}
          {/* sa propre bordure : ca faisait une carte dans une carte, que le */}
          {/* pack interdit. Il ne reste que le groupe d'espacement — la */}
          {/* marge laterale est passee sur le defilement, ou elle aligne */}
          {/* AUSSI le titre, qui vivait dehors et collait au bord. */}
          <View
            style={[
              Spaces.gap[16],
            ]}
          >
            {isCollectiviteMode ? [
              groupe(
                t('collectiviteCreneaux.formulaire.essentiel', 'L’essentiel'), (
                  <>
                    {blocNom}
                    {blocTypeDeLaVille}
                  </>
                ),
              ),
              groupe(t('collectiviteCreneaux.formulaire.ou', 'Où'), blocAdresse),
              // VILLE-INSTALLATION (07/10) : le groupe « Quand » (Ouverture / Fermeture) est parti.
              groupe(
                t('collectiviteCreneaux.formulaire.combien', 'Combien d’équipes à la fois'), (
                  <>
                    {blocCapacite}
                    {blocPlateaux}
                  </>
                ),
              ),
              groupe(t('collectiviteCreneaux.formulaire.plein', 'Quand c’est plein'), blocConflit),
              groupe(planningColorFieldLabel, blocCouleur),
            ] : (
              <>
                {blocNom}
                {blocTypeDuClub}
                {blocAdresse}
                {blocConflit}
                {blocCapacite}
                {blocCouleur}
              </>
            )}
          </View>

          {/* D51 : l'apercu qui repetait nom, capacite, type, mode de conflit */}
          {/* et adresse a ete retire. Chaque reglage annonce son propre etat */}
          {/* juste au-dessus ; le redire en bas ne faisait qu'allonger la page. */}

          {isCollectiviteMode ? null : boutons}
        </ScrollView>
        {/* COLL-C2B — design P4-form : en mairie, « Enregistrer » reste fixe en bas. */}
        {isCollectiviteMode ? (
          <View
            style={[
              Spaces.paddingHorizontal[16],
              Spaces.paddingTop[8],
              { borderTopColor: withAlpha(Colors.neutral00, 0.08), borderTopWidth: 1 },
            ]}
          >
            {boutons}
          </View>
        ) : null}
      </View>

      {feuilleDesTypes}

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={contextClubId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

export default FacilityForm;
