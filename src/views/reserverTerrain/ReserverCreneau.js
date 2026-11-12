import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { libelleLieu, libelleSport } from '@/domains/complexe/complexeTerrain';
import {
  ajouterJours,
  contenuDEchec,
  jourDeParis,
  libelleEtatDuCreneau,
  momentsDesCreneaux,
  numeroLisible,
  parametresDEchec,
  prixDuCreneau,
  prixDUneLigne,
  quatorzeJours,
  texteCreneau,
  texteJourCourt,
  texteJourFerme,
  texteJourLong,
  texteLibres,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import PastilleMode from '@/views/complexe/components/PastilleMode';
import FeuilleTelephone from '@/views/reserverTerrain/components/FeuilleTelephone';
import GaleriePhotos from '@/views/reserverTerrain/components/GaleriePhotos';

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
 *   · la bande de 14 jours (un jour déjà lu sans créneau libre est en pointillé) —
 *     REGLES-RESERVATION (12/11/2026, D47) : elle s'arrête aux jours que le complexe ouvre
 *     (`rules.bookingDaysAhead`) ;
 *     la case suivante, en pointillé gris, dit « Pas encore ouvert » et quand ce jour ouvrira ;
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
  const complexe = useComplexePublic(slug)?.data;
  // REGLES-RESERVATION (D47) : le complexe ouvre ses créneaux N jours à l'avance (90 sans
  // réglage, ou un serveur plus ancien) ; le serveur refuse au-delà.
  const joursPermis = Number(complexe?.rules?.bookingDaysAhead) || 90;
  const jours = quatorzeJours(t, aujourdhui).slice(0, joursPermis + 1);
  const dernierJour = jours[jours.length - 1].date;
  const premierJourFerme = joursPermis + 1 < 14 ? ajouterJours(aujourdhui, joursPermis + 1) : null;

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
  // CORR-RESA (78 A) : un joueur plus jeune que l'âge du complexe le lit AVANT de choisir un
  // créneau
  // (le serveur refusait seulement au bout du parcours).
  const ageMinimum = Number(complexe?.rules?.minAge) || null;
  const naissance = /** @type {any} */ (userData)?.birthdate;
  const tropJeune = Boolean(ageMinimum && naissance && isBirthdateUnderAge(naissance, ageMinimum));
  // RESA-JOUEUR (M1158, maquette « 232- ok ») : sans date de naissance, le dire AVANT le bouton (le
  // serveur la refuse, BIRTHDATE_REQUIRED) ; « Continuer » reste grisé tant qu'elle manque.
  const sansNaissance = Boolean(userData) && !naissance;
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
    if (!creneauChoisi || sansNaissance) return;
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

  // RESA-JOUEUR (D48, maquette « 232- ok ») : les photos du terrain en tête — la page publique
  // les donne déjà (`photos`) ; sans photo, la galerie n'est pas dessinée.
  const photos = Array.isArray(terrainPublic?.photos) ? terrainPublic.photos : [];
  const galerie = (
    <GaleriePhotos
      legende={[terrain?.name, complexe?.name].filter(Boolean).join(' · ')}
      photos={photos}
      testID="creneau"
    />
  );
  // La ligne d'infos en pastilles, en haut (la maquette y remonte le mode, rappelé en bas avant).
  const capacite = Number(terrain?.capacity) > 0 ? Number(terrain.capacity) : null;
  const infos = [
    libelleLieu(t, terrain?.setting),
    capacite ? t('complexeGerant.terrain.joueurs', '{{nombre}} joueurs', { nombre: capacite }) : '',
  ].filter(Boolean);
  const pastille = {
    backgroundColor: withAlpha(Colors.primary500, 0.1),
    borderColor: withAlpha(Colors.primary500, 0.35),
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  };
  const ligneDInfos = (
    <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 8 }]}>
      {infos.map((info) => (
        <View key={info} style={pastille}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{info}</Text>
        </View>
      ))}
      <PastilleMode joueur mode={terrain?.bookingMode} />
    </View>
  );

  const pasEncoreOuvert = Boolean(premierJourFerme) && date === premierJourFerme;
  const caseFermee = premierJourFerme ? (
    <TouchableOpacity
      accessibilityLabel={t(
        'reserverTerrain.creneau.jourPasOuvertA11y',
        '{{jour}}, pas encore ouvert',
        { jour: texteJourLong(t, premierJourFerme), ...SANS_ECHAPPEMENT },
      )}
      accessibilityRole="button"
      accessibilityState={{ selected: pasEncoreOuvert }}
      onPress={() => changerDeJour(premierJourFerme)}
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: pasEncoreOuvert ? Colors.primary700 : 'transparent',
          borderColor: withAlpha(Colors.neutral300, 0.45),
          borderRadius: 12,
          borderStyle: pasEncoreOuvert ? 'solid' : 'dashed',
          borderWidth: 1,
          height: JOUR,
          width: JOUR,
        },
      ]}
      testID={`jour-pas-ouvert-${premierJourFerme}`}
    >
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {quatorzeJours(t, aujourdhui)[joursPermis + 1]?.court}
      </Text>
      <Text style={[Fonts.p1Bold, pasEncoreOuvert ? Fonts.neutral00 : Fonts.neutral300]}>
        {quatorzeJours(t, aujourdhui)[joursPermis + 1]?.numero}
      </Text>
    </TouchableOpacity>
  ) : null;
  const enMinuscule = (/** @type {string} */ texte) => (
    texte ? texte.charAt(0).toLocaleLowerCase() + texte.slice(1) : texte
  );
  const carteFermee = pasEncoreOuvert && premierJourFerme ? (
    <View
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary800, 0.6),
        borderColor: withAlpha(Colors.primary500, 0.24),
        borderRadius: 20,
        borderWidth: 1,
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 24,
      }}
      testID="creneau-pas-encore-ouvert"
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, { textAlign: 'center' }]}>
        {t('reserverTerrain.creneau.pasEncoreOuvert', 'Pas encore ouvert')}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral200, { textAlign: 'center' }]}>
        {t(
          'reserverTerrain.creneau.pasEncoreOuvertTexte',
          // eslint-disable-next-line max-len
          '{{complexe}} ouvre ses réservations {{count}} jours à l’avance. Le {{jour}} sera réservable à partir du {{ouverture}}.',
          {
            complexe: String(
              complexe?.name || t('reserverTerrain.echec.leComplexe', 'Le complexe'),
            ),
            count: joursPermis,
            // eslint-disable-next-line max-len
            defaultValue_one: '{{complexe}} ouvre ses réservations {{count}} jour à l’avance. Le {{jour}} sera réservable à partir du {{ouverture}}.',
            // eslint-disable-next-line max-len
            defaultValue_other: '{{complexe}} ouvre ses réservations {{count}} jours à l’avance. Le {{jour}} sera réservable à partir du {{ouverture}}.',
            jour: enMinuscule(texteJourLong(t, premierJourFerme)),
            ouverture: enMinuscule(texteJourLong(t, ajouterJours(premierJourFerme, -joursPermis))),
            ...SANS_ECHAPPEMENT,
          },
        )}
      </Text>
      <Button
        onPress={() => changerDeJour(dernierJour)}
        title={t('reserverTerrain.creneau.revenirAu', 'Revenir au {{jour}}', {
          jour: enMinuscule(texteJourLong(t, dernierJour)),
          ...SANS_ECHAPPEMENT,
        })}
        variant="Secondary"
      />
    </View>
  ) : null;

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
        {caseFermee}
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
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{texteJourFerme(t, creneaux)}</Text>
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
    // RESA-JOUEUR — piste B (choisie par Adel le 10/11 : « c'est plus clair ») : une LIGNE par
    // créneau, pleine largeur — début et fin, prix, état —, rangées par moment de la journée.
    // Rien ne se coupe : le texte agrandi fait passer l'état sous l'heure. Un état ne se lit jamais
    // à sa seule couleur : il est écrit.
    return (
      <View style={{ gap: 16 }}>
        {momentsDesCreneaux(t, creneaux).map((moment) => (
          <View key={moment.cle} style={{ gap: 8 }} testID={`moment-${moment.cle}`}>
            <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
              <Text accessibilityRole="header" style={[Fonts.p2Bold, Fonts.neutral00]}>
                {moment.titre}
              </Text>
              <Text style={[Fonts.p3, Fonts.primary200]}>{texteLibres(t, moment.libres)}</Text>
            </View>
            {moment.creneaux.map((/** @type {any} */ creneau) => {
              const estChoisi = creneau.from === choisi && creneau.state === 'libre';
              const touchable = creneau.state === 'libre' || creneau.state === 'trop-tard';
              const pris = creneau.state === 'pris';
              const ferme = creneau.state === 'ferme';
              const tard = creneau.state === 'trop-tard';
              let etat = libelleEtatDuCreneau(t, creneau.state);
              if (estChoisi) etat = t('reserverTerrain.creneau.choisi', 'Choisi');
              let couleurDuBord = withAlpha(Colors.primary500, 0.6);
              if (ferme || tard) couleurDuBord = withAlpha(Colors.warning500, 0.6);
              if (pris) couleurDuBord = withAlpha(Colors.primary200, 0.35);
              let styleDeLEtat = Fonts.primary200;
              if (tard || ferme) styleDeLEtat = Fonts.warning500;
              if (estChoisi) styleDeLEtat = Fonts.primary900;
              const prix = prixDUneLigne(creneau.price);
              const texteDuCreneau = texteCreneau(creneau.from, creneau.to);
              return (
                <TouchableOpacity
                  accessibilityLabel={[texteDuCreneau, prix, etat].filter(Boolean).join(', ')}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !touchable, selected: estChoisi }}
                  disabled={!touchable}
                  key={creneau.from}
                  onPress={() => toucherUnCreneau(creneau)}
                  style={[
                    Alignments.row,
                    Alignments.wrap,
                    Alignments.alignCenter,
                    {
                      backgroundColor: estChoisi
                        ? Colors.primary500
                        : withAlpha(Colors.primary500, pris ? 0.03 : 0.08),
                      borderColor: estChoisi ? Colors.primary500 : couleurDuBord,
                      borderRadius: 12,
                      borderStyle: pris ? 'dashed' : 'solid',
                      borderWidth: 1,
                      columnGap: 12,
                      minHeight: 52,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      rowGap: 2,
                    },
                  ]}
                  testID={`creneau-${creneau.from}`}
                >
                  <Text
                    style={[
                      Fonts.p1Bold,
                      estChoisi ? Fonts.primary900 : Fonts.neutral00,
                      pris ? { textDecorationLine: 'line-through' } : null,
                      { flexGrow: 1 },
                    ]}
                  >
                    {texteDuCreneau}
                  </Text>
                  {prix ? (
                    <Text style={[Fonts.p2Bold, estChoisi ? Fonts.primary900 : Fonts.neutral100]}>
                      {prix}
                    </Text>
                  ) : null}
                  <Text style={[Fonts.p3Bold, styleDeLEtat]}>{etat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const prixMontre = prixDuCreneau(
    t,
    (creneauChoisi || libres[0] || creneaux[0])?.price,
    terrain?.capacity,
  );
  // Le mode est en pastille en haut (maquette) ; en bas, seulement ce qu'il demande de faire.
  let rappelDuMode = '';
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
      {/* RESA-JOUEUR : le pied redit le créneau entier ET son prix, près du bouton. */}
      <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { columnGap: 12 }]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flexGrow: 1 }]}>
          {t('reserverTerrain.creneau.choix', '{{jour}} · {{creneau}}', {
            creneau: texteCreneau(creneauChoisi.from, creneauChoisi.to),
            jour: texteJourCourt(t, date),
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
        {prixMontre ? (
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>{prixMontre.principal}</Text>
        ) : null}
      </View>
      <Button
        disabled={sansNaissance}
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
        {galerie}
        {enTete}
        {ligneDInfos}
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
        {sansNaissance ? (
          <View
            accessibilityRole="alert"
            style={{
              backgroundColor: withAlpha(Colors.warning500, 0.1),
              borderColor: withAlpha(Colors.warning500, 0.45),
              borderRadius: 16,
              borderWidth: 1,
              gap: 8,
              padding: 12,
            }}
            testID="creneau-sans-naissance"
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'reserverTerrain.echec.dateDeNaissance',
                'Ajoute ta date de naissance pour réserver.',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {ageMinimum
                ? t(
                  'reserverTerrain.creneau.ageMinimumIci',
                  'Chaque complexe fixe un âge minimum. Ici : {{age}} ans.',
                  { age: ageMinimum },
                )
                : t(
                  'reserverTerrain.echec.dateDeNaissanceTexte',
                  'Chaque complexe fixe un âge minimum.',
                )}
            </Text>
            <View style={{ alignSelf: 'flex-start' }}>
              <Button
                onPress={() => navigation.navigate(RouteNames.ProfileStack, {
                  screen: RouteNames.ProfileEdit,
                })}
                title={t('reserverTerrain.echec.completerProfil', 'Compléter mon profil')}
                variant="Secondary"
              />
            </View>
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
        {carteFermee || grille()}
        {prixMontre && !pasEncoreOuvert ? (
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t('reserverTerrain.prix.surPlace', '{{prix}}, à régler sur place', {
              prix: prixMontre.principal,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        ) : null}
        {rappelDuMode ? (
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>{rappelDuMode}</Text>
        ) : null}
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
