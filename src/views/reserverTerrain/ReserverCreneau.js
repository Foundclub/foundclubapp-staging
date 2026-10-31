import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { libelleSport } from '@/domains/complexe/complexeTerrain';
import {
  ajouterJours,
  contenuDEchec,
  jourDeParis,
  libelleEtatDuCreneau,
  numeroLisible,
  parametresDEchec,
  prixDuCreneau,
  quatorzeJours,
  texteCreneau,
  texteJourCourt,
  texteJourLong,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import FeuilleTelephone from '@/views/reserverTerrain/components/FeuilleTelephone';

import { RouteNames } from '@/navigation/routeNames';

import {
  useApercuDeReservation,
  useComplexePublic,
  useCreneauxDuJour,
  useTerrainsPublics,
} from '@/services/complexe/complexeJoueurQueries';

import texteInsecable from '@/utils/texteInsecable';

import { isBirthdateUnderAge } from '@/constants/parentalDeclaration';
import { useIsDesktop } from '@/responsive';

const COLONNE = 560;
const JOUR = 56;

/**
 * E-P03 — « CHOISIR UN CRÉNEAU » — RESA-L6A (14/10/2026), planche EP03 et P00 bloc 3, plan E-P03.
 * Le calendrier d'un terrain sur 14 jours (l'écran de départ, BookingCalendar.js, est mort) :
 *   · l'en-tête « TERRAIN 1 » et « Le Five de Montrivage · Foot à 5 » ;
 *   · la bande de 14 jours (un jour déjà lu sans créneau libre est en pointillé) ;
 *   · les créneaux du jour : libre, choisi, pris (il ne se touche pas — le joueur ne voit
 *     jamais qui ni pourquoi, D7), trop tard ici (la feuille d'appel), fermé ; un jour tout fermé
 *     le dit ;
 *   · le prix indicatif (« 60 € le créneau, à régler sur place », D4), le rappel du mode ;
 *   · le pied « Mercredi 14/10 · 18 h – 19 h » et « Continuer ».
 * « Continuer » demande le récapitulatif au serveur (`dryRun` : âge, bannissement, plafond, créneau
 * libre, délai minimum) : accepté ⇒ E-P04 avec sa réponse ; pris entre-temps ⇒ bandeau et choix
 * vidé ; trop tard ⇒ la feuille d'appel ; refus nommé ⇒ E-P13. Un terrain « par téléphone » :
 * toucher un créneau ouvre la feuille E-P06 (A-G24), rien ne part au serveur.
 * Ordinateur (OR3, gabarit B) : la colonne centrée de 560 px. Paramètres : `slug`, `terrainId`,
 * `date`, `from` (le créneau déjà choisi par la page ou la recherche). Caché par COMPLEXES_JOUEUR.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverCreneau() {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  /** @type {{ date?: string, from?: string, slug?: string, terrainId?: string }} */
  const params = /** @type {any} */ (route?.params) || {};
  const { slug, terrainId } = params;
  const surOrdinateur = useIsDesktop();
  const aujourdhui = jourDeParis();
  const jours = quatorzeJours(t, aujourdhui);
  const dernierJour = jours[jours.length - 1].date;

  const [date, setDate] = useState(
    params.date && params.date >= aujourdhui && params.date <= dernierJour
      ? params.date
      : aujourdhui,
  );
  const [choisi, setChoisi] = useState(/** @type {string | null} */ (params.from || null));
  const [bandeau, setBandeau] = useState(/** @type {string | null} */ (null));
  const [tropTard, setTropTard] = useState(
    /** @type {{ creneau: any, telephone: string } | null} */ (null),
  );
  const [feuille, setFeuille] = useState(
    /** @type {{ creneau: any, telephone: any } | null} */ (null),
  );
  const [joursSansLibre, setJoursSansLibre] = useState(() => new Set());

  const { userData } = useAuth();
  const complexe = useComplexePublic(slug)?.data;
  // CORR-RESA (78 A) : un joueur plus jeune que l'âge du complexe le lit AVANT de choisir un
  // créneau
  // (le serveur refusait seulement au bout du parcours).
  const ageMinimum = Number(complexe?.rules?.minAge) || null;
  const naissance = /** @type {any} */ (userData)?.birthdate;
  const tropJeune = Boolean(ageMinimum && naissance && isBirthdateUnderAge(naissance, ageMinimum));
  const terrains = useTerrainsPublics(slug)?.data;
  const lecture = useCreneauxDuJour(slug, terrainId, date);
  const apercu = useApercuDeReservation();

  const terrainPublic = (Array.isArray(terrains) ? terrains : []).find(
    (/** @type {any} */ terrain) => terrain?.documentId === terrainId,
  ) || null;
  const terrain = { ...(terrainPublic || {}), ...(lecture?.data?.terrain || {}) };
  const creneaux = Array.isArray(lecture?.data?.slots) ? lecture.data.slots : [];
  const libres = creneaux.filter((/** @type {any} */ creneau) => creneau?.state === 'libre');
  const parTelephone = terrain?.bookingMode === 'telephone';
  const creneauChoisi = creneaux.find(
    (/** @type {any} */ creneau) => creneau.from === choisi && creneau.state === 'libre',
  ) || null;
  const telephoneDuComplexe = String(complexe?.phoneNumber || '').trim();

  useEffect(() => {
    if (!lecture?.data || lecture?.isLoading) return;
    setJoursSansLibre((avant) => {
      const sansLibre = !libres.length;
      if (avant.has(date) === sansLibre) return avant;
      const apres = new Set(avant);
      if (sansLibre) apres.add(date);
      else apres.delete(date);
      return apres;
    });
  }, [date, lecture?.data, lecture?.isLoading, libres.length]);

  const changerDeJour = (/** @type {string} */ nouveau) => {
    setDate(nouveau);
    setChoisi(null);
    setBandeau(null);
  };

  const toucherUnCreneau = (/** @type {any} */ creneau) => {
    setBandeau(null);
    if (creneau.state === 'trop-tard') {
      setTropTard({ creneau, telephone: telephoneDuComplexe });
      return;
    }
    if (creneau.state !== 'libre') return;
    if (parTelephone) {
      setFeuille({ creneau: { ...creneau, date }, telephone: terrain?.phone || null });
      return;
    }
    setChoisi(creneau.from);
  };

  const continuer = async () => {
    if (!creneauChoisi) return;
    setBandeau(null);
    const demande = { date, from: creneauChoisi.from, terrain: String(terrainId) };
    try {
      const reponse = await apercu.mutateAsync(demande);
      navigation.navigate(RouteNames.ReserverRecapitulatif, {
        apercu: reponse,
        date,
        from: creneauChoisi.from,
        slug,
        terrainId,
      });
    } catch (erreur) {
      const variante = varianteDEchec(erreur);
      if (variante === 'pris') {
        setBandeau(
          t(
            'reserverTerrain.creneau.prisPendantLeChoix',
            'Ce créneau vient d’être pris. Choisis-en un autre.',
          ),
        );
        setChoisi(null);
        lecture?.refetch?.();
        return;
      }
      if (variante === 'reseau' || variante === 'panne') {
        setBandeau(contenuDEchec(t, variante).titre);
        return;
      }
      const contenu = contenuDEchec(t, variante, { erreur, telephone: telephoneDuComplexe });
      if (variante === 'tropTard') {
        setTropTard({
          creneau: creneauChoisi,
          telephone: contenu.telephone || telephoneDuComplexe,
        });
        return;
      }
      if (variante === 'telephone') {
        setFeuille({
          creneau: { ...creneauChoisi, date },
          telephone: /** @type {any} */ (erreur)?.details?.phone || terrain?.phone || null,
        });
        return;
      }
      navigation.navigate(
        RouteNames.ReserverEchec,
        parametresDEchec({
          complexe: complexe?.name,
          creneau: creneauChoisi,
          date,
          erreur,
          slug,
          telephone: telephoneDuComplexe,
          terrain,
          variante,
        }),
      );
    }
  };

  // -------------------------------------------------------------------------------------------
  // Les blocs
  // -------------------------------------------------------------------------------------------

  const sport = libelleSport(terrain?.sport);
  const sousTitre = [complexe?.name, sport].filter(Boolean).join(' · ');
  const enTete = (
    <View style={{ gap: 4 }}>
      <Text
        accessibilityRole="header"
        style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
      >
        {String(terrain?.name || '').toUpperCase()}
      </Text>
      {sousTitre ? <Text style={[Fonts.p2, Fonts.neutral200]}>{sousTitre}</Text> : null}
    </View>
  );

  const bandeDesJours = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[Alignments.row, { gap: 8 }]}>
        {jours.map((unJour) => {
          const actif = unJour.date === date;
          const sansLibre = joursSansLibre.has(unJour.date);
          return (
            <TouchableOpacity
              accessibilityLabel={
                sansLibre
                  ? t(
                    'reserverTerrain.creneau.jourSansLibreA11y',
                    '{{jour}}, aucun créneau libre',
                    {
                      jour: texteJourLong(t, unJour.date),
                      ...SANS_ECHAPPEMENT,
                    },
                  )
                  : texteJourLong(t, unJour.date)
              }
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              key={unJour.date}
              onPress={() => changerDeJour(unJour.date)}
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                {
                  backgroundColor: actif ? Colors.primary500 : withAlpha(Colors.primary500, 0.08),
                  borderColor: withAlpha(Colors.primary500, actif ? 1 : 0.45),
                  borderRadius: 12,
                  borderStyle: sansLibre && !actif ? 'dashed' : 'solid',
                  borderWidth: 1,
                  height: JOUR,
                  width: JOUR,
                },
              ]}
              testID={`jour-${unJour.date}`}
            >
              <Text style={[Fonts.p3, actif ? Fonts.primary900 : Fonts.primary200]}>
                {unJour.court}
              </Text>
              <Text style={[Fonts.p1Bold, actif ? Fonts.primary900 : Fonts.neutral00]}>
                {unJour.numero}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const grille = () => {
    if (lecture?.isLoading && !lecture?.data) {
      return (
        <View
          style={[Alignments.row, Alignments.wrap, { gap: 8 }]}
          testID="reserver-creneau-squelette"
        >
          {[1, 2, 3, 4, 5, 6].map((rang) => (
            <View
              accessibilityState={{ busy: true }}
              key={rang}
              style={{
                backgroundColor: withAlpha(Colors.neutral00, 0.06),
                borderRadius: 12,
                height: 56,
                width: '31%',
              }}
            />
          ))}
        </View>
      );
    }
    if (lecture?.error && !lecture?.data) {
      return (
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: withAlpha(Colors.error500, 0.08),
            borderColor: withAlpha(Colors.error500, 0.4),
            borderRadius: 16,
            borderWidth: 1,
            gap: 8,
            padding: 16,
          }}
        >
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('reserverTerrain.creneau.erreur', 'Impossible de charger les créneaux.')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('reserverTerrain.recherche.erreurTexte', 'Vérifie ta connexion et réessaie.')}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              onPress={() => lecture?.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          </View>
        </View>
      );
    }
    if (
      creneaux.length
      && creneaux.every((/** @type {any} */ creneau) => creneau.state === 'ferme')
    ) {
      return (
        <View
          style={{
            backgroundColor: withAlpha(Colors.warning500, 0.1),
            borderColor: withAlpha(Colors.warning500, 0.5),
            borderRadius: 16,
            borderWidth: 1,
            padding: 16,
          }}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t(
              'reserverTerrain.creneau.jourFerme',
              'Fermé ce jour-là : le complexe a fermé ce terrain.',
            )}
          </Text>
        </View>
      );
    }
    if (!creneaux.length) {
      return (
        <View style={{ gap: 10 }}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('reserverTerrain.creneau.aucunCeJour', 'Aucun créneau libre ce jour-là.')}
          </Text>
          {date < dernierJour ? (
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                onPress={() => changerDeJour(ajouterJours(date, 1))}
                title={texteInsecable(t('reserverTerrain.creneau.jourSuivant', 'Voir le jour suivant'))}
                variant="Secondary"
              />
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        {creneaux.map((/** @type {any} */ creneau) => {
          const estChoisi = creneau.from === choisi && creneau.state === 'libre';
          const touchable = creneau.state === 'libre' || creneau.state === 'trop-tard';
          const pris = creneau.state === 'pris';
          const ferme = creneau.state === 'ferme';
          let etat = libelleEtatDuCreneau(t, creneau.state);
          if (estChoisi) etat = t('reserverTerrain.creneau.choisi', 'Choisi');
          let couleurDuBord = withAlpha(Colors.primary500, 0.6);
          if (ferme || creneau.state === 'trop-tard') {
            couleurDuBord = withAlpha(Colors.warning500, 0.6);
          }
          if (pris) couleurDuBord = withAlpha(Colors.primary200, 0.35);
          return (
            <TouchableOpacity
              accessibilityLabel={`${texteCreneau(creneau.from, creneau.to)}, ${etat}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !touchable, selected: estChoisi }}
              disabled={!touchable}
              key={creneau.from}
              onPress={() => toucherUnCreneau(creneau)}
              style={{
                backgroundColor: estChoisi
                  ? Colors.primary500
                  : withAlpha(Colors.primary500, pris ? 0.03 : 0.08),
                borderColor: estChoisi ? Colors.primary500 : couleurDuBord,
                borderRadius: 12,
                borderStyle: pris ? 'dashed' : 'solid',
                borderWidth: 1,
                flexBasis: surOrdinateur ? '15%' : '31%',
                flexGrow: 1,
                gap: 2,
                justifyContent: 'center',
                minHeight: 56,
                paddingHorizontal: 8,
              }}
              testID={`creneau-${creneau.from}`}
            >
              <Text
                style={[
                  Fonts.p2Bold,
                  estChoisi ? Fonts.primary900 : Fonts.neutral00,
                  pris ? { textDecorationLine: 'line-through' } : null,
                ]}
              >
                {texteCreneau(creneau.from, creneau.to)}
              </Text>
              <Text style={[Fonts.p3, estChoisi ? Fonts.primary900 : Fonts.primary200]}>
                {etat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const prixMontre = prixDuCreneau(
    t,
    (creneauChoisi || libres[0] || creneaux[0])?.price,
    terrain?.capacity,
  );
  let rappelDuMode = t('reserverTerrain.mode.automatique', 'Confirmation immédiate');
  if (terrain?.bookingMode === 'manuel') {
    rappelDuMode = t('reserverTerrain.creneau.surDemande', 'Sur demande : le complexe te répond');
  } else if (parTelephone) {
    rappelDuMode = t(
      'reserverTerrain.complexe.toucheUnCreneau',
      'Par téléphone : touche un créneau',
    );
  }

  const pied = creneauChoisi && !parTelephone ? (
    <View
      style={{
        borderTopColor: withAlpha(Colors.primary500, 0.3),
        borderTopWidth: 1,
        gap: 10,
        paddingTop: 12,
      }}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t('reserverTerrain.creneau.choix', '{{jour}} · {{creneau}}', {
          creneau: texteCreneau(creneauChoisi.from, creneauChoisi.to),
          jour: texteJourCourt(t, date),
          ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <Button
        isLoading={Boolean(apercu?.isPending)}
        onPress={continuer}
        title={t('reserverTerrain.creneau.continuer', 'Continuer')}
        variant="Primary"
      />
    </View>
  ) : null;

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
          maxWidth: surOrdinateur ? COLONNE : undefined,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {enTete}
        {bandeDesJours}
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>{texteJourLong(t, date)}</Text>
        {bandeau ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: withAlpha(Colors.error500, 0.1),
              borderColor: withAlpha(Colors.error500, 0.45),
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{bandeau}</Text>
          </View>
        ) : null}
        {tropJeune ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: withAlpha(Colors.warning500, 0.1),
              borderColor: withAlpha(Colors.warning500, 0.45),
              borderRadius: 16,
              borderWidth: 1,
              padding: 12,
            }}
            testID="creneau-age-minimum"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('reserverTerrain.creneau.reserveAuxAges', 'Réservé aux {{age}} ans et plus.', {
                age: ageMinimum,
              })}
            </Text>
          </View>
        ) : null}
        {grille()}
        {prixMontre ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
              prix: prixMontre.principal,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        <Text style={[Fonts.p3Bold, Fonts.primary200]}>{rappelDuMode}</Text>
        {pied}
      </ScrollView>
      <BottomModal
        close={() => setTropTard(null)}
        isVisible={Boolean(tropTard)}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('reserverTerrain.creneau.tropTardTitre', 'Trop tard pour réserver dans l’app')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {tropTard
              ? t(
                'reserverTerrain.creneau.tropTardTexte',
                '{{jour}} · {{creneau}}. {{complexe}} ne prend plus ce créneau dans l’app : '
                  + 'appelle le complexe.',
                {
                  complexe: String(
                    complexe?.name || t('reserverTerrain.echec.leComplexe', 'Le complexe'),
                  ),
                  creneau: texteCreneau(tropTard.creneau?.from, tropTard.creneau?.to),
                  jour: texteJourCourt(t, date),
                  ...SANS_ECHAPPEMENT,
                },
              )
              : ''}
          </Text>
          {tropTard?.telephone ? (
            <Button
              icon="phone"
              onPress={() => {
                Linking.openURL(`tel:${tropTard.telephone}`).catch(() => {});
              }}
              title={t('reserverTerrain.telephone.appeler', 'Appeler le {{numero}}', {
                numero: numeroLisible(tropTard.telephone),
                ...SANS_ECHAPPEMENT,
              })}
              variant="Primary"
            />
          ) : null}
          <Button
            onPress={() => setTropTard(null)}
            title={t('reserverTerrain.telephone.fermer', 'Fermer')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
      <FeuilleTelephone
        creneau={feuille?.creneau || null}
        onFermer={() => setFeuille(null)}
        telephone={feuille?.telephone || null}
        terrain={terrain}
        visible={Boolean(feuille)}
      />
    </ScreenContainer>
  );
}

export default ReserverCreneau;
