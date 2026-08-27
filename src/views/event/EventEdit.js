// @ts-nocheck
import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parse } from 'date-fns';
import Joi from 'joi';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useEvent from '@/domains/event/useEvent';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import DayPicker from '@/components/molecules/dayPicker/DayPicker';
import Input from '@/components/molecules/input/Input';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import FacilitySelector from '@/components/organisms/facilitySelector/FacilitySelector';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useGetEventForEdit,
  useGetEventTypes,
} from '@/services/event/eventQueries';
import { createEvent, updateEvent } from '@/services/event/eventService';
import { getTeams } from '@/services/team/teamService';

import { getApiErrorTranslation } from '@/utils/errors/displayError';
import { getFieldError } from '@/utils/form/formUtils';
import safeJsonParse from '@/utils/safeJsonParse';

import EventTasksEditor from './components/EventTasksEditor';
import EventTeamAudiencesEditor from './components/EventTeamAudiencesEditor';

// R5 (b) — LES EQUIPES DU CLUB SONT RELUES AU PLUS UNE FOIS PAR MINUTE.
// Elles ne changent pas d'une ouverture de l'ecran a l'autre, et elles etaient
// redemandees a CHAQUE montage par un appel imperatif, hors du cache. Une
// minute suffit a couvrir un aller-retour fiche → modification → fiche ; au-dela
// on relit, pour qu'une equipe creee a l'instant finisse par apparaitre.
const CLUB_TEAMS_STALE_MS = 60_000;

// La MEME liste vide a chaque rendu : un `[]` litteral en valeur par defaut
// changerait d identite a chaque passage et ferait recalculer pour rien les
// deux `useMemo` qui en dependent (`manageableTeams`, `invitedTeamOptions`).
/** @type {any[]} */
const AUCUNE_EQUIPE = [];

/** @typedef {import('@/domains/event/types').FCEventForm} FCEventForm */
/** @typedef {import('@/domains/team/types').Team} Team */

const defaultValues = {
  capacity: null,
  date: '',
  description: '',
  endTime: '',
  eventTasks: [],
  externalParticipantLimit: null,
  externalParticipantValidationMode: 'manual',
  facility: null,
  invitedTeams: /** @type {string[]} */ ([]),
  isRecurrent: false,
  location: undefined,
  participantIdentityVisibility: 'VISIBLE',
  pricePerPerson: null,
  recurrenceDay: '',
  recurrenceDays: /** @type {number[]} */ ([]),
  recurrenceEndDate: '',
  recurrenceFrequency: 'week',
  recurrenceInterval: 1,
  recurrenceStartDate: '',
  reservationMode: 'FULL_GROUP',
  sessionStatus: 'open',
  startTime: '',
  team: undefined,
  teamAudiences: [],
  totalPlayers: null,
  type: undefined,
  validationMode: 'auto',
};

// 🗣️ D8 — CHAQUE CHAMP SAIT DIRE SON NOM, AVEC LES MOTS DE L'ECRAN.
//
// Une erreur de saisie ouvrait une fenetre contenant le JSON brut de la
// bibliotheque de formulaire : `{"date":{"type":"required","message":…}}`.
// Illisible, et surtout : ca ne disait pas QUOI corriger.
//
// 📖 Chaque entree est `[clef, repli]`. La clef est CELLE QUE L'ECRAN UTILISE
// DEJA pour etiqueter le champ — c'est tout l'interet : le message nomme le
// champ avec les memes mots que ceux ecrits juste au-dessus de la case. Le
// repli n'est renseigne que pour les champs absents de `fr.js`, pour qu'aucun
// message ne puisse rendre une clef technique.
const LIBELLES_DES_CHAMPS = /** @type {Record<string, [string, string?]>} */ ({
  capacity: ['eventEdit.fields.capacity.label'],
  date: ['eventEdit.fields.date.label'],
  description: ['eventEdit.fields.description.label'],
  endTime: ['eventEdit.fields.endTime.label'],
  eventTasks: ['eventEdit.fields.eventTasks.label', 'Tâches'],
  externalParticipantLimit: ['eventEdit.trainingOpen.externalLimitLabel', 'Places externes'],
  externalParticipantValidationMode: ['eventEdit.fields.validationMode.label'],
  facility: ['eventEdit.fields.location.label'],
  invitedTeams: ['eventEdit.fields.invitedTeams.label'],
  isRecurrent: ['eventEdit.fields.isRecurrent.label'],
  location: ['eventEdit.fields.location.label'],
  participantIdentityVisibility: [
    'eventEdit.fields.participantIdentityVisibility.label',
    'Identités des participants',
  ],
  pricePerPerson: ['eventEdit.fields.pricePerPerson.label'],
  recurrenceDay: ['eventEdit.fields.recurrenceDay.label'],
  recurrenceDays: ['eventEdit.fields.recurrenceDay.label'],
  recurrenceEndDate: ['eventEdit.fields.recurrenceEndDate.label'],
  recurrenceFrequency: ['eventEdit.fields.recurrenceFrequency.label'],
  recurrenceInterval: ['eventEdit.fields.recurrenceFrequency.label'],
  recurrenceStartDate: ['eventEdit.fields.recurrenceStartDate.label'],
  reservationMode: ['eventEdit.fields.sessionStatus.label'],
  sessionStatus: ['eventEdit.fields.sessionStatus.label'],
  startTime: ['eventEdit.fields.startTime.label'],
  team: ['eventEdit.fields.team.label'],
  teamAudiences: ['eventEdit.fields.teamAudiences.label', 'Équipes conviées'],
  totalPlayers: ['eventEdit.fields.totalPlayers.label'],
  type: ['eventEdit.fields.type.label'],
  validationMode: ['eventEdit.fields.validationMode.label'],
});

/**
 * La phrase a montrer quand le formulaire refuse de partir.
 *
 * ⛔ Ce qui disparait : les accolades, les guillemets, et le vocabulaire de la
 * bibliotheque (`type`, `ref`, `message`). ✅ Ce qui apparait : le nom du champ,
 * tel qu'il est ecrit a l'ecran.
 *
 * Un champ inconnu de la table sort sous son nom technique plutot que d'etre
 * tu : mieux vaut un mot etrange qu'un message qui ne dit rien.
 * @param {Record<string, any>} errors - Les erreurs rendues par le formulaire.
 * @param {(clef: string, repli?: string) => string} traduire - Le `t` de l'ecran.
 * @returns {string} - Une phrase, jamais du JSON.
 */
