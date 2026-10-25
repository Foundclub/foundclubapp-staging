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
  joursTexte,
  lignesDePrix,
  minutesDe,
  prixDeLaSemaine,
  resumePlage,
  resumeTarif,
  texteDuree,
  texteHeure,
} from '@/domains/complexe/complexeTerrain';
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
  const [plage, setPlage] = useState({
    a: '23:00', autre: false, de: '17:00', duree: 60, jours: /** @type {number[]} */ ([]),
  });
  const [tarif, setTarif] = useState({
    a: '22:00', de: '18:00', heures: false, jours: /** @type {number[]} */ ([]), prix: '',
  });
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
      const corps = await apercu.mutateAsync({ complexeId, plan: candidat, terrainId });
      setPlan(corps?.data?.slotPlan || candidat);
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
    if (debut === null || fin === null || fin <= debut) {
      setRefusFeuille(t(
        'complexeGerant.creneaux.finAvantDebut',
        'La fin doit être après le début.',
      ));
      return;
    }
    const nouvelle = {
      days: [...plage.jours].sort((a, b) => a - b),
      durationMinutes: plage.duree,
      from: plage.de,
      to: plage.a,
    };
    const candidat = { ...plan, ranges: [...plan.ranges, nouvelle] };
    const accepte = await jugerEtGarder(candidat, setRefusFeuille);
    if (accepte) fermerLaFeuille();
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
    const nouveau = tarif.heures
      ? {
        days: jours, from: tarif.de, price: prix, to: tarif.a,
      }
      : { days: jours, price: prix };
    const candidat = { ...plan, rates: [...plan.rates, nouveau] };
    const accepte = await jugerEtGarder(candidat, setRefusFeuille);
    if (accepte) fermerLaFeuille();
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

  const enregistrerLesCreneaux = async () => {
    setRefus('');
    setEnregistre(null);
    try {
      const corps = await enregistrer.mutateAsync({ complexeId, plan, terrainId });
      const creneaux = corps?.data?.creneaux || null;
      setResume(creneaux);
      setEnregistre(creneaux || {});
      setNeuf(false);
      setHorsHoraires(0);
    } catch (erreur) {
      setRefus(messageDeRefus(
        t,
        erreur,
        t('complexeGerant.creneaux.echec', 'Les créneaux ne sont pas partis. Réessaie.'),
      ));
    }
  };

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
  const ligne = (
    /** @type {string} */ cle,
    /** @type {string} */ titre,
    /** @type {string[]} */ details,
    /** @type {() => void} */ onRetirer,
  ) => (
    <View key={cle} style={[Alignments.row, { alignItems: 'flex-start', gap: 8 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        {details.filter(Boolean).map((detail) => (
          <Text key={detail} style={[Fonts.p3, Fonts.neutral200]}>{detail}</Text>
        ))}
      </View>
      {retirerLe(titre, onRetirer)}
    </View>
  );
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
        duree: Math.min(DUREE_MAX, Math.max(DUREE_MIN, avant.duree + ajout)),
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
  const semaine = prixDeLaSemaine(plan, prixDeBase);
  const decoupe = decoupagePlage({ durationMinutes: plage.duree, from: plage.de, to: plage.a });

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
          const { reste } = decoupagePlage(range);
          return ligne(
            `plage-${rang}`,
            joursTexte(range.days),
            [
              resumePlage(t, range),
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
          );
        }) : aide(t('complexeGerant.creneaux.vide', 'Ce terrain n’a pas encore d’horaires.'))}
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            icon="plus"
            onPress={() => setFeuille('plage')}
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
        {plan.rates.map((rate, rang) => ligne(
          `tarif-${rang}`,
          joursTexte(rate.days),
          // RESA-FIN-APP : un terrain au prix PAR JOUEUR le dit sur la ligne (« 7 € » seul, tournée 2).
          [resumeTarif(t, rate), terrain?.priceUnit === 'joueur'
            ? t('complexeGerant.prix.parJoueur', '{{prix}} par joueur', {
              prix: formatEuros(rate.price), ...SANS_ECHAPPEMENT,
            })
            : formatEuros(rate.price)],
          () => retirer('rates', rang),
        ))}
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
      </>
    ),
  );

  const titreSemaine = t('complexeGerant.creneaux.semaine', 'Les prix de la semaine');
  const blocSemaine = semaine.length ? groupe(
    titreSemaine, (
      // RESA-FIN-APP (20/10) — les SEPT jours dans la largeur, sans glisser (tournée 1 : sam. et dim.
      // étaient hors de l'écran, rien ne l'indiquait ; 96 + 7 × 48 = 432 px dans ~308). Colonnes
      // souples (`flex: 1`) ; l'heure prend la largeur de son texte.
      <View style={{ gap: 6 }} testID="complexe-creneaux-semaine">
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
            {tranche.prix.map((valeur, index) => (
              <Text
                adjustsFontSizeToFit
                key={JOURS[index]}
                numberOfLines={1}
                style={[
                  Fonts.p4Bold,
                  valeur === null ? Fonts.neutral300 : Fonts.neutral00,
                  Fonts.textCenter,
                  { flex: 1 },
                ]}
              >
                {valeur === null ? '—' : formatEuros(valeur)}
              </Text>
            ))}
          </View>
        ))}
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
  const feuillePlage = (
    <View style={{ gap: 16 }}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('complexeGerant.creneaux.nouvellePlage', 'Nouvelle plage')}
      </Text>
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
      <ChoiceChipGroup
        onSelect={(valeur) => (valeur === 'autre'
          ? setPlage({ ...plage, autre: true })
          : setPlage({ ...plage, autre: false, duree: Number(valeur) }))}
        options={[
          ...DUREES.map((duree) => ({ label: texteDuree(duree), value: duree })),
          { label: t('complexeGerant.creneaux.autre', 'Autre'), value: 'autre' },
        ]}
        selectedValue={plage.autre ? 'autre' : plage.duree}
        title={t('complexeGerant.creneaux.duree', 'Durée d’un créneau')}
      />
      {plage.autre ? (
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 12 }]}>
          {pas(t('complexeGerant.creneaux.moinsUneHeure', 'Retirer 1 heure'), '-', -60)}
          {pas(t('complexeGerant.creneaux.plusUneHeure', 'Ajouter 1 heure'), '+', 60)}
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>{texteDuree(plage.duree)}</Text>
          {pas(t('complexeGerant.creneaux.moinsCinq', 'Retirer 5 minutes'), '-', -5)}
          {pas(t('complexeGerant.creneaux.plusCinq', 'Ajouter 5 minutes'), '+', 5)}
        </View>
      ) : null}
      {decoupe.nombre ? (
        <View style={{ gap: 4 }} testID="complexe-creneaux-decoupe">
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('complexeGerant.creneaux.nCreneauxDe', '{{nombre}} créneaux de {{duree}}', {
              duree: texteDuree(plage.duree),
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
    validation = {
      action: ajouterLaPlage,
      libelle: t('complexeGerant.creneaux.ajouterLaPlage', 'Ajouter la plage'),
      titre: t('complexeGerant.creneaux.ajouterLaPlage', 'Ajouter la plage'),
    };
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
