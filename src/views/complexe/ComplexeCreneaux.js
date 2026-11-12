import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import { lirePrix, messageDeRefus } from '@/domains/complexe/complexeGerant';
import {
  decoupagePlage,
  formatEuros,
  heureDe,
  joursTexte,
  lignesDePrix,
  minutesDe,
  resumePlage,
  resumeTarif,
  texteDuree,
  texteHeure,
} from '@/domains/complexe/complexeTerrain';
import {
  bandesDeLaSemaine,
  departsReguliers,
  dureesDe,
  dureesDuPlan,
  modeDesDeparts,
  offresDeLaPlage,
  plageQuiChevauche,
  prixDeLaSemaineParDuree,
} from '@/domains/complexe/dureesTarifs';
import { withAlpha } from '@/theme/colors';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import DatePickerInput from '@/components/molecules/datePickerInput/DatePickerInput';
import Input from '@/components/molecules/input/Input';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';

import { RouteNames } from '@/navigation/routeNames';

import {
  useApercuCreneaux,
  useComplexeChoisi,
  useEnregistrerCreneaux,
  useTerrains,
} from '@/services/complexe/complexeQueries';

import texteInsecable from '@/utils/texteInsecable';

import useGardeDeSortie from '@/hooks/useGardeDeSortie';

const JOURS = [1, 2, 3, 4, 5, 6, 7];
const DUREES = [60, 90, 120];
const DUREE_MIN = 30;
const DUREE_MAX = 240;

/**
 * La date civile d'aujourd'hui, « AAAA-MM-JJ », à l'heure du téléphone.
 * @returns {string} La date.
 */
const aujourdHui = () => {
  const maintenant = new Date();
  return [
    maintenant.getFullYear(),
    String(maintenant.getMonth() + 1).padStart(2, '0'),
    String(maintenant.getDate()).padStart(2, '0'),
  ].join('-');
};

/**
 * « 2026-10-25 » ⇒ « 25/10/2026 » (le format du sélecteur de date).
 * @param {string | null | undefined} date - La date civile.
 * @returns {string} La saisie.
 */
const enSaisie = (date) => (date ? date.split('-').reverse().join('/') : '');

/**
 * « 25/10/2026 » ⇒ « 2026-10-25 », ou null si la saisie n'est pas une date.
 * @param {unknown} saisie - La saisie.
 * @returns {string | null} La date civile.
 */
const enDate = (saisie) => {
  const morceaux = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(saisie || '').trim());
  return morceaux ? `${morceaux[3]}-${morceaux[2]}-${morceaux[1]}` : null;
};

/**
 * Un modèle vide : aucune plage, la période commence aujourd'hui, sans date de fin.
 * @returns {{ extraSlots: any[], period: { from: string, until: null }, ranges: any[],
 *   rates: any[] }} Le modèle.
 */
const planVide = () => ({
  extraSlots: [], period: { from: aujourdHui(), until: null }, ranges: [], rates: [],
});

/**
 * DT-2 — la feuille d'une plage, vide (« Nouvelle plage ») : une durée d'1 h, les départs « à la
 * suite » (la règle d'avant : l'ouverture puis toutes les « durée »), aucun jour.
 * @returns {{ a: string, autre: boolean, choisis: string[], de: string,
 *   departs: 'choix' | 'demi' | 'heure' | 'suite', dureeAutre: number, durees: number[],
 *   jours: number[], rang: number | null }} La saisie.
 */
const plageVide = () => ({
  a: '23:00',
  autre: false,
  choisis: /** @type {string[]} */ ([]),
  de: '17:00',
  departs: /** @type {'choix' | 'demi' | 'heure' | 'suite'} */ ('suite'),
  dureeAutre: 60,
  durees: [60],
  jours: /** @type {number[]} */ ([]),
  rang: /** @type {number | null} */ (null),
});

/**
 * Les durées saisies (puces et « Autre »), triées, chacune une fois.
 * @param {ReturnType<typeof plageVide>} saisie - La saisie.
 * @returns {number[]} Les durées.
 */
const dureesSaisies = (saisie) => [...new Set([
  ...(saisie.autre ? [saisie.dureeAutre] : []), ...saisie.durees,
])].sort((a, b) => a - b);

/**
 * DT-2 — la plage telle qu'elle part au serveur (DT-1). Une durée et des départs « à la suite » :
 * la forme d'avant, clé pour clé ; sinon `durations` (plusieurs durées) et `starts` (départs).
 * @param {ReturnType<typeof plageVide>} saisie - La saisie.
 * @returns {any} La plage.
 */
const plageDeLaSaisie = (saisie) => {
  const durees = dureesSaisies(saisie);
  const plusCourte = durees[0];
  const heures = { from: saisie.de, to: saisie.a };
  /** @type {string[] | null} */
  let departs = null;
  if (saisie.departs === 'heure') departs = departsReguliers(heures, 60, plusCourte);
  if (saisie.departs === 'demi') departs = departsReguliers(heures, 30, plusCourte);
  if (saisie.departs === 'choix') {
    // Les départs dans l'ordre de la plage (ceux d'après minuit en dernier).
    const ordre = departsReguliers(heures, 5, plusCourte);
    departs = saisie.choisis.filter((heure) => ordre.includes(heure))
      .sort((x, y) => ordre.indexOf(x) - ordre.indexOf(y));
  }
  return {
    days: [...saisie.jours].sort((x, y) => x - y),
    durationMinutes: plusCourte,
    ...(durees.length > 1 ? { durations: durees } : {}),
    from: saisie.de,
    ...(departs ? { starts: departs } : {}),
    to: saisie.a,
  };
};