const decrireLesChampsFautifs = (errors, traduire) => {
  const noms = Object.keys(errors || {}).map((champ) => {
    const entree = LIBELLES_DES_CHAMPS[champ];
    return entree ? traduire(entree[0], entree[1]) : champ;
  });

  if (noms.length === 0) {
    return 'Vérifie ta saisie avant d\'enregistrer.';
  }
  if (noms.length === 1) {
    return `Vérifie le champ « ${noms[0]} », puis appuie de nouveau sur Enregistrer.`;
  }
  return `Vérifie ces champs : ${noms.join(', ')}.`;
};

const buildOccupancyWindow = (dateValue, startTime, endTime, getDateFromDateInput) => {
  if (!dateValue || !startTime || !endTime || typeof getDateFromDateInput !== 'function') {
    return null;
  }

  const baseDate = getDateFromDateInput(dateValue);
  if (!baseDate || Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const toIso = (timeValue) => {
    const [hours, minutes] = String(timeValue || '').split(':').map((part) => Number(part));
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
    const combined = new Date(baseDate);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const start = toIso(startTime);
  const end = toIso(endTime);
  if (!start || !end) return null;

  return { end, start };
};

const getEventLocationLabel = (locationDetails) => {
  const parsed = safeJsonParse(locationDetails, null);
  const address = parsed?.address;
  if (typeof address === 'object') {
    return String(address?.description || address?.label || '').trim();
  }
  return String(address || '').trim();
};

const DATE_INPUT_FORMAT = 'dd/MM/yyyy';

const toDateInputText = (dateValue) => format(dateValue, DATE_INPUT_FORMAT);

const mergeDateInput = (text, fallbackDate) => {
  const parsed = parse(text, DATE_INPUT_FORMAT, fallbackDate);
  return isValid(parsed) ? parsed : fallbackDate;
};

const clampDateToToday = (value) => {
  const normalizedDate = value instanceof Date && !Number.isNaN(value.getTime()) ? new Date(value) : new Date();
  normalizedDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return normalizedDate < today ? today : normalizedDate;
};

const eventSchema = Joi.object({
  capacity: Joi.number().allow(null, '').optional(),
  date: Joi.string()
    .pattern(/^(\d{2}\/\d{2}\/\d{4})?$/)
    .allow('')
    .optional()
    .custom((value, helpers) => {
      if (!value) return value;
      const parts = value.split('/');
      if (parts.length !== 3) return value;
      const year = parseInt(parts[2], 10);
      // Vérifier que l'année est raisonnable (entre 2020 et 2100)
      if (year < 2020 || year > 2100) {
        return helpers.error('date.invalidYear');
      }
      return value;
    })
    .messages({
      'date.invalidYear': 'L\'année doit être entre 2020 et 2100',
    }),
  description: Joi.string().allow('').optional(),
  documentId: Joi.string().allow(null, '').optional(),
  endTime: Joi.string().pattern(/^(\d{2}:\d{2})?$/).allow('').optional(),
  eventTasks: Joi.array().items(Joi.object().unknown(true)).optional(),
  externalParticipantLimit: Joi.number().allow(null, '').optional(),
  externalParticipantValidationMode: Joi.string().valid('auto', 'manual').allow(null, '').optional(),
  facility: Joi.string().allow(null, '').optional(),
  invitedTeams: Joi.array().items(Joi.string()).optional(),
  isRecurrent: Joi.boolean().required(),
  location: Joi.object().allow(null, '').optional(),
  participantIdentityVisibility: Joi.string().valid('VISIBLE', 'ANONYMIZED').required(),
  pricePerPerson: Joi.number().allow(null, '').optional(),
  recurrenceDay: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().allow('').optional(),
  }),
  recurrenceDays: Joi.array().items(Joi.number()).optional(),
  recurrenceEndDate: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).required(),
  }),
  recurrenceFrequency: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().valid('week', 'month').required(),
  }),
  recurrenceInterval: Joi.number().min(1).optional(),
  recurrenceStartDate: Joi.when('isRecurrent', {
    is: true,
    otherwise: Joi.string().allow('').optional(),
    then: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).required(),
  }),
  reservationMode: Joi.string().valid('FULL_GROUP', 'RECRUITING').optional(),
  sessionStatus: Joi.string().valid('open', 'closed').required(),
  startTime: Joi.string().pattern(/^(\d{2}:\d{2})?$/).required(),
  team: Joi.string().required(),
  teamAudiences: Joi.array().items(Joi.object().unknown(true)).optional(),
  totalPlayers: Joi.number().allow(null, '').optional(),
  type: Joi.string().required(),
  validationMode: Joi.string().valid('auto', 'manual').required(),
}).unknown(true);

/**
 * EventEdit component for creating and editing events
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} EventEdit component
 */
function EventEdit({ navigation, route }) {
  const { eventId } = route?.params || {};
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const { data: event } = useGetEventForEdit(eventId);
  // R5 (b) — LA LISTE DES TYPES NE SE RECHARGE PLUS A CHAQUE OUVERTURE.
  // C est une table de reference (Match, Entrainement, Reservation...) : elle ne
  // bouge pas de la vie de l application. Sans duree de fraicheur, react-query
  // la considerait perimee des sa reception et repartait au reseau a CHAQUE
  // montage — y compris quand la fiche venait de la precharger.
  const { data: eventTypes } = useGetEventTypes({ staleTime: Infinity });
  const {
    createEventUpdatePayload,
    createReccurrentEventPayload,
    formatDateInput,
    formatTimeInput,
    getDateFromDateInput,
    getEventEditSupport,
    getReccurrenceDayOptions,
    hasExternalAudience,
    isTrainingEventType,
    recurrenceFrequencyOptions,
    resolveTrainingOpenConfig,
    sessionStatusOptions,
    validationModeOptions,
  } = useEvent();
  const initialTrainingOpenConfig = useMemo(
    () => resolveTrainingOpenConfig(event || {}),
    [event, resolveTrainingOpenConfig],
  );

  const isClubManager = userData?.role?.name === USER_ROLES.president;

  const eventTypeOptions = eventTypes?.map((type) => ({
    label: type.name,
    value: type.documentId,
  })) || [];
  const participantIdentityVisibilityOptions = [
    {
      label: t('eventEdit.fields.participantIdentityVisibility.options.visible', 'Identités visibles'),
      value: 'VISIBLE',
    },
    {
      label: t('eventEdit.fields.participantIdentityVisibility.options.anonymized', 'Participants anonymisés'),
      value: 'ANONYMIZED',
    },
  ];
  const [selectedOccupancy, setSelectedOccupancy] = useState(null);

  const queryClient = useQueryClient();

  /**
   * Dit a l'ecran que l'enregistrement n'est pas passe.
   *
   * 🔴 D1 — LE DEFAUT LE PLUS VISIBLE DU DOSSIER, ET C'ETAIT UN SILENCE. Le
   * `onError` des deux mutations ne faisait qu'un `console.error`, et le
   * `catch` de la soumission portait un commentaire affirmant que « les
   * mutations gerent ». Elles ne geraient pas : le rond de chargement
   * s'eteignait, l'ecran restait sur le formulaire, et rien ne disait si
   * c'etait passe. C'est exactement la sensation « c'est bugue ».
   *
   * 📍 UN SEUL ENDROIT, ET C'EST VOULU : pose dans le `onError` des mutations,
   * ce message couvre TOUS les chemins d'echec — y compris celui du recurrent
   * (D2), qui part du `onPress` d'une alerte et n'a jamais eu de `catch`.
   * L'afficher aussi ailleurs ouvrirait deux fenetres pour un seul echec.
   *
   * ⛔ Aucune navigation ici : la personne RESTE sur son formulaire, avec ses
   * saisies. C'est la moitie du remede qui evite de refaire le travail.
   * @param {any} error - L'erreur rendue par la mutation.
   * @returns {void}
   */
  const signalerEchecEnregistrement = (error) => {
    console.error('Echec de l enregistrement de l evenement:', error);
    const motifDuServeur = getApiErrorTranslation(error);
    Alert.alert(
      t('eventEdit.modals.saveFailed.title', "L'enregistrement n'est pas passé"),
      [
        motifDuServeur || t(
          'eventEdit.modals.saveFailed.reason',
          'Ça n\'a pas marché. Vérifie ta connexion, puis appuie de nouveau sur Enregistrer.',
        ),
        t(
          'eventEdit.modals.saveFailed.keepsInput',
          "Tes saisies sont toujours à l'écran : rien n'est perdu.",
        ),
      ].join('\n\n'),
    );
  };

  /**
   * Marque comme perimees les listes que cet enregistrement vient de changer.
   *
   * 🥇 R1 — ON LANCE, ON N'ATTEND PAS. C'est le plus gros gain de tout l'audit,
   * pour trois lignes. Ces trois clefs sont des PREFIXES : elles touchent la
   * liste principale, les listes « a la une », le planning personnel, la fiche
   * en dessous, et toutes les listes d'evenements deja visitees — rien ne se
   * demonte dans cette application (`unmountOnBlur`, `freezeOnBlur`,
   * `detachInactiveScreens` : ZERO occurrence dans tout `src`, verifie), donc
   * tout ce qui a ete ouvert reste actif et se recharge. L'ecran attendait ces
   * 5 a 9 rechargements avant de rendre la main : le rond tournait pendant
   * toute la vague, et la navigation venait derriere.
   *
   * ✅ ET ON NE PERD RIEN. `invalidateQueries` marque de facon SYNCHRONE ; seul
   * le rechargement est asynchrone, et le `queryClient` est un singleton qui
   * survit au demontage de cet ecran. Ce n'est pas une deduction : le depot
   * l'ecrit deja pour lui-meme dans `domains/refresh/afterAction.js`, dont les
   * sept sites d'appel font tous « lance et oublie », avec la mesure du 07/08
   * a l'appui — 205 ms d'attente pure, jusqu'a 1,8 s sur reseau reel.
   *
   * ⛔ AUCUNE INVALIDATION N'EST RETIREE, et les deux prefixes larges le
   * restent pour une raison nommee :
   *   · `['events']` est la SEULE qui rafraichit l'onglet Planning, la
   *     recherche d'evenements, la fiche equipe et le selecteur en conversation ;
   *   · `['planning']` LARGE est exigee par le planning plein ecran, qui lit
   *     quatre clefs distinctes sous ce prefixe.
   * Les resserrer casserait la fraicheur pour de vrai.
   *
   * 🎯 R2 — LA SEULE QUI SE RESSERRE, ET LA MESURE LE DIT : `['event']` nu est
   * le SEUL de tout `src` (grep : une occurrence, celle-ci). Les vingt autres
   * sites du depot ecrivent `['event', eventId]`. En prefixe nu, enregistrer un
   * seul evenement perimait la fiche de TOUS ceux deja consultes — chacune se
   * rechargeant ensuite pour elle-meme.
   *
   * ⛔ A la CREATION il n'y a pas encore d'identifiant : on garde alors le
   * prefixe large, exactement comme avant. Rien ne change de ce cote.
   * @returns {void}
   */
  const invalidateEventQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] });
    queryClient.invalidateQueries({ queryKey: ['planning'] });
    queryClient.invalidateQueries({ queryKey: eventId ? ['event', eventId] : ['event'] });
  };

  const createEventMutation = useMutation({
    mutationFn: createEvent,
    onError: signalerEchecEnregistrement,
    onSuccess: invalidateEventQueries,
  });

  const updateEventMutation = useMutation({
    mutationFn: updateEvent,
    onError: signalerEchecEnregistrement,
    onSuccess: invalidateEventQueries,
  });

  let initialDateValue = '';
  if (event?.date) {
    initialDateValue = format(new Date(event.date), 'dd/MM/yyyy');
  } else if (route.params?.date) {
    initialDateValue = format(new Date(route.params.date), 'dd/MM/yyyy');
  }

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    setFocus,
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      capacity: event?.capacity,
      date: initialDateValue,
      description: event?.description || '',
      endTime: event?.endTime ? event.endTime.substring(0, 5) : '',
      eventTasks: Array.isArray(event?.eventTasks) ? event.eventTasks : [],
      externalParticipantLimit: initialTrainingOpenConfig.externalParticipantLimit,
      externalParticipantValidationMode: initialTrainingOpenConfig.externalParticipantValidationMode || 'manual',
      facility: event?.facility?.documentId || null,
      invitedTeams: event?.invitedTeams?.map(
        (/** @type {Team} */ invitedTeam) => invitedTeam.documentId || '',
      ) || [],
      location: {
        label: getEventLocationLabel(event?.locationDetails),
        value: `${event?.location?.lat}|${event?.location?.lng}`,
      },
      participantIdentityVisibility: event?.participantIdentityVisibility || 'VISIBLE',
      pricePerPerson: event?.pricePerPerson,
      reservationMode: event?.reservationMode || 'FULL_GROUP',
      sessionStatus: event?.sessionStatus || 'open',
      startTime: event?.startTime ? event.startTime.substring(0, 5) : '',
      team: event?.team?.documentId || '',
      teamAudiences: Array.isArray(event?.teamAudiences) ? event.teamAudiences : [],
      totalPlayers: event?.totalPlayers,
      type: event?.type?.documentId || '',
      validationMode: event?.validationMode || 'auto',
    },
    mode: 'onBlur',
    resolver: joiResolver(eventSchema),
    shouldFocusError: false,
  });

  const recurrenceFrequency = watch('recurrenceFrequency');
  const selectedType = watch('type');
  const selectedTeamId = watch('team');
  const selectedDate = watch('date');
  const selectedStartTime = watch('startTime');
  const selectedEndTime = watch('endTime');
  const selectedSessionStatus = watch('sessionStatus');
  const selectedFacilityId = watch('facility');
  const isRecurrent = watch('isRecurrent');
  const occupancyWindow = useMemo(
    () => buildOccupancyWindow(selectedDate, selectedStartTime, selectedEndTime, getDateFromDateInput),
    [getDateFromDateInput, selectedDate, selectedEndTime, selectedStartTime],
  );
  const selectedTypeData = useMemo(
    () => eventTypes?.find((eventType) => eventType.documentId === selectedType) || event?.type || null,
    [event?.type, eventTypes, selectedType],
  );
  const isTrainingType = useMemo(
    () => isTrainingEventType(selectedTypeData?.name),
    [isTrainingEventType, selectedTypeData?.name],
  );
  const isOpenTrainingType = isTrainingType && selectedSessionStatus !== 'closed';

  // R8 (D1) — UN REGLAGE QUI NE COMMANDE PERSONNE NE SE PROPOSE PAS.
  //
  // Sur un evenement prive, tout le monde est convie : `validationMode` ne
  // filtre plus personne (AA01, GO Adel du 2026-08-20 — le serveur accepte
  // d'office un membre convie, et refuse d'emblee qui ne l'est pas). Le
  // proposer quand meme laissait croire qu'on pouvait filtrer ses propres
  // membres, et c'est le retour de recette de la 2.6.26.
  const showValidationField = hasExternalAudience({ sessionStatus: selectedSessionStatus });

  // S11 (vague S) — REGLE CORRIGEE PAR ADEL LE 2026-08-25.
  //
  // R8 avait renomme ce champ « Validation des demandes exterieures » : c'etait
  // vrai alors, ca ne l'est plus. Le serveur met desormais TOUTE demande venue
  // du dehors en attente, sur ses trois portes d'entree. Ce reglage ne commande
  // donc plus que les MEMBRES des equipes conviees — pour qui rien ne change.
  const validationModeLabel = isTrainingType
    ? t('eventEdit.fields.trainingValidationMode.label', 'Validation des membres internes')
    : t('eventEdit.fields.validationMode.label', 'Validation des membres');
  const editSupport = useMemo(
    () => getEventEditSupport(event, selectedTypeData?.name),
    [event, getEventEditSupport, selectedTypeData?.name],
  );

  // 🛡️ D5 — TANT QUE LA FICHE N'EST PAS ARRIVEE, ON N'ENREGISTRE PAS.
  //
  // Le formulaire nait AVANT sa donnee : `useForm` s'execute au premier rendu,
  // quand `event` vaut encore `undefined`, et le `reset` qui le remplit
  // n'arrive qu'apres la reponse reseau. Entre les deux, l'ecran est affiche,
  // complet, et pre-rempli A VIDE.
  //
  // 🧨 CE QUE ENREGISTRER LA DETRUIT, et ce n'est pas une hypothese — c'est la
  // charge mesuree par le temoin : `eventTasks: []`, `teamAudiences: []`,
  // `invitedTeams: []`, `facility: null`, et `sessionStatus` retombe sur
  // « ouvert ». Cote serveur, une liste vide n'est pas ignoree, elle est
  // SYNCHRONISEE : les taches et leurs affectations sont supprimees, les
  // audiences annulees, les equipes conviees deconnectees puis leurs reponses
  // archivees — et un evenement prive devient public.
  //
  // ⛔ La condition porte sur `eventId` : a la CREATION il n'y a aucune fiche
  // a attendre, et le bouton doit rester actif.
  const ficheEnAttente = Boolean(eventId) && !event;

  useEffect(() => {
    if (isRecurrent && selectedDate) {
      const parsedDate = getDateFromDateInput(selectedDate);
      if (parsedDate) {
        if (recurrenceFrequency === 'week') {
          // Auto-select day of week (0=Sun, 1=Mon, ...)
          const dayIndex = parsedDate.getDay();
          setValue('recurrenceDays', [dayIndex]);
        } else if (recurrenceFrequency === 'month') {
          const dayOfMonth = parsedDate.getDate();
          setValue('recurrenceDay', dayOfMonth.toString());
        }
      }
    }
  }, [selectedDate, isRecurrent, recurrenceFrequency, setValue, getDateFromDateInput]);

  const trainedTeams = useMemo(
    () => (Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    [userData?.trainedTeams],
  );

  // Derive clubId from selected team or user's club (for Dirigeant)
  const initialSelectedTeam = trainedTeams.find((/** @type {Team} */ teamItem) => teamItem.documentId === selectedTeamId)
    || event?.team
    || null;
  const clubId = initialSelectedTeam?.club?.documentId || userData?.club?.documentId;
  const cmId = initialSelectedTeam?.club?.parentMultisport?.documentId || userData?.club?.parentMultisport?.documentId;

  // Fetch club teams for invited teams selection
  // R5 (b) — CET APPEL VIVAIT HORS DU CACHE, DONC IL REPARTAIT A CHAQUE
  // MONTAGE. Meme charge, meme parametres, meme resultat : seul le rangement
  // change. Ce qui se perd au passage, ce sont deux `console.log` par ouverture
  // et une lecture reseau par aller-retour.
  // ⛔ La clef est `club-teams`, PAS `teams` : `useGetTeams` (`teamQueries.js`)
  // occupe deja `teams` avec une requete PAGINEE, et deux natures de requete
  // sous une meme clef se corrompent mutuellement.
  const { data: clubTeams = AUCUNE_EQUIPE } = useQuery({
    enabled: Boolean(clubId),
    queryFn: async () => {
      const response = await getTeams({ clubId, pageSize: 100 });
      return response.data || [];
    },
    queryKey: ['club-teams', clubId],
    staleTime: CLUB_TEAMS_STALE_MS,
  });

  const manageableTeams = useMemo(() => {
    if (isClubManager && clubTeams.length > 0) {
      return clubTeams;
    }

    return trainedTeams;
  }, [clubTeams, isClubManager, trainedTeams]);

  const teamOptions = manageableTeams.map((team) => ({
    label: team.name,
    value: team.documentId || '',
  }));

  // Construct invited team options with headers
  const invitedTeamOptions = useMemo(() => {
    const myTeamsOptions = teamOptions.filter((teamOption) => teamOption.value !== selectedTeamId);

    // Filter other teams (exclude my teams and selected team)
    const myTeamIds = trainedTeams.map((teamItem) => teamItem.documentId);
    const otherTeamsOptions = clubTeams
      .filter((teamItem) => !myTeamIds.includes(teamItem.documentId) && teamItem.documentId !== selectedTeamId)
      .map((teamItem) => ({ label: teamItem.name, value: teamItem.documentId }));

    const finalOptions = [];

    if (myTeamsOptions.length > 0) {
      finalOptions.push({ isHeader: true, label: t('eventEdit.fields.invitedTeams.myTeams') || 'MES ÉQUIPES', value: 'header_my_teams' });
      finalOptions.push(...myTeamsOptions);
    }

    if (otherTeamsOptions.length > 0) {
      finalOptions.push({ isHeader: true, label: t('eventEdit.fields.invitedTeams.otherTeams') || 'AUTRES ÉQUIPES', value: 'header_other_teams' });
      finalOptions.push(...otherTeamsOptions);
    }

    return finalOptions;
  }, [teamOptions, selectedTeamId, clubTeams, trainedTeams, t]);

  const requiresFacilityApproval = Boolean(
    selectedFacilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.requiresApproval,
  );
  const allowsImmediateFacilityConflict = Boolean(
    selectedFacilityId
    && selectedOccupancy?.saturated
    && selectedOccupancy?.allowsImmediateConfirmation,
  );

  // Déterminer si le type sélectionné est "Réservation"
  const isReservationType = useMemo(
    () => selectedTypeData?.name === 'Réservation',
    [selectedTypeData?.name],
  );

  // Reset form when event data is loaded
  useEffect(() => {
    if (event) {
      console.log('Event data loaded:', event);
      console.log('Récurrence Group ID:', event.recurrenceGroupId);
      reset({
        ...defaultValues,
        capacity: event?.capacity,
        date: event?.date ? format(new Date(event?.date), 'dd/MM/yyyy') : '',
        description: event?.description || '',
        endTime: event?.endTime ? event.endTime.substring(0, 5) : '',
        eventTasks: Array.isArray(event?.eventTasks) ? event.eventTasks : [],
        externalParticipantLimit: resolveTrainingOpenConfig(event).externalParticipantLimit,
        externalParticipantValidationMode: resolveTrainingOpenConfig(event).externalParticipantValidationMode || 'manual',
        facility: event?.facility?.documentId || null,
        invitedTeams: event?.invitedTeams?.map(
          (/** @type {Team} */ invitedTeam) => invitedTeam.documentId || '',
        ) || [],
        location: {
          label: getEventLocationLabel(event?.locationDetails),
          value: `${event?.location?.lat}|${event?.location?.lng}`,
        },
        participantIdentityVisibility: event?.participantIdentityVisibility || 'VISIBLE',
        pricePerPerson: event?.pricePerPerson,
        reservationMode: event?.reservationMode || 'FULL_GROUP',
        sessionStatus: event?.sessionStatus || 'open',
        startTime: event?.startTime ? event.startTime.substring(0, 5) : '',
        team: event?.team?.documentId || '',
        teamAudiences: Array.isArray(event?.teamAudiences) ? event.teamAudiences : [],
        totalPlayers: event?.totalPlayers,
        type: event?.type?.documentId || '',
        validationMode: event?.validationMode || 'auto',
      });
    }
  }, [event, reset, resolveTrainingOpenConfig]);

  // Set navigation options to change the header title based on whether editing or creating
  useEffect(() => {
    navigation.setOptions({
      headerTitle: eventId
        ? t('eventEdit.titleEdit')
        : t('eventEdit.title'),
    });
  }, [navigation, eventId, t]);

  /**
   * Handle form submit
   * @param {FCEventForm} data
   * @returns {Promise<void>}
   */
  /**
   * Handle form submit
   * @param {FCEventForm} data
   * @returns {Promise<void>}
   */
  const handleFormSubmit = async (data) => {
    try {
      // 🛡️ D5 — LA GARDE QUI PROTEGE LA DONNEE. Le `disabled` du bouton est la
      // moitie visible ; celle-ci est celle qui tient quel que soit le chemin
      // par lequel la soumission arrive.
      if (ficheEnAttente) {
        Alert.alert(
          t('eventEdit.modals.stillLoading.title', 'La fiche n\'est pas encore chargée'),
          t(
            'eventEdit.modals.stillLoading.description',
            "Laisse l'événement finir de s'afficher : enregistrer maintenant "
            + 'effacerait ses tâches, ses équipes conviées et son lieu.',
          ),
        );
        return;
      }

      if (eventId && !editSupport?.isSupported) {
        Alert.alert(
          t('eventEdit.modals.unsupportedEdit.title', 'Modification limitée'),
          editSupport?.reason || "Cette fiche ne permet pas encore d'éditer ce type d'événement.",
        );
        return;
      }

      if (isTrainingType && data.sessionStatus !== 'closed') {
        const externalParticipantLimit = Number(data.externalParticipantLimit || 0);
        if (!Number.isFinite(externalParticipantLimit) || externalParticipantLimit < 1) {
          Alert.alert(
            t('common.error', 'Erreur'),
            t(
              'eventEdit.trainingOpen.externalLimitRequired',
              'Indique combien de places externes tu ouvres pour cet entraînement.',
            ),
          );
          return;
        }
      }

      console.log('Form submitted with data:', data);
      const payloadData = {
        ...data,
        totalPlayers: isTrainingType && data.sessionStatus !== 'closed' ? null : data.totalPlayers,
        typeName: selectedTypeData?.name || event?.type?.name || '',
      };
      const normalizedEvents = eventId
        ? [createEventUpdatePayload(payloadData)]
        : createReccurrentEventPayload(payloadData);
      console.log('Formatted events:', normalizedEvents);

      if (eventId) {
        // Mise à jour d'un événement existant
        // 🔴 D2 — LE CHEMIN QUI N'AVAIT AUCUN `catch`, ET IL EST INVISIBLE A LA
        // RELECTURE. Sur un evenement recurrent, l'envoi ne part pas d'ici : il
        // part du `onPress` de l'alerte ouverte juste en dessous. Ce `onPress`
        // est rappele PLUS TARD, par le systeme — donc HORS du `try` qui
        // entoure cette fonction. Une promesse rejetee la n'avait personne pour
        // l'attraper : rejet non traite, et STRICTEMENT RIEN a l'ecran.
        //
        // 🔑 LE `catch` REVIENT DANS LA FONCTION ELLE-MEME, pas chez chacun de
        // ses quatre appelants : le chemin qui capte est ainsi le meme qu'on
        // l'appelle avec `await` (evenement simple) ou depuis un bouton
        // d'alerte (les trois portees). Le message, lui, est deja affiche par
        // le `onError` de la mutation (D1) — un seul endroit, une seule fenetre.
        const updateEventWithMode = async (/** @type {'future' | 'all'} */ recurrenceMode) => {
          try {
            await updateEventMutation.mutateAsync({
              documentId: eventId,
              eventData: normalizedEvents[0],
              recurrenceMode,
            });
          } catch {
            // ⛔ On ne navigue pas, et on ne reparle pas : `onError` vient de le
            // dire. La personne reste sur son formulaire, avec ses saisies.
            return;
          }
          navigation.replace(RouteNames.EventDetails, { eventId });
        };

        if (event?.recurrenceGroupId) {
          const originalDate = event?.date ? format(new Date(event.date), 'dd/MM/yyyy') : '';
          const recurrenceScopeHint = originalDate && data?.date && data.date !== originalDate
            ? "\n\nSi tu choisis les futurs ou toute la série, la nouvelle date reste spécifique à cet événement. Les autres occurrences recuperent surtout les paramètres communs comme l'horaire, le lieu et les invitations."
            : '';
          Alert.alert(
            t('eventEdit.modals.recurrenceUpdate.title', 'Modification récurrente'),
            `${t('eventEdit.modals.recurrenceUpdate.description', 'Cet événement fait partie d\'une série. Que veux-tu modifier ?')}${recurrenceScopeHint}`,
            [
              {
                style: 'cancel',
                text: t('eventEdit.modals.recurrenceUpdate.options.cancel', 'Annuler'),
              },
              {
                onPress: () => updateEventWithMode(),
                text: t('eventEdit.modals.recurrenceUpdate.options.this', 'Cet événement'),
              },
              {
                onPress: () => updateEventWithMode('future'),
                text: t('eventEdit.modals.recurrenceUpdate.options.future', 'Cet événement et les suivants'),
              },
              {
                onPress: () => updateEventWithMode('all'),
                text: t('eventEdit.modals.recurrenceUpdate.options.all', 'Tous les événements'),
              },
            ],
          );
        } else {
          await updateEventWithMode();
        }
      } else {
        // Création d'un ou plusieurs nouveaux événements
        console.log('Creating new event(s)...', normalizedEvents);
        const promises = normalizedEvents.map(
          (eventData) => {
            console.log('Sending event data:', eventData);
            return createEventMutation.mutateAsync(eventData);
          },
        );

        let results;
        try {
          results = await Promise.all(promises);
        } catch {
          return;
        }
        console.log('Events created:', results);

        // Navigation après succès
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      }
    } catch (error) {
      // ⚠️ CE COMMENTAIRE A ETE FAUX LONGTEMPS : il affirmait que « les mutations
      // gerent », alors qu'elles ne faisaient qu'un `console.error`. Depuis D1
      // c'est vrai, et les deux chemins d'envoi captent desormais eux-memes —
      // donc ce qui arrive ici n'est plus un echec reseau, mais un imprevu de
      // la mise en forme de la charge, AVANT tout appel. Une date illisible
      // suffit : `format` jette, et jusqu'ici l'ecran n'en disait rien.
      signalerEchecEnregistrement(error);
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="always"
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>

            <Controller
              control={control}
              name="type"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.type.label')}
                  onBlur={onBlur}
                  options={eventTypeOptions}
                  placeholder={t('eventEdit.fields.type.placeholder')}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value);
                  }}
                  value={eventTypeOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="team"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.team.label')}
                  onBlur={onBlur}
                  options={teamOptions}
                  placeholder={t('eventEdit.fields.team.placeholder')}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value);
                    // Reset invited teams if main team changes (optional, but safer to avoid duplicates)
                    // setValue('invitedTeams', []);
                  }}
                  value={teamOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            {/* Invited Teams */}
            <Controller
              control={control}
              name="invitedTeams"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  isMulti
                  label={t('eventEdit.fields.invitedTeams.label') || 'Inviter des équipes'}
                  onBlur={onBlur}
                  options={invitedTeamOptions}
                  placeholder={t('eventEdit.fields.invitedTeams.placeholder') || 'Sélectionner des équipes'}
                  setValue={(/** @type {Option[]} */options) => {
                    // Filter out headers from selection just in case
                    const validOptions = options?.filter((o) => !o.isHeader);
                    onChange(validOptions?.map((o) => o.value) || []);
                  }}
                  value={value || []}
                />
              )}
            />

            {/* Facility Selector */}
            <Controller
              control={control}
              name="location"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <FacilitySelector
                  clubId={clubId || ''}
                  cmId={cmId || ''}
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  facilityId={watch('facility')}
                  location={value}
                  occupancyWindow={occupancyWindow
                    ? {
                      ...occupancyWindow,
                      excludeEventId: eventId || undefined,
                    }
                    : null}
                  onChange={(/** @type {{ location: string; facilityId?: string }} */ { facilityId: newFacilityId, location: newLocation }) => {
                    onChange(newLocation);
                    setValue('facility', newFacilityId || '');
                  }}
                  onOccupancyResolved={setSelectedOccupancy}
                />
              )}
            />

            {eventId && !editSupport?.isSupported ? (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.warning900]}>
                  {editSupport?.reason || "Cette fiche ne permet pas encore d'éditer ce type d'événement."}
                </Text>
              </View>
            ) : null}

            {requiresFacilityApproval ? (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.warning900]}>
                  Ce créneau dépasse la capacité de l installation. L événement restera en demande en attente jusqu au traitement d un dirigeant.
                </Text>
              </View>
            ) : null}

            {allowsImmediateFacilityConflict ? (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.primary700,
                { borderColor: Colors.primary500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.primary200]}>
                  Ce créneau dépasse la capacité de l installation, mais ce club est configure en Autorise et notifier. L événement restera confirme et les dirigeants seront prevenus.
                </Text>
              </View>
            ) : null}

            {/* Conflict Warning */}
            {false && eventId && !editSupport?.isSupported && (
              <View style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.warning100,
                { borderColor: Colors.warning500, borderRadius: 8, borderWidth: 1 },
              ]}
              >
                <Text style={[Fonts.p2, Fonts.warning900]}>
                  ⚠️ Un conflit a été détecté sur ce créneau. Ta demande sera soumise à validation.
                </Text>
              </View>
            )}

            <Controller
              control={control}
              name="description"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="enter"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.description.label')}
                  multiline
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('eventEdit.fields.description.placeholder')}
                  ref={ref}
                  value={value || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="sessionStatus"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.sessionStatus.label')}
                  onBlur={onBlur}
                  options={sessionStatusOptions}
                  setValue={(/** @type {Option} */option) => {
                    onChange(option?.value || '');
                  }}
                  value={sessionStatusOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            <Controller
              control={control}
              name="participantIdentityVisibility"
              render={({
                field: {
                  name, onBlur, onChange, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('eventEdit.fields.participantIdentityVisibility.label', 'Confidentialité des participants')}
                  onBlur={onBlur}
                  options={participantIdentityVisibilityOptions}
                  setValue={(option) => {
                    onChange(option?.value || 'VISIBLE');
                  }}
                  value={participantIdentityVisibilityOptions.find((option) => option.value === value)?.label || ''}
                />
              )}
            />

            {showValidationField ? (
              <Controller
                control={control}
                name="validationMode"
                render={({
                  field: {
                    name, onBlur, onChange, value,
                  },
                }) => (
                  <AutocompleteSelect
                    error={getFieldError({ errors: formErrors, fieldName: name })}
                    label={validationModeLabel}
                    onBlur={onBlur}
                    options={validationModeOptions}
                    setValue={(/** @type {Option} */option) => {
                      onChange(option?.value || '');
                    }}
                    value={validationModeOptions.find((option) => option.value === value)?.label || ''}
                  />
                )}
              />
            ) : null}

            {/* S11 — CE N'EST PLUS UN CHOIX, C'EST UNE INFORMATION. Le serveur
                met toute demande venue du dehors en attente, quoi qu'on lui
                envoie : un selecteur « automatique » serait un bouton sans fil.
                Il s'affiche partout ou des demandes exterieures sont possibles,
                donc sur tout evenement public — plus seulement un entrainement. */}
            {showValidationField ? (
              <View style={[Spaces.gap[4]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('eventEdit.fields.externalRequests.label', 'Demandes extérieures')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  {t(
                    'eventEdit.fields.externalRequests.alwaysManual',
                    'Les demandes extérieures sont validées par toi.',
                  )}
                </Text>
              </View>
            ) : null}

            <Controller
              control={control}
              name="eventTasks"
              render={({ field: { onChange, value } }) => (
                <EventTasksEditor
                  editable
                  onChange={onChange}
                  value={Array.isArray(value) ? value : []}
                />
              )}
            />

            <Controller
              control={control}
              name="teamAudiences"
              render={({ field: { onChange, value } }) => (
                <EventTeamAudiencesEditor
                  availableTeams={clubTeams}
                  clubId={clubId || ''}
                  currentTeamId={selectedTeamId || ''}
                  editable
                  onChange={onChange}
                  value={Array.isArray(value) ? value : []}
                />
              )}
            />

            {!isTrainingType ? (
              <Controller
                control={control}
                name="capacity"
                render={({
                  field: {
                    name, onBlur, onChange, ref, value,
                  },
                }) => (
                  <Input
                    enterKeyHint="next"
                    error={getFieldError({ errors: formErrors, fieldName: name })}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    label={t('eventEdit.fields.capacity.label')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('type')}
                    placeholder={t('eventEdit.fields.capacity.placeholder')}
                    ref={ref}
                    value={value?.toString() || ''}
                  />
                )}
              />
            ) : null}

            {isReservationType && (
              <>
                <Controller
                  control={control}
                  name="pricePerPerson"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="next"
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      inputMode="decimal"
                      keyboardType="decimal-pad"
                      label={t('eventEdit.fields.pricePerPerson.label')}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t('eventEdit.fields.pricePerPerson.placeholder')}
                      ref={ref}
                      value={value?.toString() || ''}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="totalPlayers"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="next"
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      label={t('eventEdit.fields.totalPlayers.label')}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder={t('eventEdit.fields.totalPlayers.placeholder')}
                      ref={ref}
                      value={value?.toString() || ''}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="startTime"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="next"
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      inputMode="numeric"
                      keyboardType="numeric"
                      label={t('eventEdit.fields.startTime.label')}
                      maxLength={5}
                      onBlur={onBlur}
                      onChangeText={(val) => onChange(formatTimeInput(val))}
                      placeholder="HH:mm"
                      ref={ref}
                      value={value}
                    />
                  )}
                />

                <Controller
                  control={control}
                  name="endTime"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="done"
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      inputMode="numeric"
                      keyboardType="numeric"
                      label={t('eventEdit.fields.endTime.label')}
                      maxLength={5}
                      onBlur={onBlur}
                      onChangeText={(val) => onChange(formatTimeInput(val))}
                      placeholder="HH:mm"
                      ref={ref}
                      value={value}
                    />
                  )}
                />

              </>
            )}

            {isTrainingType ? (
              <>
                {!isOpenTrainingType ? (
                  <Controller
                    control={control}
                    name="totalPlayers"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <Input
                        enterKeyHint="next"
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        inputMode="numeric"
                        keyboardType="number-pad"
                        label={t('eventEdit.fields.trainingTotalPlayers.label', 'Joueurs attendus (interne)')}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder={t('eventEdit.fields.trainingTotalPlayers.placeholder', 'Nombre de joueurs de tes équipes attendus')}
                        ref={ref}
                        value={value?.toString() || ''}
                      />
                    )}
                  />
                ) : null}

                {isOpenTrainingType ? (
                  <Controller
                    control={control}
                    name="externalParticipantLimit"
                    render={({
                      field: {
                        name, onBlur, onChange, ref, value,
                      },
                    }) => (
                      <Input
                        enterKeyHint="next"
                        error={getFieldError({ errors: formErrors, fieldName: name })}
                        inputMode="numeric"
                        keyboardType="number-pad"
                        label={t('eventEdit.fields.externalParticipantLimit.label', 'Places externes')}
                        onBlur={onBlur}
                        onChangeText={onChange}
                        placeholder={t('eventEdit.fields.externalParticipantLimit.placeholder', 'Combien de joueurs externes acceptes ?')}
                        ref={ref}
                        value={value?.toString() || ''}
                      />
                    )}
                  />
                ) : null}
              </>
            ) : null}

            <Controller
              control={control}
              name="date"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <View style={Spaces.gap[4]}>
                  <DatePickerInput
                    label={t('eventEdit.fields.date.label')}
                    onChange={(text) => {
                      onChange(toDateInputText(clampDateToToday(mergeDateInput(text, new Date()))));
                    }}
                    value={value}
                  />
                  {getFieldError({ errors: formErrors, fieldName: name }) ? (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {getFieldError({ errors: formErrors, fieldName: name })}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="startTime"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <View style={Spaces.gap[4]}>
                  <TimePickerInput
                    label={t('eventEdit.fields.startTime.label')}
                    onChange={onChange}
                    value={value}
                  />
                  {getFieldError({ errors: formErrors, fieldName: name }) ? (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {getFieldError({ errors: formErrors, fieldName: name })}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            <Controller
              control={control}
              name="endTime"
              render={({
                field: {
                  name, onChange, value,
                },
              }) => (
                <View style={Spaces.gap[4]}>
                  <TimePickerInput
                    label={t('eventEdit.fields.endTime.label')}
                    onChange={onChange}
                    value={value}
                  />
                  {getFieldError({ errors: formErrors, fieldName: name }) ? (
                    <Text style={[Fonts.p3, { color: Colors.error500 }]}>
                      {getFieldError({ errors: formErrors, fieldName: name })}
                    </Text>
                  ) : null}
                </View>
              )}
            />

            {eventId ? null : (
              <Controller
                control={control}
                name="isRecurrent"
                render={({
                  field: {
                    name, onChange, value,
                  },
                }) => (
                  <View style={[Spaces.gap[24]]}>
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                      <Switch
                        key={name}
                        onValueChange={(newValue) => {
                          onChange(newValue);
                          if (newValue) {
                            const dateValue = watch('date');
                            if (dateValue) {
                              setValue('recurrenceStartDate', dateValue);
                            }
                          }
                        }}
                        trackColor={{ false: Colors.neutral700, true: Colors.primary500 }}
                        value={value}
                      />
                      <Text style={[Fonts.p1, Fonts.neutral00]}>
                        {t('eventEdit.fields.isRecurrent.label')}
                      </Text>
                    </View>
                    {value && (
                      <View style={[Spaces.gap[16]]}>
                        <Controller
                          control={control}
                          name="recurrenceStartDate"
                          render={({
                            field: {
                              name: fieldName, onBlur,
                              onChange: onFieldChange, ref, value: fieldValue,
                            },
                          }) => (
                            <Input
                              enterKeyHint="done"
                              error={getFieldError({ errors: formErrors, fieldName })}
                              inputMode="numeric"
                              keyboardType="numeric"
                              label={t('eventEdit.fields.recurrenceStartDate.label')}
                              maxLength={10}
                              onBlur={onBlur}
                              onChangeText={(val) => onFieldChange(formatDateInput(val))}
                              placeholder="DD/MM/YYYY"
                              ref={ref}
                              value={fieldValue}
                            />
                          )}
                        />

                        <Controller
                          control={control}
                          name="recurrenceEndDate"
                          render={({
                            field: {
                              name: fieldName, onBlur,
                              onChange: onFieldChange, ref, value: fieldValue,
                            },
                          }) => (
                            <Input
                              enterKeyHint="done"
                              error={getFieldError({ errors: formErrors, fieldName })}
                              inputMode="numeric"
                              keyboardType="numeric"
                              label={t('eventEdit.fields.recurrenceEndDate.label')}
                              maxLength={10}
                              onBlur={onBlur}
                              onChangeText={(val) => onFieldChange(formatDateInput(val))}
                              placeholder="DD/MM/YYYY"
                              ref={ref}
                              value={fieldValue}
                            />
                          )}
                        />

                        <Controller
                          control={control}
                          name="recurrenceFrequency"
                          render={({
                            field: {
                              name: fieldName, onBlur, onChange: onFieldChange, value: fieldValue,
                            },
                          }) => (
                            <AutocompleteSelect
                              error={getFieldError({ errors: formErrors, fieldName })}
                              label={t('eventEdit.fields.recurrenceFrequency.label')}
                              onBlur={onBlur}
                              options={recurrenceFrequencyOptions}
                              setValue={(/** @type {Option} */option) => onFieldChange(option?.value || '')}
                              value={recurrenceFrequencyOptions.find((option) => option.value === fieldValue)?.label || ''}
                            />
                          )}
                        />

                        {recurrenceFrequency === 'week' ? (
                          <View style={[Spaces.gap[8]]}>
                            <Text style={[Fonts.p2, Fonts.neutral00]}>
                              {t('eventEdit.fields.recurrenceDays.label', 'Jours de récurrence')}
                            </Text>
                            <Controller
                              control={control}
                              name="recurrenceDays"
                              render={({ field: { onChange: onDaysChange, value: selectedDays } }) => (
                                <DayPicker
                                  onChange={onDaysChange}
                                  selectedDays={selectedDays || []}
                                />
                              )}
                            />
                          </View>
                        ) : (
                          <Controller
                            control={control}
                            name="recurrenceDay"
                            render={({
                              field: {
                                name: fieldName, onBlur, onChange: onFieldChange, value: fieldValue,
                              },
                            }) => (
                              <AutocompleteSelect
                                error={getFieldError({ errors: formErrors, fieldName })}
                                label={t('eventEdit.fields.recurrenceDay.label')}
                                onBlur={onBlur}
                                options={getReccurrenceDayOptions(recurrenceFrequency)}
                                setValue={(/** @type {Option} */ option) => onFieldChange(option?.value || '')}
                                value={getReccurrenceDayOptions(recurrenceFrequency).find((option) => option.value === fieldValue)?.label || ''}
                              />
                            )}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}
              />
            )}
            <View
              style={[
                ApplicationStyle.backgroundColor.primary900,
                ApplicationStyle.borderRadius16,
                Spaces.padding[16],
                Spaces.gap[8],
                Spaces.marginTop[16],
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Mise à la une
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                La demande de mise a la une se fait depuis la fiche de l&apos;evenement une fois enregistre.
              </Text>
            </View>
          </View>
        </ScrollView>
        <View style={[Spaces.gap[8]]}>
          {ficheEnAttente ? (
            <View style={[
              Spaces.padding[16],
              ApplicationStyle.backgroundColor.primary700,
              { borderColor: Colors.primary500, borderRadius: 8, borderWidth: 1 },
            ]}
            >
              <Text style={[Fonts.p2, Fonts.primary200]}>
                {t(
                  'eventEdit.loading.description',
                  "Chargement de l'événement… Le bouton s'active dès que tout est affiché.",
                )}
              </Text>
            </View>
          ) : null}
          <Button
            disabled={Boolean(eventId && !editSupport?.isSupported) || ficheEnAttente}
            isLoading={
              createEventMutation.isPending
              || updateEventMutation.isPending
            }
            onPress={handleSubmit(handleFormSubmit, (errors) => {
              // 🗣️ D8 — UNE PHRASE, JAMAIS LE JSON DE LA BIBLIOTHEQUE.
              Alert.alert(
                t('eventEdit.modals.invalidForm.title', 'Il manque quelque chose'),
                decrireLesChampsFautifs(errors, t),
              );
            })}
            title={t('eventEdit.actions.save')}
            variant="Primary"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default EventEdit;