/**
 * E-G09 — CRÉNEAUX ET TARIFS D'UN TERRAIN — RESA-L5A1 (13/10/2026), planches EG09 et RA4 (retour
 * d'Adel du 13/10 13h03, qui remplace les états 1 et 2 de EG09). Écran de départ : l'onglet
 * « Créneaux » de la fiche d'installation Ville (`InstallationCreneaux.js`).
 *   · « Tes plages » : des jours, une ouverture, une fermeture, une durée de créneau (1 h, 1 h 30,
 *     2 h, ou « Autre » à 5 minutes près) ; ce qui ne rentre pas est DIT (« il reste 1 h »).
 *   · « Tarifs » : le prix de base (fiche du terrain), des prix par jour, ou par jour et par heure.
 *   · « Les prix de la semaine », la « Période », les créneaux ponctuels (« Exceptions »).
 * Chaque geste est JUGÉ par le serveur avant d'entrer dans le modèle (`dryRun` : « Ce tarif
 * chevauche… », « 640 créneaux ouverts ») ; « Ouvrir ces créneaux » / « Enregistrer » l'écrit.
 * RESA-L5A2 (14/10/2026) : « Fermer des jours » (E-G10) et « Voir le planning » (E-G03).
 * RESA-L5B-1, partie B (serveur RESA-L2C, planche EG09 état 4) : l'aperçu compte les réservations
 * à venir qui tombent HORS du nouveau modèle (`reservationsHorsHoraires`) ; l'écran le dit avant
 * d'enregistrer, « 3 réservations tombent hors de tes nouveaux horaires. Elles sont gardées. »
 * (rien n'est annulé).
 * COMPLEXE-TERRAINS (10/11/2026, ligne Gérant 04 du testeur) : la feuille « Nouvelle plage » (et
 * « Nouveau tarif ») repart sans les jours de la précédente (la 2ᵉ plage reprenait lun. mar. jeu.
 * ven. et le serveur la refusait comme chevauchement) ; une fin avant l'ouverture passe minuit ; un
 * tarif posé sur des jours sans plage le dit ; tant que rien n'est enregistré, l'écran le dit et
 * quitter propose d'enregistrer (le terrain des captures n'avait RIEN d'enregistré) ; « Fermer des
 * jours » n'apparaît pas pendant la création.
 * Paramètres de route : `complexeId`, `terrainId`, `terrainAjoute` (E-G08 vient de le créer).
 * Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeCreneaux() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @typedef {{ complexeId?: string, terrainAjoute?: string, terrainId?: string }} Parametres */
  const params = /** @type {Parametres | undefined} */ (route?.params);
  // RESA-L5B-2 : sans `?complexeId=` (site), le complexe du compte.
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  const terrainId = params?.terrainId || null;
  const terrainsLus = useTerrains(complexeId);
  const apercu = useApercuCreneaux();
  const apercuEnVol = useRef(false);
  const enregistrer = useEnregistrerCreneaux();
  const terrains = Array.isArray(terrainsLus.data) ? terrainsLus.data : [];
  const terrain = terrains.find((candidat) => candidat?.documentId === terrainId) || null;

  const [pret, setPret] = useState(false);
  const [plan, setPlan] = useState(planVide);
  const [resume, setResume] = useState(/** @type {any} */ (null));
  const [neuf, setNeuf] = useState(false);
  const [sansFin, setSansFin] = useState(true);
  /** @typedef {null | 'plage' | 'ponctuel' | 'tarif'} Feuille */
  const [feuille, setFeuille] = useState(/** @type {Feuille} */ (null));
  const [refusFeuille, setRefusFeuille] = useState('');
  const [refusPlan, setRefusPlan] = useState('');
  const [refus, setRefus] = useState('');
  const [enregistre, setEnregistre] = useState(/** @type {any} */ (null));
  // RESA-L5B-1, partie B — les réservations à venir hors du modèle jugé (RESA-L2C), 0 sinon.
  const [horsHoraires, setHorsHoraires] = useState(0);
  // CORR-RESA (81 A) : une plage ajoutée (ou retirée) n'est qu'un aperçu tant qu'on n'a pas
  // enregistré ; quitter l'écran avant le demande (même garde que « Fermer une installation »).
  const [modifie, setModifie] = useState(false);
  // COMPLEXE-TERRAINS (1) : quitter propose d'ENREGISTRER (Oui) plutôt que de perdre (Non).
  const enregistrerAvantDePartir = useRef(async () => false);
  useGardeDeSortie(navigation, {
    actif: modifie,
    enregistrer: () => enregistrerAvantDePartir.current(),
    textes: {
      enregistrer: t('complexeGerant.terrain.enregistrer', 'Enregistrer'),
      message: t(
        'complexeGerant.creneaux.quitterMessage',
        'Tes plages et tes tarifs ne sont pas encore enregistrés : les joueurs ne les voient pas.',
      ),
      quitter: t('complexeGerant.creneaux.quitter', 'Quitter sans enregistrer'),
      rester: t('complexeGerant.creneaux.rester', 'Rester'),
      titre: t('complexeGerant.creneaux.quitterTitre', 'Enregistrer tes créneaux ?'),
    },
  });
  const [plage, setPlage] = useState(plageVide);
  const [tarif, setTarif] = useState({
    a: '22:00', de: '18:00', duree: 0, heures: false, jours: /** @type {number[]} */ ([]), prix: '',
  });
  // DT-2 — le prix d'un créneau à cheval sur deux tarifs : « debut » (défaut) ou « fin ». Il part
  // dans CHAQUE envoi du modèle (aperçu compris) : c'est ce qui distingue cette app d'une 2.6.99
  // pour le serveur (DT-1, `assertNotOldPhone`).
  const [aCheval, setACheval] = useState(/** @type {'debut' | 'fin'} */ ('debut'));
  // DT-2 G3 — l'onglet de « Les prix de la semaine » (une durée), quand le terrain en a plusieurs.
  const [ongletPrix, setOngletPrix] = useState(/** @type {number | null} */ (null));
  const [ponctuel, setPonctuel] = useState({ a: '', date: '', de: '' });

  // Le modèle se lit UNE fois, avec le terrain (jamais par-dessus un geste en cours).
  useEffect(() => {
    if (pret || !terrain) return;
    const lu = terrain.slotPlan;
    const depart = lu
      ? {
        extraSlots: lu.extraSlots || [],
        period: lu.period || planVide().period,
        ranges: lu.ranges || [],
        rates: lu.rates || [],
      }
      : planVide();
    setPlan(depart);
    setACheval(terrain.priceStraddle === 'fin' ? 'fin' : 'debut');
    setSansFin(!depart.period?.until);
    setResume(terrain.creneaux || null);
    setNeuf(!lu || terrain.creneaux?.status === 'vide');
    setPret(true);
  }, [pret, terrain]);

  const nomDuJour = (/** @type {number} */ jour) => [
    t('complexeGerant.jours.lundi', 'lundi'),
    t('complexeGerant.jours.mardi', 'mardi'),
    t('complexeGerant.jours.mercredi', 'mercredi'),
    t('complexeGerant.jours.jeudi', 'jeudi'),
    t('complexeGerant.jours.vendredi', 'vendredi'),
    t('complexeGerant.jours.samedi', 'samedi'),
    t('complexeGerant.jours.dimanche', 'dimanche'),
  ][jour - 1];

  /**
   * Fait juger un modèle par le serveur (`dryRun`) et le garde s'il est accepté.
   * @param {any} candidat - Le modèle proposé.
   * @param {(message: string) => void} direLeRefus - Où écrire un refus.
   * @returns {Promise<boolean>} Vrai s'il est accepté.
   */
  const jugerEtGarder = async (candidat, direLeRefus) => {
    // BH16 P13-13 : un seul apercu à la fois ; sinon deux retraits partis du même plan s'écrasent.
    if (apercuEnVol.current) return false;
    apercuEnVol.current = true;
    direLeRefus('');
    setEnregistre(null);
    try {
      const corps = await apercu.mutateAsync({
        complexeId, plan: { ...candidat, priceStraddle: aCheval }, terrainId,
      });
      setPlan(corps?.data?.slotPlan || candidat);
      setModifie(true);
      setResume(corps?.data?.creneaux || null);
      setHorsHoraires(Number(corps?.data?.reservationsHorsHoraires) || 0);
      return true;
    } catch (erreur) {
      direLeRefus(messageDeRefus(
        t,
        erreur,
        t(
          'complexeGerant.creneaux.apercuEchec',
          'Ces créneaux n’ont pas pu être vérifiés. Réessaie.',
        ),
      ));
      return false;
    } finally {
      apercuEnVol.current = false;
    }
  };

  const fermerLaFeuille = () => {
    setFeuille(null);
    setRefusFeuille('');
  };

  const ajouterLaPlage = async () => {
    const debut = minutesDe(plage.de);
    const fin = minutesDe(plage.a);
    if (!plage.jours.length) {
      setRefusFeuille(t('complexeGerant.creneaux.joursManquants', 'Choisis au moins un jour.'));
      return;
    }
    // « nuit 1A » : une fermeture avant l'ouverture finit le lendemain ; seule l'égalité se refuse.
    if (debut === null || fin === null || fin === debut) {
      setRefusFeuille(t(
        'complexeGerant.creneaux.finAvantDebut',
        'La fin doit être après le début.',
      ));
      return;
    }
    if (!dureesSaisies(plage).length) {
      setRefusFeuille(t('complexeGerant.creneaux.dureesManquantes', 'Choisis au moins une durée.'));
      return;
    }
    if (plage.departs === 'choix' && !plage.choisis.length) {
      setRefusFeuille(t('complexeGerant.creneaux.departsManquants', 'Choisis au moins un départ.'));
      return;
    }
    const nouvelle = plageDeLaSaisie(plage);
    // DT-2 G1 : une plage rouverte (toucher sa bande ou sa ligne) se REMPLACE à sa place.
    const ranges = plage.rang === null
      ? [...plan.ranges, nouvelle]
      : plan.ranges.map((range, rang) => (rang === plage.rang ? nouvelle : range));
    const candidat = { ...plan, ranges };
    const accepte = await jugerEtGarder(candidat, setRefusFeuille);
    if (accepte) {
      setPlage((avant) => ({ ...avant, jours: [], rang: null }));
      fermerLaFeuille();
    }
  };

  /**
   * DT-2 G1 — rouvre la feuille d'une plage enregistrée, pour la modifier.
   * @param {number} rang - Son rang dans le modèle.
   */
  const ouvrirLaPlage = (rang) => {
    const range = plan.ranges[rang];
    if (!range) return;
    const durees = dureesDe(range);
    const fixes = durees.filter((duree) => DUREES.includes(duree));
    const autre = durees.find((duree) => !DUREES.includes(duree));
    setPlage({
      a: range.to,
      autre: autre !== undefined,
      choisis: Array.isArray(range.starts) ? [...range.starts] : [],
      de: range.from,
      departs: modeDesDeparts(range),
      dureeAutre: autre ?? 60,
      durees: fixes,
      jours: [...range.days],
      rang,
    });
    setRefusFeuille('');
    setFeuille('plage');
  };

  const nouvellePlage = () => {
    setPlage((avant) => ({ ...plageVide(), a: avant.a, de: avant.de }));
    setFeuille('plage');
  };

  const ajouterLeTarif = async () => {
    const prix = lirePrix(tarif.prix);
    if (!tarif.jours.length) {
      setRefusFeuille(t('complexeGerant.creneaux.joursManquants', 'Choisis au moins un jour.'));
      return;
    }
    if (prix === null || prix === undefined) {
      setRefusFeuille(t(
        'complexeGerant.terrain.prixFaux',
        'Le prix : un montant en euros, deux décimales au plus.',
      ));
      return;
    }
    const jours = [...tarif.jours].sort((a, b) => a - b);
    // DT-2 G3 bis : « Pour quelle durée » ; « Toutes » (0) = le tarif d'avant, sans durée.
    const duree = tarif.duree > 0 ? { durationMinutes: tarif.duree } : {};
    const nouveau = tarif.heures
      ? {
        days: jours, ...duree, from: tarif.de, price: prix, to: tarif.a,
      }
      : { days: jours, ...duree, price: prix };
    const candidat = { ...plan, rates: [...plan.rates, nouveau] };
    const accepte = await jugerEtGarder(candidat, setRefusFeuille);
    if (accepte) {
      setTarif((avant) => ({
        ...avant, duree: 0, jours: [], prix: '',
      }));
      fermerLaFeuille();
    }
  };

  /**
   * DT-2 G3 (281 A, « il doit pouvoir personnaliser ») — une case en italique (un prix calculé au
   * temps) ouvre « Nouveau tarif » déjà rempli : cette durée, ce jour, cette tranche ; le prix est
   * au gérant.
   * @param {{ a: string, de: string, duree: number, jour: number }} caseTouchee - La case.
   */
  const personnaliser = ({
    a, de, duree, jour,
  }) => {
    setTarif({
      a, de, duree, heures: true, jours: [jour], prix: '',
    });
    setRefusFeuille('');
    setFeuille('tarif');
  };

  const ajouterLePonctuel = async () => {
    const date = enDate(ponctuel.date);
    if (!date) {
      setRefusFeuille(t('complexeGerant.creneaux.dateFausse', 'La date : JJ/MM/AAAA.'));
      return;
    }
    const nouveau = { date, from: ponctuel.de, to: ponctuel.a };
    const candidat = { ...plan, extraSlots: [...plan.extraSlots, nouveau] };
    const accepte = await jugerEtGarder(candidat, setRefusFeuille);
    if (accepte) fermerLaFeuille();
  };

  const retirer = (
    /** @type {'extraSlots' | 'ranges' | 'rates'} */ cle,
    /** @type {number} */ rang,
  ) => {
    const restants = plan[cle].filter((_v, index) => index !== rang);
    jugerEtGarder({ ...plan, [cle]: restants }, setRefusPlan);
  };

  const changerPeriode = (/** @type {Record<string, any>} */ changement) => {
    jugerEtGarder({ ...plan, period: { ...plan.period, ...changement } }, setRefusPlan);
  };

  /**
   * « Ouvrir ces créneaux » / « Enregistrer ».
   * @returns {Promise<boolean>} Vrai si c'est enregistré.
   */
  const enregistrerLesCreneaux = async () => {
    setRefus('');
    setEnregistre(null);
    try {
      const corps = await enregistrer.mutateAsync({
        complexeId, plan: { ...plan, priceStraddle: aCheval }, terrainId,
      });
      const creneaux = corps?.data?.creneaux || null;
      setResume(creneaux);
      setEnregistre(creneaux || {});
      setModifie(false);
      setNeuf(false);
      setHorsHoraires(0);
      return true;
    } catch (erreur) {
      setRefus(messageDeRefus(
        t,
        erreur,
        t('complexeGerant.creneaux.echec', 'Les créneaux ne sont pas partis. Réessaie.'),
      ));
      return false;
    }
  };
  enregistrerAvantDePartir.current = enregistrerLesCreneaux;

  // ── Petites pièces ─────────────────────────────────────────────────────────────────────
  const groupe = (/** @type {string} */ legende, /** @type {any} */ contenu) => (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary700, 0.45),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
        {legende.toUpperCase()}
      </Text>
      {contenu}
    </View>
  );
  const aide = (/** @type {string} */ texte) => (
    <Text style={[Fonts.p3, Fonts.neutral200]}>{texte}</Text>
  );
  // DT-2 — « 17 h – 23 h · créneaux de 1 h ou 2 h » (plusieurs durées), ou une durée et ses
  // départs choisis : « … · créneaux de 1 h 30 · 4 créneaux ».
  const resumeDesDurees = (/** @type {any} */ range) => {
    const durees = dureesDe(range);
    const textes = durees.map(texteDuree);
    if (durees.length > 1) {
      const ou = t('complexeGerant.creneaux.ouDurees', '{{debut}} ou {{fin}}', {
        debut: textes.slice(0, -1).join(', '),
        fin: textes[textes.length - 1],
        ...SANS_ECHAPPEMENT,
      });
      return t(
        'complexeGerant.creneaux.resumePlageDurees',
        '{{de}} – {{a}} · créneaux de {{durees}}',
        {
          a: texteHeure(range.to), de: texteHeure(range.from), durees: ou, ...SANS_ECHAPPEMENT,
        },
      );
    }
    const [offre] = offresDeLaPlage(range);
    const nombre = offre ? offre.nombre : 0;
    return t(
      'complexeGerant.creneaux.resumePlage',
      '{{de}} – {{a}} · créneaux de {{duree}} · {{creneaux}}',
      {
        a: texteHeure(range.to),
        creneaux: nombre === 1
          ? t('complexeGerant.creneaux.unCreneau', '1 créneau')
          : t('complexeGerant.creneaux.nCreneaux', '{{nombre}} créneaux', { nombre }),
        de: texteHeure(range.from),
        duree: texteDuree(durees[0]),
        ...SANS_ECHAPPEMENT,
      },
    );
  };
  // DT-2 — la ligne des départs d'une plage : réguliers (« toutes les heures, de 17 h à 22 h »)
  // ou la liste choisie ; rien quand ils suivent la règle d'avant.
  const texteDesDeparts = (/** @type {any} */ range) => {
    const mode = modeDesDeparts(range);
    if (mode === 'suite') return '';
    const departs = range.starts.map(texteHeure);
    const bornes = { a: departs[departs.length - 1], de: departs[0], ...SANS_ECHAPPEMENT };
    if (mode === 'heure') {
      return t(
        'complexeGerant.creneaux.departsHeure',
        'Départs toutes les heures, de {{de}} à {{a}}',
        bornes,
      );
    }
    if (mode === 'demi') {
      return t(
        'complexeGerant.creneaux.departsDemi',
        'Départs toutes les 30 min, de {{de}} à {{a}}',
        bornes,
      );
    }
    return t('complexeGerant.creneaux.departsListe', 'Départs : {{liste}}', {
      liste: departs.join(', '), ...SANS_ECHAPPEMENT,
    });
  };
  const retirerLe = (/** @type {string} */ libelle, /** @type {() => void} */ onPress) => (
    <TouchableOpacity
      accessibilityLabel={t('complexeGerant.creneaux.retirer', 'Retirer : {{quoi}}', {
        quoi: libelle,
        ...SANS_ECHAPPEMENT,
      })}
      accessibilityRole="button"
      onPress={onPress}
      style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
    >
      <GlyphIcon color={Colors.primary200} name="xmark" size={14} />
    </TouchableOpacity>
  );
  // DT-2 : un détail peut être mis en avant (la durée d'un tarif, en bleu) ; une ligne peut se
  // rouvrir (`onModifier` : une plage, G1) — la croix « Retirer » reste.
  const ligne = (
    /** @type {string} */ cle,
    /** @type {string} */ titre,
    /** @type {Array<string | { accent: boolean, texte: string }>} */ details,
    /** @type {() => void} */ onRetirer,
    /** @type {(() => void) | null} */ onModifier = null,
  ) => {
    const lignes = details.filter(Boolean).map((detail) => (typeof detail === 'string'
      ? { accent: false, texte: detail }
      : detail));
    const contenu = (
      <>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        {lignes.filter(({ texte }) => Boolean(texte)).map(({ accent, texte }) => (
          <Text
            key={texte}
            style={accent ? [Fonts.p3Bold, Fonts.primary200] : [Fonts.p3, Fonts.neutral200]}
          >
            {texte}
          </Text>
        ))}
      </>
    );
    return (
      <View key={cle} style={[Alignments.row, { alignItems: 'flex-start', gap: 8 }]}>
        {onModifier ? (
          <TouchableOpacity
            accessibilityLabel={t('complexeGerant.creneaux.modifier', 'Modifier : {{quoi}}', {
              quoi: titre,
              ...SANS_ECHAPPEMENT,
            })}
            accessibilityRole="button"
            onPress={onModifier}
            style={{ flex: 1, gap: 2, minHeight: 44 }}
          >
            {contenu}
          </TouchableOpacity>
        ) : <View style={{ flex: 1, gap: 2 }}>{contenu}</View>}
        {retirerLe(titre, onRetirer)}
      </View>
    );
  };
  const choixDesJours = (
    /** @type {number[]} */ choisis,
    /** @type {(jours: number[]) => void} */ changer,
    /** @type {string} */ prefixe,
  ) => (
    <View style={[Alignments.row, Alignments.wrap, { gap: 6 }]}>
      {JOURS.map((jour) => {
        const coche = choisis.includes(jour);
        return (
          <TouchableOpacity
            accessibilityLabel={nomDuJour(jour)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: coche }}
            key={jour}
            onPress={() => changer(coche ? choisis.filter((j) => j !== jour) : [...choisis, jour])}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                backgroundColor: coche ? withAlpha(Colors.primary500, 0.3) : 'transparent',
                borderColor: coche ? Colors.primary500 : withAlpha(Colors.neutral00, 0.2),
                borderRadius: 22,
                borderWidth: 1,
                height: 44,
                width: 44,
              },
            ]}
            testID={`${prefixe}-${jour}`}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {nomDuJour(jour).charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const pas = (
    /** @type {string} */ libelle,
    /** @type {string} */ signe,
    /** @type {number} */ ajout,
  ) => (
    <TouchableOpacity
      accessibilityLabel={libelle}
      accessibilityRole="button"
      onPress={() => setPlage((avant) => ({
        ...avant,
        dureeAutre: Math.min(DUREE_MAX, Math.max(DUREE_MIN, avant.dureeAutre + ajout)),
      }))}
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          borderColor: Colors.primary500, borderRadius: 14, borderWidth: 1, height: 44, width: 44,
        },
      ]}
    >
      <Text style={[Fonts.h4Black, Fonts.primary500]}>{signe}</Text>
    </TouchableOpacity>
  );

  // DT-2 G1 / G2 / G2 bis (ligne 09) — la semaine en bandes : une piste par jour, une bande par
  // plage, sur l'axe commun ; dans la feuille, la plage en cours en pointillé et une plage qu'elle
  // chevauche en rouge. Une couleur par plage (bleu, vert, ambre), « chevauche » écrit en toutes
  // lettres : la couleur ne dit jamais seule.
  const COULEURS_DES_PLAGES = [Colors.primary500, Colors.success500, Colors.warning400];
  const dessinDeLaSemaine = (
    /** @type {ReturnType<typeof bandesDeLaSemaine>} */ semaineEnBandes,
    /** @type {string} */ prefixe,
    /** @type {((rang: number) => void) | null} */ onBande,
  ) => {
    const { axe } = semaineEnBandes;
    const largeur = axe.fin - axe.debut;
    const position = (/** @type {number} */ minutes) => (
      `${((minutes - axe.debut) / largeur) * 100}%`
    );
    const reperes = [];
    for (let heure = axe.debut; heure <= axe.fin; heure += 4 * 60) reperes.push(heure);
    return (
      <View style={{ gap: 6 }} testID={prefixe}>
        {semaineEnBandes.jours.map(({ bandes, jour }) => (
          <View key={jour} style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
            <Text style={[Fonts.p4Bold, Fonts.neutral200, { width: 34 }]}>
              {`${nomDuJour(jour).charAt(0).toUpperCase()}${nomDuJour(jour).slice(1, 3)}`}
            </Text>
            <View
              style={{
                backgroundColor: withAlpha(Colors.primary700, 0.75),
                borderRadius: 6,
                flex: 1,
                height: 24,
              }}
            >
              {bandes.map((bande) => {
                const couleur = bande.rang === null
                  ? Colors.primary500
                  : COULEURS_DES_PLAGES[bande.rang % COULEURS_DES_PLAGES.length];
                let { texte } = bande;
                if (bande.fantome) texte = t('complexeGerant.creneaux.enCours', 'en cours');
                if (bande.conflit) texte = t('complexeGerant.creneaux.chevauche', 'chevauche');
                let suffixe = '';
                if (bande.fantome) suffixe = '-en-cours';
                else if (bande.conflit) suffixe = '-chevauche';
                const duRang = bande.rang === null ? '' : `-${bande.rang}`;
                const repere = `${prefixe}-${jour}${duRang}${suffixe}`;
                const style = {
                  backgroundColor: bande.fantome ? 'transparent' : couleur,
                  borderColor: couleur,
                  borderRadius: 6,
                  borderStyle: /** @type {'dashed' | 'solid'} */ (
                    bande.fantome ? 'dashed' : 'solid'
                  ),
                  borderWidth: bande.fantome ? 1.5 : 0,
                  bottom: 0,
                  justifyContent: /** @type {'center'} */ ('center'),
                  left: /** @type {any} */ (position(bande.debut)),
                  overflow: /** @type {'hidden'} */ ('hidden'),
                  paddingHorizontal: 4,
                  position: /** @type {'absolute'} */ ('absolute'),
                  top: 0,
                  width: /** @type {any} */ (`${((bande.fin - bande.debut) / largeur) * 100}%`),
                  ...(bande.conflit ? { backgroundColor: Colors.error500 } : {}),
                };
                const etiquette = (
                  <Text
                    numberOfLines={1}
                    style={[
                      Fonts.p4Bold,
                      bande.fantome || bande.conflit ? Fonts.neutral00 : Fonts.primary900,
                    ]}
                  >
                    {texte}
                  </Text>
                );
                const { rang } = bande;
                return onBande && rang !== null ? (
                  <TouchableOpacity
                    accessibilityLabel={t(
                      'complexeGerant.creneaux.modifierLaBande',
                      '{{jour}}, {{plage}} : modifier cette plage',
                      { jour: nomDuJour(jour), plage: bande.texte, ...SANS_ECHAPPEMENT },
                    )}
                    accessibilityRole="button"
                    key={repere}
                    onPress={() => onBande(rang)}
                    style={style}
                    testID={repere}
                  >
                    {etiquette}
                  </TouchableOpacity>
                ) : (
                  <View key={repere} style={style} testID={repere}>{etiquette}</View>
                );
              })}
            </View>
          </View>
        ))}
        <View style={[Alignments.row, { justifyContent: 'space-between', marginLeft: 42 }]}>
          {reperes.map((heure) => (
            <Text key={heure} style={[Fonts.p4, Fonts.neutral300]}>
              {texteHeure(heureDe(heure > 24 * 60 ? heure - 24 * 60 : heure))}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  if (!terrain) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[Alignments.fill, Alignments.justifyCenter]}
      >
        {terrainsLus.isLoading ? <Loader /> : (
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter]}>
            {t('complexeGerant.refus.terrainIntrouvable', 'Ce terrain est introuvable.')}
          </Text>
        )}
      </ScreenContainer>
    );
  }

  const prixDeBase = typeof terrain.basePrice === 'number' ? terrain.basePrice : null;
  const lignesDeBase = lignesDePrix(t, {
    basePrice: prixDeBase, capacity: terrain.capacity, priceUnit: terrain.priceUnit,
  });
  // DT-2 G3 : un onglet par durée quand une plage en propose plusieurs ; sinon la grille d'avant.
  const plusieursDurees = plan.ranges.some((range) => dureesDe(range).length > 1);
  const dureesDuTerrain = dureesDuPlan(plan);
  const ongletLu = dureesDuTerrain.includes(Number(ongletPrix))
    ? Number(ongletPrix)
    : dureesDuTerrain[0];
  const onglet = plusieursDurees ? ongletLu : null;
  const semaine = prixDeLaSemaineParDuree(plan, prixDeBase, onglet);
  const dureesDeLaSaisie = dureesSaisies(plage);
  const plageSaisie = plageDeLaSaisie(plage);
  // Une seule durée, départs « à la suite » : l'aperçu d'avant (« 6 créneaux de 1 h », le reste).
  const commeAvant = dureesDeLaSaisie.length === 1 && plage.departs === 'suite';
  const decoupe = decoupagePlage({
    durationMinutes: dureesDeLaSaisie[0] || 0, from: plage.de, to: plage.a,
  });
  const semaineEnBandes = bandesDeLaSemaine(plan.ranges);
  const enCoursValide = Boolean(plageSaisie.days.length && plageSaisie.durationMinutes);
  const semaineDeLaFeuille = bandesDeLaSemaine(plan.ranges, {
    enCours: enCoursValide ? plageSaisie : null,
    rangEnCours: plage.rang,
  });
  const chevauchement = enCoursValide
    ? plageQuiChevauche(plan.ranges, plageSaisie, plage.rang)
    : null;

  // Le résumé du serveur (`describeSlotPlan`) : les créneaux encore ouverts jusqu'à la fin de la
  // période quand elle a une fin, sinon les créneaux d'une semaine.
  let sommaire = '';
  if (typeof resume?.openSlots === 'number' && resume.openSlots > 0) {
    sommaire = t(
      'complexeGerant.creneaux.ouvertsPeriode',
      '{{nombre}} créneaux ouverts sur la période',
      { nombre: resume.openSlots, ...SANS_ECHAPPEMENT },
    );
  } else if (resume?.slotsPerWeek) {
    sommaire = t('complexeGerant.creneaux.parSemaine', '{{nombre}} créneaux par semaine', {
      nombre: resume.slotsPerWeek,
      ...SANS_ECHAPPEMENT,
    });
  }

  const libelleDuJourPonctuel = (/** @type {string} */ date) => {
    const [annee, mois, jour] = date.split('-').map(Number);
    const nom = new Date(annee, mois - 1, jour).toLocaleDateString(localeDesFormats(), {
      weekday: 'long',
    });
    return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${String(jour).padStart(2, '0')}/${
      String(mois).padStart(2, '0')}`;
  };

  // ── Les blocs ──────────────────────────────────────────────────────────────────────────
  const blocPlages = groupe(
    t('complexeGerant.creneaux.tesPlages', 'Tes plages'), (
      <>
        {plan.ranges.length ? plan.ranges.map((range, rang) => {
          const durees = dureesDe(range);
          const choisis = Array.isArray(range.starts) && range.starts.length > 0;
          const simple = durees.length === 1 && !choisis;
          const { reste } = simple ? decoupagePlage(range) : { reste: null };
          return ligne(
            `plage-${rang}`,
            joursTexte(range.days),
            [
              simple ? resumePlage(t, range) : resumeDesDurees(range),
              simple ? '' : texteDesDeparts(range),
              reste ? t(
                'complexeGerant.creneaux.reste',
                'De {{de}} à {{a}}, il reste {{duree}} sans créneau.',
                {
                  a: texteHeure(reste.to),
                  de: texteHeure(reste.from),
                  duree: texteDuree(reste.minutes),
                  ...SANS_ECHAPPEMENT,
                },
              ) : '',
            ],
            () => retirer('ranges', rang),
            () => ouvrirLaPlage(rang),
          );
        }) : aide(t('complexeGerant.creneaux.vide', 'Ce terrain n’a pas encore d’horaires.'))}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            icon="plus"
            onPress={nouvellePlage}
            size="sm"
            title={texteInsecable(t('complexeGerant.creneaux.ajouterPlage', 'Ajouter une plage'))}
            variant="Secondary"
          />
        </View>
      </>
    ),
  );

  const blocTarifs = groupe(
    t('complexeGerant.creneaux.tarifs', 'Tarifs'), (
      <>
        <View style={{ gap: 2 }}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('complexeGerant.creneaux.prixDeBase', 'Prix de base')}
          </Text>
          {aide(t('complexeGerant.creneaux.prixDeBaseDit', 'tous les créneaux sans autre tarif'))}
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {lignesDeBase
              ? lignesDeBase.principal
              : t(
                'complexeGerant.creneaux.sansPrixDeBase',
                'Aucun : fixe-le sur la fiche du terrain.',
              )}
          </Text>
        </View>
        {plan.rates.map((rate, rang) => {
          // COMPLEXE-TERRAINS (2) : un tarif posé sur des jours sans plage ne s'applique à
          // rien ; la semaine y montre « — » (fermé) : le tarif le dit.
          const sansPlage = rate.days.filter((/** @type {number} */ jour) => !plan.ranges
            .some((/** @type {any} */ range) => range.days.includes(jour)));
          const jours = joursTexte(sansPlage);
          return ligne(
            `tarif-${rang}`,
            joursTexte(rate.days),
            // RESA-FIN-APP : un terrain au prix PAR JOUEUR le dit sur la ligne (« 7 € » seul,
            // tournée 2).
            [resumeTarif(t, rate),
              typeof rate.durationMinutes === 'number' ? {
                accent: true,
                texte: t('complexeGerant.creneaux.pourDuree', 'Pour {{duree}}', {
                  duree: texteDuree(rate.durationMinutes), ...SANS_ECHAPPEMENT,
                }),
              } : '',
              terrain?.priceUnit === 'joueur'
                ? t('complexeGerant.prix.parJoueur', '{{prix}} par joueur', {
                  prix: formatEuros(rate.price), ...SANS_ECHAPPEMENT,
                })
                : formatEuros(rate.price),
              sansPlage.length ? t(
                'complexeGerant.creneaux.tarifSansPlage',
                'Aucune plage ouverte {{jours}} : ce tarif ne s’applique pas encore.',
                { jours: `${jours.charAt(0).toLowerCase()}${jours.slice(1)}`, ...SANS_ECHAPPEMENT },
              ) : ''],
            () => retirer('rates', rang),
          );
        })}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            icon="plus"
            onPress={() => setFeuille('tarif')}
            size="sm"
            title={texteInsecable(t('complexeGerant.creneaux.ajouterTarif', 'Ajouter un tarif'))}
            variant="Secondary"
          />
        </View>
        {aide(t(
          'complexeGerant.creneaux.plusPrecis',
          // eslint-disable-next-line max-len
          'Le tarif le plus précis l’emporte : jour et heure, puis jour, puis prix de base. Le mode « le créneau » ou « par joueur » se choisit sur la fiche du terrain.',
        ))}
        {/* DT-2 : le prix d'un créneau à cheval sur deux tarifs, au choix du gérant. */}
        <ChoiceChipGroup
          onSelect={(valeur) => {
            if (valeur === aCheval) return;
            setACheval(valeur === 'fin' ? 'fin' : 'debut');
            setModifie(true);
            setEnregistre(null);
          }}
          options={[
            { label: t('complexeGerant.creneaux.prixDuDebut', 'Prix du début'), value: 'debut' },
            { label: t('complexeGerant.creneaux.prixDeLaFin', 'Prix de la fin'), value: 'fin' },
          ]}
          selectedValue={aCheval}
          title={t('complexeGerant.creneaux.aCheval', 'Un créneau à cheval sur deux tarifs')}
        />
        {aide(aCheval === 'fin'
          ? t(
            'complexeGerant.creneaux.aChevalFin',
            // eslint-disable-next-line max-len
            'Il prend le prix de sa fin : 17 h – 19 h, sur deux tarifs, coûte le tarif de 18 h – 19 h.',
          )
          : t(
            'complexeGerant.creneaux.aChevalDebut',
            // eslint-disable-next-line max-len
            'Il prend le prix de son début : 17 h – 19 h, sur deux tarifs, coûte le tarif de 17 h – 18 h.',
          ))}
      </>
    ),
  );

  const titreSemaine = t('complexeGerant.creneaux.semaine', 'Les prix de la semaine');
  const unCalcul = semaine.some((tranche) => tranche.cases.some((valeur) => valeur?.calcule));
  const blocSemaine = semaine.length || plusieursDurees ? groupe(
    titreSemaine, (
      // RESA-FIN-APP (20/10) — les SEPT jours dans la largeur, sans glisser (tournée 1 : sam. et dim.
      // étaient hors de l'écran, rien ne l'indiquait ; 96 + 7 × 48 = 432 px dans ~308). Colonnes
      // souples (`flex: 1`) ; l'heure prend la largeur de son texte.
      // DT-2 G3 : un onglet par durée ; une case calculée au temps (281 A) est en italique et se
      // touche pour mettre son propre prix.
      <View style={{ gap: 6 }} testID="complexe-creneaux-semaine">
        {plusieursDurees ? (
          <ChoiceChipGroup
            onSelect={(valeur) => setOngletPrix(Number(valeur))}
            options={dureesDuTerrain.map((duree) => ({ label: texteDuree(duree), value: duree }))}
            selectedValue={onglet}
            title={t('complexeGerant.creneaux.dureeDesPrix', 'Durée des prix')}
          />
        ) : null}
        <View style={[Alignments.row, { gap: 2 }]}>
          <View style={{ width: 64 }} />
          {JOURS.map((jour) => (
            <Text
              key={jour}
              style={[Fonts.p4Bold, Fonts.primary200, Fonts.textCenter, { flex: 1 }]}
            >
              {nomDuJour(jour).slice(0, 3)}
            </Text>
          ))}
        </View>
        {semaine.map((tranche) => (
          <View key={`${tranche.de}-${tranche.a}`} style={[Alignments.row, { gap: 2 }]}>
            <Text style={[Fonts.p4, Fonts.neutral200, { width: 64 }]}>
              {`${texteHeure(tranche.de)} – ${texteHeure(tranche.a)}`}
            </Text>
            {tranche.cases.map((valeur, index) => {
              const jour = JOURS[index];
              const prix = valeur ? valeur.prix : null;
              const texte = (
                <Text
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[
                    Fonts.p4Bold,
                    prix === null ? Fonts.neutral300 : Fonts.neutral00,
                    Fonts.textCenter,
                    valeur?.calcule ? Fonts.italic : null,
                  ]}
                >
                  {prix === null ? '—' : formatEuros(prix)}
                </Text>
              );
              const repere = `complexe-creneaux-prix-${jour}-${tranche.de}`;
              return valeur?.calcule && onglet !== null ? (
                <TouchableOpacity
                  accessibilityLabel={t(
                    'complexeGerant.creneaux.personnaliser',
                    '{{jour}} {{de}} – {{a}}, {{prix}} calculé : mettre mon prix pour {{duree}}',
                    {
                      a: texteHeure(tranche.a),
                      de: texteHeure(tranche.de),
                      duree: texteDuree(onglet),
                      jour: nomDuJour(jour),
                      prix: formatEuros(Number(prix)),
                      ...SANS_ECHAPPEMENT,
                    },
                  )}
                  accessibilityRole="button"
                  key={jour}
                  onPress={() => personnaliser({
                    a: tranche.a, de: tranche.de, duree: Number(onglet), jour,
                  })}
                  style={[Alignments.justifyCenter, { flex: 1, minHeight: 32 }]}
                  testID={repere}
                >
                  {texte}
                </TouchableOpacity>
              ) : (
                <View key={jour} style={{ flex: 1 }} testID={repere}>{texte}</View>
              );
            })}
          </View>
        ))}
        {unCalcul && onglet !== null ? aide(t(
          'complexeGerant.creneaux.prixCalcule',
          // eslint-disable-next-line max-len
          'En italique : aucun tarif de {{duree}}, donc le prix au temps (à partir de {{base}}). Touche une case pour mettre ton propre prix.',
          {
            base: texteDuree(dureesDuTerrain[0]), duree: texteDuree(onglet), ...SANS_ECHAPPEMENT,
          },
        )) : null}
      </View>
    ),
  ) : null;

  const blocPeriode = groupe(
    t('complexeGerant.creneaux.periode', 'Période'), (
      <>
        <DatePickerInput
          label={t('complexeGerant.creneaux.du', 'Du')}
          onChange={(/** @type {string} */ saisie) => {
            const date = enDate(saisie);
            if (date) changerPeriode({ from: date });
          }}
          value={enSaisie(plan.period?.from)}
        />
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityState={{ checked: sansFin }}
          onPress={() => {
            const suivant = !sansFin;
            setSansFin(suivant);
            if (suivant) changerPeriode({ until: null });
          }}
          style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
        >
          <View
            style={{
              backgroundColor: sansFin ? Colors.primary500 : 'transparent',
              borderColor: Colors.primary500,
              borderRadius: 6,
              borderWidth: 2,
              height: 22,
              width: 22,
            }}
          />
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {t('complexeGerant.creneaux.sansFin', 'Sans date de fin')}
          </Text>
        </TouchableOpacity>
        {sansFin ? null : (
          <DatePickerInput
            label={t('complexeGerant.creneaux.au', 'Au')}
            onChange={(/** @type {string} */ saisie) => {
              const date = enDate(saisie);
              if (date) changerPeriode({ until: date });
            }}
            value={enSaisie(plan.period?.until)}
          />
        )}
      </>
    ),
  );

  const blocExceptions = groupe(
    t('complexeGerant.creneaux.exceptions', 'Exceptions'), (
      <>
        {plan.extraSlots.map((ponctuelLu, rang) => ligne(
          `ponctuel-${rang}`,
          t('complexeGerant.creneaux.ponctuelAjoute', '{{jour}} : {{de}} – {{a}} ajouté', {
            a: texteHeure(ponctuelLu.to),
            de: texteHeure(ponctuelLu.from),
            jour: libelleDuJourPonctuel(ponctuelLu.date),
            ...SANS_ECHAPPEMENT,
          }),
          [],
          () => retirer('extraSlots', rang),
        ))}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            icon="plus"
            onPress={() => setFeuille('ponctuel')}
            size="sm"
            title={texteInsecable(t('complexeGerant.creneaux.ajouterPonctuel', 'Ajouter un créneau ponctuel'))}
            variant="Secondary"
          />
        </View>
        {terrainId ? (
          <View style={[Alignments.row, Alignments.wrap, { gap: 12 }]}>
            {/* COMPLEXE-TERRAINS (8) : rien à fermer tant que le terrain n'est pas ouvert. */}
            {neuf ? null : (
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => navigation.navigate(RouteNames.ComplexeFermetures, {
                  complexeId, terrainId,
                })}
                style={[Alignments.justifyCenter, { minHeight: 44 }]}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {t('complexeReservations.planning.fermerDesJours', 'Fermer des jours')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="link"
              onPress={() => navigation.navigate(RouteNames.ComplexeEspace, {
                params: { complexeId, terrainId },
                screen: RouteNames.ComplexePlanning,
              })}
              style={[Alignments.justifyCenter, { minHeight: 44 }]}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {t('complexeReservations.installations.voirPlanning', 'Voir le planning')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </>
    ),
  );

  const lesJours = t('complexeGerant.creneaux.lesJours', 'Les jours');

  // ── Les feuilles ───────────────────────────────────────────────────────────────────────
  /**
   * DT-2 — une puce de durée cochée ou décochée ; « Autre » prend la plus courte des durées cochées
   * comme point de départ (puis ± 1 h, ± 5 min), comme l'« Autre » d'avant.
   * @param {number | string} valeur - La durée, ou « autre ».
   */
  const basculerDuree = (valeur) => {
    if (valeur === 'autre') {
      if (plage.autre) {
        setPlage({ ...plage, autre: false });
        return;
      }
      const depart = plage.durees.length ? Math.min(...plage.durees) : 60;
      setPlage({
        ...plage,
        autre: true,
        dureeAutre: depart,
        durees: plage.durees.filter((duree) => duree !== depart),
      });
      return;
    }
    const duree = Number(valeur);
    setPlage({
      ...plage,
      durees: plage.durees.includes(duree)
        ? plage.durees.filter((autre) => autre !== duree)
        : [...plage.durees, duree],
    });
  };
  const plusCourteSaisie = dureesDeLaSaisie[0] || 0;
  const heuresSaisies = { from: plage.de, to: plage.a };
  // « Je choisis » : une puce par demi-heure (et les départs déjà choisis hors de ce pas).
  const departsAuChoix = (() => {
    const demi = departsReguliers(heuresSaisies, 30, plusCourteSaisie);
    const tous = departsReguliers(heuresSaisies, 5, plusCourteSaisie);
    return tous.filter((heure) => demi.includes(heure) || plage.choisis.includes(heure));
  })();
  const offres = offresDeLaPlage(plageSaisie);
  const unDepartTropTard = offres.length > 1
    && offres.some((offre) => offre.nombre < offres[0].nombre);
  const pastille = (/** @type {string} */ texte, /** @type {boolean} */ allume) => (
    <View
      key={texte}
      style={{
        backgroundColor: allume ? withAlpha(Colors.primary500, 0.22) : 'transparent',
        borderColor: allume ? Colors.primary500 : withAlpha(Colors.primary500, 0.24),
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 32,
        paddingHorizontal: 12,
      }}
    >
      <Text style={[Fonts.p4Bold, Fonts.neutral00]}>{texteInsecable(texte)}</Text>
    </View>
  );
  const plageEnCours = plage.rang === null ? null : plan.ranges[plage.rang];
  const lettreDuJour = (/** @type {number} */ jour) => nomDuJour(jour).charAt(0).toUpperCase();
  const feuillePlage = (
    <View style={{ gap: 16 }}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {plageEnCours
          ? t('complexeGerant.creneaux.plageDu', 'Plage du {{jours}}', {
            jours: `${joursTexte(plageEnCours.days).charAt(0).toLowerCase()}${
              joursTexte(plageEnCours.days).slice(1)}`,
            ...SANS_ECHAPPEMENT,
          })
          : t('complexeGerant.creneaux.nouvellePlage', 'Nouvelle plage')}
      </Text>
      {/* DT-2 G2 (ligne 09) : la semaine reste visible pendant la saisie. */}
      {plan.ranges.length || enCoursValide
        ? dessinDeLaSemaine(semaineDeLaFeuille, 'complexe-creneaux-feuille-bande', null)
        : null}
      {chevauchement ? (
        <BandeauComplexe
          testID="complexe-creneaux-chevauchement"
          texte={t(
            'complexeGerant.creneaux.chevauchement',
            // eslint-disable-next-line max-len
            '{{jour}}, cette plage chevauche « {{plage}} ». Décoche {{lettre}}, ou change les heures.',
            {
              jour: `${nomDuJour(chevauchement.jour).charAt(0).toUpperCase()}${
                nomDuJour(chevauchement.jour).slice(1)}`,
              lettre: lettreDuJour(chevauchement.jour),
              plage: `${joursTexte(plan.ranges[chevauchement.rang].days)}, ${
                texteHeure(plan.ranges[chevauchement.rang].from)} – ${
                texteHeure(plan.ranges[chevauchement.rang].to)}`,
              ...SANS_ECHAPPEMENT,
            },
          )}
          ton="erreur"
        />
      ) : null}
      <Text style={[Fonts.p2Bold, Fonts.neutral100]}>{lesJours}</Text>
      {choixDesJours(
        plage.jours,
        (jours) => setPlage({ ...plage, jours }),
        'complexe-creneaux-jour',
      )}
      <TimePickerInput
        label={t('complexeGerant.creneaux.ouverture', 'Ouverture')}
        onChange={(/** @type {string} */ valeur) => setPlage({ ...plage, de: String(valeur) })}
        value={plage.de}
      />
      <TimePickerInput
        label={t('complexeGerant.creneaux.fermeture', 'Fermeture')}
        onChange={(/** @type {string} */ valeur) => setPlage({ ...plage, a: String(valeur) })}
        value={plage.a}
      />
      {/* DT-2 G2 (280 A) : plusieurs durées par plage, mêmes boutons qu'avant. */}
      <ChoiceChipGroup
        onSelect={basculerDuree}
        options={[
          ...DUREES.map((duree) => ({ label: texteDuree(duree), value: duree })),
          { label: t('complexeGerant.creneaux.autre', 'Autre'), value: 'autre' },
        ]}
        selectedValues={[...plage.durees, ...(plage.autre ? ['autre'] : [])]}
        title={t('complexeGerant.creneaux.durees', 'Durées proposées')}
      />
      {plage.autre ? (
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 12 }]}>
          {pas(t('complexeGerant.creneaux.moinsUneHeure', 'Retirer 1 heure'), '-', -60)}
          {pas(t('complexeGerant.creneaux.plusUneHeure', 'Ajouter 1 heure'), '+', 60)}
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>{texteDuree(plage.dureeAutre)}</Text>
          {pas(t('complexeGerant.creneaux.moinsCinq', 'Retirer 5 minutes'), '-', -5)}
          {pas(t('complexeGerant.creneaux.plusCinq', 'Ajouter 5 minutes'), '+', 5)}
        </View>
      ) : null}
      {/* DT-2 G2 / G2 bis : les départs ; « À la suite » = la règle d'avant (par défaut). */}
      <ChoiceChipGroup
        onSelect={(valeur) => setPlage({
          ...plage,
          choisis: valeur === 'choix' && !plage.choisis.length
            ? departsAuChoix.filter((heure) => (plageSaisie.starts || []).includes(heure))
            : plage.choisis,
          departs: valeur,
        })}
        options={[
          { label: t('complexeGerant.creneaux.departsSuite', 'À la suite'), value: 'suite' },
          {
            label: t('complexeGerant.creneaux.departsToutesLesHeures', 'Toutes les heures'),
            value: 'heure',
          },
          {
            label: t('complexeGerant.creneaux.departsToutesLes30', 'Toutes les 30 min'),
            value: 'demi',
          },
          { label: t('complexeGerant.creneaux.departsJeChoisis', 'Je choisis'), value: 'choix' },
        ]}
        selectedValue={plage.departs}
        title={t('complexeGerant.creneaux.departs', 'Départs')}
      />
      {plage.departs === 'choix' ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {departsAuChoix.map((heure) => {
            const coche = plage.choisis.includes(heure);
            return (
              <TouchableOpacity
                accessibilityLabel={t('complexeGerant.creneaux.departDe', 'Départ de {{heure}}', {
                  heure: texteHeure(heure), ...SANS_ECHAPPEMENT,
                })}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: coche }}
                key={heure}
                onPress={() => setPlage({
                  ...plage,
                  choisis: coche
                    ? plage.choisis.filter((autre) => autre !== heure)
                    : [...plage.choisis, heure],
                })}
                style={{ justifyContent: 'center', minHeight: 44 }}
              >
                {pastille(texteHeure(heure), coche)}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      {plage.departs === 'heure' || plage.departs === 'demi' ? (
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {(plageSaisie.starts || []).map((/** @type {string} */ heure) => (
            pastille(texteHeure(heure), true)
          ))}
        </View>
      ) : null}
      {commeAvant && decoupe.nombre ? (
        <View style={{ gap: 4 }} testID="complexe-creneaux-decoupe">
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('complexeGerant.creneaux.nCreneauxDe', '{{nombre}} créneaux de {{duree}}', {
              duree: texteDuree(dureesDeLaSaisie[0]),
              nombre: decoupe.nombre,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
          {aide(decoupe.debuts.map((debut) => texteHeure(debut)).join(' · '))}
          {decoupe.reste ? aide(t(
            'complexeGerant.creneaux.reste',
            'De {{de}} à {{a}}, il reste {{duree}} sans créneau.',
            {
              a: texteHeure(decoupe.reste.to),
              de: texteHeure(decoupe.reste.from),
              duree: texteDuree(decoupe.reste.minutes),
              ...SANS_ECHAPPEMENT,
            },
          )) : null}
        </View>
      ) : null}
      {!commeAvant && offres.length ? (
        // DT-2 G2 : « Ce que verront les joueurs », une ligne par durée.
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary700, 0.45),
            borderColor: withAlpha(Colors.primary500, 0.24),
            borderRadius: 16,
            borderWidth: 1,
            gap: 4,
            padding: 12,
          }}
          testID="complexe-creneaux-offres"
        >
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
            {t('complexeGerant.creneaux.ceQueVerront', 'Ce que verront les joueurs').toUpperCase()}
          </Text>
          {offres.map((offre) => (
            <Text key={offre.duree} style={[Fonts.p3, Fonts.neutral00]}>
              {t(
                'complexeGerant.creneaux.offre',
                '{{duree}} : {{nombre}} créneaux, de {{premier}} à {{dernier}}',
                {
                  dernier: `${texteHeure(offre.dernier.de)} – ${texteHeure(offre.dernier.a)}`,
                  duree: texteDuree(offre.duree),
                  nombre: offre.nombre,
                  premier: `${texteHeure(offre.premier.de)} – ${texteHeure(offre.premier.a)}`,
                  ...SANS_ECHAPPEMENT,
                },
              )}
            </Text>
          ))}
          {unDepartTropTard ? aide(t(
            'complexeGerant.creneaux.departTropTard',
            'Un départ trop tard pour une durée ne la propose pas.',
          )) : null}
        </View>
      ) : null}
    </View>
  );

  const parJoueur = lirePrix(tarif.prix);
  const indiceParJoueur = terrain.priceUnit !== 'joueur' && Number(terrain.capacity) > 0
    && typeof parJoueur === 'number'
    ? t('complexeGerant.creneaux.soitParJoueur', 'Soit {{prix}} par joueur à {{joueurs}}.', {
      joueurs: terrain.capacity,
      prix: formatEuros(Math.round((parJoueur / Number(terrain.capacity)) * 100) / 100),
      ...SANS_ECHAPPEMENT,
    })
    : '';
  const feuilleTarif = (
    <View style={{ gap: 16 }}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('complexeGerant.creneaux.nouveauTarif', 'Nouveau tarif')}
      </Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral100]}>{lesJours}</Text>
      {choixDesJours(
        tarif.jours,
        (jours) => setTarif({ ...tarif, jours }),
        'complexe-creneaux-tarif-jour',
      )}
      <ChoiceChipGroup
        onSelect={(valeur) => setTarif({ ...tarif, heures: valeur === 'heures' })}
        options={[
          {
            label: t('complexeGerant.creneaux.touteLaJourneeChoix', 'Toute la journée'),
            value: 'jour',
          },
          { label: t('complexeGerant.creneaux.deAChoix', 'De … à …'), value: 'heures' },
        ]}
        selectedValue={tarif.heures ? 'heures' : 'jour'}
        title={t('complexeGerant.creneaux.lesHeures', 'Les heures')}
      />
      {/* DT-2 G3 bis : « Pour quelle durée », seulement si une plage en propose plusieurs. */}
      {plusieursDurees || tarif.duree > 0 ? (
        <ChoiceChipGroup
          onSelect={(valeur) => setTarif({ ...tarif, duree: Number(valeur) })}
          options={[
            { label: t('complexeGerant.creneaux.toutesDurees', 'Toutes'), value: 0 },
            ...dureesDuTerrain.map((duree) => ({ label: texteDuree(duree), value: duree })),
          ]}
          selectedValue={tarif.duree}
          title={t('complexeGerant.creneaux.pourQuelleDuree', 'Pour quelle durée')}
        />
      ) : null}
      {tarif.heures ? (
        <>
          <TimePickerInput
            label={t('complexeGerant.creneaux.de', 'De')}
            onChange={(/** @type {string} */ valeur) => setTarif({ ...tarif, de: String(valeur) })}
            value={tarif.de}
          />
          <TimePickerInput
            label={t('complexeGerant.creneaux.a', 'À')}
            onChange={(/** @type {string} */ valeur) => setTarif({ ...tarif, a: String(valeur) })}
            value={tarif.a}
          />
        </>
      ) : null}
      <Input
        keyboardType="decimal-pad"
        label={t('complexeGerant.creneaux.prix', 'Prix')}
        onChangeText={(prix) => setTarif({ ...tarif, prix })}
        value={tarif.prix}
      />
      {indiceParJoueur ? aide(indiceParJoueur) : null}
    </View>
  );

  const feuillePonctuel = (
    <View style={{ gap: 16 }}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('complexeGerant.creneaux.ajouterPonctuel', 'Ajouter un créneau ponctuel')}
      </Text>
      <DatePickerInput
        label={t('complexeGerant.creneaux.date', 'Date')}
        onChange={(/** @type {string} */ saisie) => setPonctuel({
          ...ponctuel, date: String(saisie),
        })}
        value={ponctuel.date}
      />
      <TimePickerInput
        label={t('complexeGerant.creneaux.de', 'De')}
        onChange={(/** @type {string} */ valeur) => setPonctuel({
          ...ponctuel, de: String(valeur),
        })}
        value={ponctuel.de}
      />
      <TimePickerInput
        label={t('complexeGerant.creneaux.a', 'À')}
        onChange={(/** @type {string} */ valeur) => setPonctuel({ ...ponctuel, a: String(valeur) })}
        value={ponctuel.a}
      />
    </View>
  );

  let contenuDeLaFeuille = null;
  let validation = null;
  if (feuille === 'plage') {
    contenuDeLaFeuille = feuillePlage;
    // DT-2 G2 : une plage rouverte se « Valide » à sa place.
    const libelle = plage.rang === null
      ? t('complexeGerant.creneaux.ajouterLaPlage', 'Ajouter la plage')
      : t('complexeGerant.creneaux.validerLaPlage', 'Valider la plage');
    validation = { action: ajouterLaPlage, libelle, titre: libelle };
  } else if (feuille === 'tarif') {
    contenuDeLaFeuille = feuilleTarif;
    validation = {
      action: ajouterLeTarif,
      libelle: t('complexeGerant.creneaux.ajouterLeTarif', 'Ajouter le tarif'),
      titre: t('complexeGerant.creneaux.ajouterLeTarif', 'Ajouter le tarif'),
    };
  } else if (feuille === 'ponctuel') {
    contenuDeLaFeuille = feuillePonctuel;
    validation = {
      action: ajouterLePonctuel,
      libelle: t('complexeGerant.creneaux.ajouterLePonctuel', 'Ajouter le créneau ponctuel'),
      titre: t('complexeGerant.creneaux.ajouter', 'Ajouter'),
    };
  }

  const echu = resume?.status === 'echu';

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: 720,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
          >
            {String(terrain.name || '').toUpperCase()}
          </Text>
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
            {t('complexeGerant.creneaux.titre', 'Créneaux et tarifs').toUpperCase()}
          </Text>
        </View>
        {params?.terrainAjoute && neuf ? (
          <BandeauComplexe
            texte={t(
              'complexeGerant.creneaux.terrainAjoute',
              '{{nom}} est ajouté. Ouvre maintenant ses créneaux.',
              { nom: params.terrainAjoute, ...SANS_ECHAPPEMENT },
            )}
            ton="ok"
          />
        ) : null}
        {modifie ? (
          <BandeauComplexe
            testID="complexe-creneaux-non-enregistre"
            texte={t(
              'complexeGerant.creneaux.nonEnregistre',
              'Pas encore enregistré : appuie sur « {{bouton}} » en bas de la page.',
              {
                bouton: neuf
                  ? t('complexeGerant.creneaux.ouvrir', 'Ouvrir ces créneaux')
                  : t('complexeGerant.terrain.enregistrer', 'Enregistrer'),
                ...SANS_ECHAPPEMENT,
              },
            )}
            ton="attention"
          />
        ) : null}
        {terrain.bookingMode === 'telephone' ? (
          <BandeauComplexe
            texte={t(
              'complexeGerant.creneaux.telephone',
              // eslint-disable-next-line max-len
              'Ce terrain se réserve par téléphone : tes créneaux s’affichent, et un joueur qui en touche un t’appelle.',
            )}
            ton="info"
          />
        ) : null}
        {echu ? (
          <BandeauComplexe
            action={t('complexeGerant.creneaux.prolonger', 'Prolonger la période')}
            onAction={() => {
              setSansFin(true);
              changerPeriode({ until: null });
            }}
            texte={t(
              'complexeGerant.creneaux.echu',
              'Ces créneaux ne sont plus ouverts depuis le {{date}}.',
              { date: enSaisie(plan.period?.until), ...SANS_ECHAPPEMENT },
            )}
            ton="attention"
          />
        ) : null}
        {plan.ranges.length ? groupe(
          // DT-2 G1 (ligne 09) : la semaine en un coup d'œil ; toucher une bande rouvre sa plage.
          t('complexeGerant.creneaux.laSemaine', 'La semaine'), (
            <>
              {dessinDeLaSemaine(semaineEnBandes, 'complexe-creneaux-bande', ouvrirLaPlage)}
              {aide(t(
                'complexeGerant.creneaux.toucheUneBande',
                'Touche une bande pour modifier sa plage.',
              ))}
            </>
          ),
        ) : null}
        {blocPlages}
        {blocTarifs}
        {blocSemaine}
        {blocPeriode}
        {blocExceptions}
        {refusPlan ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refusPlan}</Text>
        ) : null}
        {sommaire ? <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{sommaire}</Text> : null}
        {horsHoraires > 0 ? (
          <BandeauComplexe
            testID="complexe-creneaux-hors-horaires"
            texte={t(
              'complexeGerant.creneaux.horsHoraires',
              '{{count}} réservations tombent hors de tes nouveaux horaires. Elles sont gardées.',
              {
                count: horsHoraires,
                defaultValue_one:
                  '{{count}} réservation tombe hors de tes nouveaux horaires. Elle est gardée.',
                defaultValue_other:
                  // eslint-disable-next-line max-len
                  '{{count}} réservations tombent hors de tes nouveaux horaires. Elles sont gardées.',
                ...SANS_ECHAPPEMENT,
              },
            )}
            ton="attention"
          />
        ) : null}
        {enregistre ? (
          <BandeauComplexe
            texte={typeof enregistre.openSlots === 'number' && enregistre.openSlots > 0
              ? t('complexeGerant.creneaux.ouverts', '{{nombre}} créneaux ouverts.', {
                nombre: enregistre.openSlots,
                ...SANS_ECHAPPEMENT,
              })
              : t('complexeGerant.creneaux.enregistres', 'Créneaux enregistrés.')}
            ton="ok"
          />
        ) : null}
        {refus ? (
          <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>{refus}</Text>
        ) : null}
        <Button
          disabled={Boolean(enregistrer.isPending || apercu.isPending)}
          isLoading={Boolean(enregistrer.isPending)}
          onPress={enregistrerLesCreneaux}
          title={neuf
            ? t('complexeGerant.creneaux.ouvrir', 'Ouvrir ces créneaux')
            : t('complexeGerant.terrain.enregistrer', 'Enregistrer')}
          variant="Primary"
        />
      </ScrollView>

      <BottomModal close={fermerLaFeuille} isVisible={Boolean(feuille)} webPresentation="dialog">
        <View style={{ gap: 16 }}>
          {contenuDeLaFeuille}
          {refusFeuille ? (
            <Text accessibilityRole="alert" style={[Fonts.p2Bold, Fonts.error300]}>
              {refusFeuille}
            </Text>
          ) : null}
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={fermerLaFeuille}
                title={t('complexeGerant.creneaux.annuler', 'Annuler')}
                variant="Ghost"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                accessibilityLabel={validation?.libelle}
                isLoading={Boolean(apercu.isPending)}
                onPress={validation?.action}
                title={validation?.titre}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexeCreneaux;
