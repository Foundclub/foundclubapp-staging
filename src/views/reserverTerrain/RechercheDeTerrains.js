import { useNavigation } from '@react-navigation/native';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Linking, RefreshControl, ScrollView, Text, View,
} from 'react-native';

import {
  libelleSport, minutesDe, sportsPopulaires, texteHeure,
} from '@/domains/complexe/complexeTerrain';
import {
  ajouterJours,
  DISTANCES_DE_RECHERCHE,
  filtresDeRecherche,
  HEURES_DE_RECHERCHE,
  jourDeParis,
  quatorzeJours,
  texteJourCourt,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput
  from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import CarteComplexeRecherche from '@/views/reserverTerrain/components/CarteComplexeRecherche';
import CarteDesComplexes from '@/views/reserverTerrain/components/CarteDesComplexes';
import PuceChoix from '@/views/reserverTerrain/components/PuceChoix';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { useRechercheDeTerrains } from '@/services/complexe/complexeJoueurQueries';
import { useGetPlaces } from '@/services/places/placesQueries';

import { getZonedDateParts } from '@/utils/parisTime';

import {
  readCurrentSearchMapLocationIfGranted,
  requestCurrentSearchMapLocation,
} from '@/platform/maps/searchMapGeolocation';
import { useIsDesktop } from '@/responsive';

/** @typedef {{ lat: number, lng: number }} Lieu */
/** @typedef {{ label: string, lat: number, lng: number }} Ville */

const ATTENTE_DE_FRAPPE_MS = 300;
const TEXTE_MIN = 2;
const DISTANCE_PAR_DEFAUT = 10;
const DISTANCE_MAX = 50;
const VILLES_MAX = 3;
const SPORTS_MAX = 3;
// RESA-CARTE : la carte du téléphone prend la place libre sous l'en-tête, jamais moins ; celle
// de l'ordinateur, à droite de la liste, a une hauteur fixe (planche OR2).
const HAUTEUR_CARTE_MIN = 320;
const HAUTEUR_CARTE_ORDINATEUR = 600;

/**
 * Un nom comparable : sans accents, minuscules.
 * @param {unknown} texte - Le texte.
 * @returns {string} Le texte normalisé.
 */
const sansAccents = (texte) => String(texte || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .trim();

/**
 * Une ville de la Géoplateforme (`{ geometry, properties }`) en `{ label, lat, lng }`.
 * @param {any} lieu - Le lieu.
 * @returns {{ label: string, lat: number, lng: number } | null} La ville, ou null.
 */
const villeDuLieu = (lieu) => {
  const [lng, lat] = Array.isArray(lieu?.geometry?.coordinates) ? lieu.geometry.coordinates : [];
  const label = String(lieu?.properties?.city || lieu?.properties?.label || '').trim();
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label, lat, lng };
};

/**
 * Une ville choisie dans le champ d'adresse (`{ label, lat, lng, city }`).
 * @param {any} option - Le choix.
 * @returns {{ label: string, lat: number, lng: number } | null} La ville, ou null.
 */
const villeDuChoix = (option) => {
  const lat = Number(option?.lat);
  const lng = Number(option?.lng);
  const label = String(option?.city || option?.label || '').trim();
  if (!label || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { label, lat, lng };
};

/**
 * Les créneaux d'une carte qui tombent dans l'heure choisie : le serveur ne filtre que par
 * « après » (`HEURES_DE_RECHERCHE`), « avant 12 h » et « 12 h – 18 h » se lisent ici.
 * @param {any} carte - La carte.
 * @param {string | null} heure - `matin | apresMidi | soir`, ou null.
 * @returns {any} La carte, ses créneaux filtrés.
 */
const filtrerLHeure = (carte, heure) => {
  const avant = heure ? HEURES_DE_RECHERCHE[/** @type {'matin'} */ (heure)]?.avant : null;
  if (!avant) return carte;
  const creneaux = (Array.isArray(carte?.slots) ? carte.slots : [])
    .filter((/** @type {any} */ creneau) => (minutesDe(creneau?.from) ?? 0) < avant);
  return { ...carte, freeSlotsCount: creneaux.length, slots: creneaux };
};

/**
 * E-P01 — « RÉSERVER UN TERRAIN : LA RECHERCHE » — RESA-L6A (14/10/2026), planches EP01 et RA1 (qui
 * remplace ses états 1, 4 et 7), plan E-P01. C'est le panneau « Réservations » de la recherche
 * (`SearchHubScreen`), aujourd'hui « Bientôt disponible » : il le remplace quand l'interrupteur
 * `COMPLEXES_JOUEUR` est allumé.
 *   · À l'ouverture, la position (A-P11) : déjà accordée ⇒ « Autour de moi » ; sinon la feuille
 *     « Des terrains autour de toi » (Autoriser / Choisir une ville) ; refusée ⇒ la phrase de
 *     l'inscription et le choix d'une ville.
 *   · Un seul champ « Complexe, ville ou sport » : le NOM part au serveur, qui tolère les fautes
 *     (dès 2 lettres, 300 ms) ; les villes et les sports qui ressemblent au texte se proposent.
 *   · Les filtres (sport, jour, heure, distance, intérieur / extérieur) ; une carte par complexe.
 * ⛔ Pas dans ce lot : « Parties à compléter » et « Mes complexes favoris » (L3 / L4 puis L6b).
 * RESA-CARTE (20/10/2026) — la vue Carte (plan E-P01 points 4 et 6, planches EP01 état 2 et OR2) :
 *   · téléphone : la bascule « Liste » / « Carte » ; en Carte, la carte prend la place sous
 *     l'en-tête (hors du défilement : la glisser ne fait pas défiler l'écran), et la carte du
 *     complexe dont l'épingle est touchée se pose dessous ;
 *   · ordinateur : la liste à gauche, la carte à droite, pas de bascule ; toucher une épingle met
 *     sa carte en tête de liste ;
 *   · les filtres, la position et la ville valent pour les deux vues ; chargement, erreur, choix
 *     d'une ville : les mêmes blocs ; aucune proposition : « Aucun terrain libre ici. Élargis la
 *     distance. »
 * @param {object} props - Les propriétés.
 * @param {number} [props.refreshSignal] - Un nouveau nombre relance la lecture (retour au
 *   premier plan).
 * @param {boolean} [props.screenActive] - Le panneau est l'onglet visible.
 * @returns {import('react').ReactElement} Le panneau.
 */
function RechercheDeTerrains({ refreshSignal = 0, screenActive = true }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const surOrdinateur = useIsDesktop();
  const aujourdhui = jourDeParis();

  const [texte, setTexte] = useState('');
  const [texteCherche, setTexteCherche] = useState('');
  const [sport, setSport] = useState(/** @type {string | null} */ (null));
  const [jour, setJour] = useState(/** @type {string | null} */ (null));
  const [heure, setHeure] = useState(/** @type {'matin' | 'apresMidi' | 'soir' | null} */ (null));
  const [distanceKm, setDistanceKm] = useState(DISTANCE_PAR_DEFAUT);
  const [cadre, setCadre] = useState(/** @type {string | null} */ (null));
  const [position, setPosition] = useState(/** @type {Lieu | null} */ (null));
  const [ville, setVille] = useState(/** @type {Ville | null} */ (null));
  // `lecture` (on regarde si elle est déjà accordée) · `accordee` · `aDemander` · `refusee`.
  const [etatPosition, setEtatPosition] = useState('lecture');
  const [feuillePosition, setFeuillePosition] = useState(false);
  const [brouillon, setBrouillon] = useState(/** @type {any} */ (null));
  const [vue, setVue] = useState(/** @type {'liste' | 'carte'} */ ('liste'));
  const [epingleChoisie, setEpingleChoisie] = useState(/** @type {string | null} */ (null));
  const [hauteurCarte, setHauteurCarte] = useState(HAUTEUR_CARTE_MIN);
  const dernierSignal = useRef(refreshSignal);

  useEffect(() => {
    const minuteur = setTimeout(() => setTexteCherche(texte), ATTENTE_DE_FRAPPE_MS);
    return () => clearTimeout(minuteur);
  }, [texte]);

  useEffect(() => {
    let vivant = true;
    readCurrentSearchMapLocationIfGranted().then((lue) => {
      if (!vivant) return;
      if (lue) {
        setPosition(lue);
        setEtatPosition('accordee');
      } else {
        setEtatPosition('aDemander');
      }
    }).catch(() => {
      if (vivant) setEtatPosition('aDemander');
    });
    return () => {
      vivant = false;
    };
  }, []);

  useEffect(() => {
    if (screenActive && etatPosition === 'aDemander' && !ville) setFeuillePosition(true);
    // La feuille ne se montre qu'une fois : à la première ouverture de l'onglet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenActive, etatPosition]);

  const demanderLaPosition = useCallback(async () => {
    setFeuillePosition(false);
    const lue = await requestCurrentSearchMapLocation();
    if (lue) {
      setPosition(lue);
      setVille(null);
      setEtatPosition('accordee');
    } else {
      setEtatPosition('refusee');
    }
  }, []);

  const centre = position || ville;
  const texteValide = texteCherche.replace(/\s+/g, ' ').trim().length >= TEXTE_MIN;
  const filtres = useMemo(() => filtresDeRecherche({
    cadre,
    date: jour || aujourdhui,
    distanceKm,
    heure,
    position: centre,
    sport,
    texte: texteCherche,
  }), [aujourdhui, cadre, centre, distanceKm, heure, jour, sport, texteCherche]);
  const recherche = useRechercheDeTerrains(filtres, {
    enabled: Boolean(centre) || texteValide,
  });
  const activites = useGetActivities();
  const villesProposees = useGetPlaces({
    options: { enabled: texteValide },
    searchParam: texteCherche,
    type: 'municipality',
  });

  useEffect(() => {
    if (refreshSignal !== dernierSignal.current) {
      dernierSignal.current = refreshSignal;
      recherche.refetch?.();
    }
  }, [recherche, refreshSignal]);

  const listeDesSports = Array.isArray(activites?.data) ? activites.data : [];
  const sportsProposes = texteValide
    ? listeDesSports
      .filter((/** @type {any} */ activite) => (
        sansAccents(activite?.name).includes(sansAccents(texteCherche))
      ))
      .slice(0, SPORTS_MAX)
    : [];
  const villes = texteValide && Array.isArray(villesProposees?.data)
    ? villesProposees.data.map(villeDuLieu).filter(Boolean).slice(0, VILLES_MAX)
    : [];

  const cartes = (Array.isArray(recherche?.data?.complexes) ? recherche.data.complexes : [])
    .map((/** @type {any} */ carte) => filtrerLHeure(carte, heure))
    .filter((/** @type {any} */ carte) => texteValide || carte.slots.length > 0);
  const dateLue = recherche?.data?.date || jour || aujourdhui;
  const carteChoisie = cartes.find((/** @type {any} */ carte) => (
    carte.slug === epingleChoisie
  )) || null;
  const enCarte = !surOrdinateur && vue === 'carte';
  const distanceSuivante = [20, DISTANCE_MAX].find((km) => km > distanceKm) || null;

  const ouvrirLeComplexe = (/** @type {any} */ carte) => navigation.navigate(
    RouteNames.ReserverComplexe,
    { slug: carte.slug },
  );
  const ouvrirLeCreneau = (/** @type {any} */ carte, /** @type {any} */ creneau) => {
    navigation.navigate(RouteNames.ReserverCreneau, {
      date: dateLue,
      from: creneau.from,
      slug: carte.slug,
      terrainId: creneau?.terrain?.documentId,
    });
  };

  const libelleDuJour = (/** @type {string | null} */ date) => {
    if (!date || date === aujourdhui) {
      return t(
        'reserverTerrain.recherche.aujourdhui',
        'Aujourd’hui',
      );
    }
    if (date === ajouterJours(aujourdhui, 1)) {
      return t(
        'reserverTerrain.recherche.demain',
        'Demain',
      );
    }
    return texteJourCourt(t, date);
  };

  const ouvrirLesFiltres = () => setBrouillon({
    cadre, distanceKm, heure, jour, sport,
  });
  const appliquerLesFiltres = () => {
    setSport(brouillon.sport);
    setJour(brouillon.jour);
    setHeure(brouillon.heure);
    setDistanceKm(brouillon.distanceKm);
    setCadre(brouillon.cadre);
    setBrouillon(null);
  };

  const choisirUneVille = (/** @type {any} */ choix) => {
    const choisie = villeDuChoix(choix);
    if (!choisie) return;
    setVille(choisie);
    setPosition(null);
    setTexte('');
    setTexteCherche('');
  };

  // -------------------------------------------------------------------------------------------
  // Les feuilles (en tête de l'arbre : elles se superposent à l'écran)
  // -------------------------------------------------------------------------------------------

  const groupeDuBrouillon = (
    /** @type {string} */ titre,
    /** @type {Array<{ cle: any, libelle: string }>} */ choix,
    /** @type {string} */ champ,
  ) => (
    <View style={{ gap: 8 }}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
      <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
        {choix.map(({ cle, libelle }) => (
          <PuceChoix
            choisie={brouillon?.[champ] === cle}
            key={String(cle)}
            libelle={libelle}
            onPress={() => setBrouillon((/** @type {any} */ avant) => ({
              ...avant,
              // Toucher un choix déjà pris le retire ; la distance, elle, ne se retire pas.
              [champ]: avant?.[champ] === cle && champ !== 'distanceKm' ? null : cle,
            }))}
          />
        ))}
      </View>
    </View>
  );

  const feuilles = (
    <>
      <BottomModal
        close={() => setFeuillePosition(false)}
        isVisible={feuillePosition}
        webPresentation="dialog"
      >
        <View style={{ gap: 12 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('reserverTerrain.recherche.positionTitre', 'Des terrains autour de toi')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'reserverTerrain.recherche.positionTexte',
              'Autorise ta position pour voir les terrains libres près de toi, triés par distance.',
            )}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'reserverTerrain.recherche.positionAide',
              'Elle sert à calculer les distances. Tu peux aussi choisir une ville.',
            )}
          </Text>
          <Button
            onPress={demanderLaPosition}
            title={t('reserverTerrain.recherche.autoriser', 'Autoriser ma position')}
            variant="Primary"
          />
          <Button
            onPress={() => setFeuillePosition(false)}
            title={t('reserverTerrain.recherche.choisirUneVille', 'Choisir une ville')}
            variant="Ghost"
          />
        </View>
      </BottomModal>
      <BottomModal
        close={() => setBrouillon(null)}
        isVisible={Boolean(brouillon)}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('reserverTerrain.recherche.filtres', 'Filtres')}
          </Text>
          {groupeDuBrouillon(
            t('reserverTerrain.recherche.sport', 'Sport'),
            sportsPopulaires(listeDesSports).map(({ documentId, label }) => ({
              cle: documentId,
              libelle: label,
            })),
            'sport',
          )}
          {groupeDuBrouillon(
            t('reserverTerrain.recherche.jour', 'Jour'),
            quatorzeJours(t, aujourdhui).slice(0, 7).map((unJour) => ({
              cle: unJour.date === aujourdhui ? null : unJour.date,
              libelle: libelleDuJour(unJour.date),
            })),
            'jour',
          )}
          {groupeDuBrouillon(
            t('reserverTerrain.recherche.heure', 'Heure'),
            [
              { cle: 'matin', libelle: t('reserverTerrain.recherche.matin', 'Avant 12 h') },
              {
                cle: 'apresMidi',
                libelle: t(
                  'reserverTerrain.recherche.apresMidi',
                  '12 h – 18 h',
                ),
              },
              { cle: 'soir', libelle: t('reserverTerrain.recherche.soir', 'Après 18 h') },
            ],
            'heure',
          )}
          {centre ? groupeDuBrouillon(
            t('reserverTerrain.recherche.distance', 'Distance'),
            DISTANCES_DE_RECHERCHE.map((km) => ({
              cle: km,
              libelle: t('reserverTerrain.recherche.km', '{{nombre}} km', { nombre: km }),
            })),
            'distanceKm',
          ) : null}
          {groupeDuBrouillon(
            t('reserverTerrain.recherche.terrain', 'Terrain'),
            [
              { cle: 'interieur', libelle: t('reserverTerrain.recherche.interieur', 'Intérieur') },
              { cle: 'exterieur', libelle: t('reserverTerrain.recherche.exterieur', 'Extérieur') },
            ],
            'cadre',
          )}
          <View style={[Alignments.row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => setBrouillon({
                  cadre: null,
                  distanceKm: DISTANCE_PAR_DEFAUT,
                  heure: null,
                  jour: null,
                  sport: null,
                })}
                title={t('reserverTerrain.recherche.effacer', 'Effacer')}
                variant="Ghost"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={appliquerLesFiltres}
                title={t('reserverTerrain.recherche.voirLesTerrains', 'Voir les terrains')}
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </BottomModal>
    </>
  );

  // -------------------------------------------------------------------------------------------
  // L'en-tête : le champ, ses propositions, les puces
  // -------------------------------------------------------------------------------------------

  const propositions = sportsProposes.length || villes.length ? (
    <View style={{ gap: 8 }} testID="reserver-recherche-propositions">
      {villes.length ? (
        <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t('reserverTerrain.recherche.villes', 'Villes')}
          </Text>
          {villes.map((/** @type {any} */ uneVille) => (
            <PuceChoix
              accessibilityLabel={t(
                'reserverTerrain.recherche.autourDeLaVille',
                'Chercher autour de {{ville}}',
                {
                  ville: uneVille.label,
                  ...SANS_ECHAPPEMENT,
                },
              )}
              key={uneVille.label}
              libelle={uneVille.label}
              onPress={() => choisirUneVille(uneVille)}
            />
          ))}
        </View>
      ) : null}
      {sportsProposes.length ? (
        <View style={[Alignments.row, Alignments.wrap, Alignments.alignCenter, { gap: 8 }]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t('reserverTerrain.recherche.sports', 'Sports')}
          </Text>
          {sportsProposes.map((/** @type {any} */ activite) => (
            <PuceChoix
              accessibilityLabel={t(
                'reserverTerrain.recherche.filtrerLeSport',
                'Filtrer les terrains de {{sport}}',
                {
                  sport: libelleSport(activite),
                  ...SANS_ECHAPPEMENT,
                },
              )}
              key={String(activite.documentId)}
              libelle={libelleSport(activite)}
              onPress={() => {
                setSport(String(activite.documentId));
                setTexte('');
                setTexteCherche('');
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  ) : null;

  const sportChoisi = listeDesSports.find((/** @type {any} */ activite) => (
    String(activite?.documentId) === sport
  ));
  let puceDuLieu = null;
  if (position) {
    puceDuLieu = (
      <PuceChoix
        choisie
        libelle={t('reserverTerrain.recherche.autourDeMoi', 'Autour de moi')}
        onPress={demanderLaPosition}
      />
    );
  } else if (ville) {
    puceDuLieu = (
      <PuceChoix
        accessibilityLabel={t(
          'reserverTerrain.recherche.changerDeVille',
          '{{ville}} : changer de ville',
          {
            ville: ville.label,
            ...SANS_ECHAPPEMENT,
          },
        )}
        choisie
        libelle={ville.label}
        onPress={() => setVille(null)}
      />
    );
  }

  const puces = (
    <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
      {puceDuLieu}
      {sportChoisi ? (
        <PuceChoix
          accessibilityLabel={t(
            'reserverTerrain.recherche.retirerLeSport',
            '{{sport}} : retirer ce filtre',
            {
              sport: libelleSport(sportChoisi),
              ...SANS_ECHAPPEMENT,
            },
          )}
          choisie
          libelle={libelleSport(sportChoisi)}
          onPress={() => setSport(null)}
        />
      ) : null}
      <PuceChoix libelle={libelleDuJour(jour)} onPress={ouvrirLesFiltres} />
      {centre ? (
        <PuceChoix
          libelle={t('reserverTerrain.recherche.km', '{{nombre}} km', { nombre: distanceKm })}
          onPress={ouvrirLesFiltres}
        />
      ) : null}
      <PuceChoix
        libelle={t(
          'reserverTerrain.recherche.filtrer',
          'Filtrer',
        )}
        onPress={ouvrirLesFiltres}
      />
    </View>
  );

  // RESA-CARTE — sur ordinateur, les deux vues sont côte à côte : la bascule disparaît (OR2).
  const bascule = surOrdinateur ? null : (
    <View style={[Alignments.row, { gap: 8 }]}>
      <PuceChoix
        choisie={vue === 'liste'}
        libelle={t('reserverTerrain.recherche.liste', 'Liste')}
        onPress={() => setVue('liste')}
        testID="reserver-recherche-vue-liste"
      />
      <PuceChoix
        choisie={vue === 'carte'}
        libelle={t('reserverTerrain.recherche.carte', 'Carte')}
        onPress={() => setVue('carte')}
        testID="reserver-recherche-vue-carte"
      />
    </View>
  );

  // -------------------------------------------------------------------------------------------
  // Le corps : choisir un lieu, chargement, erreur, vide, la liste
  // -------------------------------------------------------------------------------------------

  const carteDeBloc = {
    backgroundColor: withAlpha(Colors.primary500, 0.08),
    borderColor: withAlpha(Colors.primary500, 0.3),
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  };
  const variante = recherche?.error ? varianteDEchec(recherche.error) : null;
  let corps;
  if (!centre && !texteValide) {
    corps = (
      <View style={carteDeBloc} testID="reserver-recherche-ville">
        {etatPosition === 'refusee' ? (
          <Text accessibilityRole="alert" style={[Fonts.p2, Fonts.neutral00]}>
            {t(
              'reserverTerrain.recherche.positionRefusee',
              'Localisation refusée : choisis une ville pour voir les terrains. '
                + 'Tu peux l’autoriser dans les réglages de ton téléphone.',
            )}
          </Text>
        ) : (
          <>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {t('reserverTerrain.recherche.choisisUneVille', 'Choisis une ville')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'reserverTerrain.recherche.choisisUneVilleTexte',
                'Pour te montrer les terrains libres près de chez toi.',
              )}
            </Text>
          </>
        )}
        <AutocompleteAddressInput
          label={t('reserverTerrain.recherche.taVille', 'Ta ville')}
          placeholder={t('reserverTerrain.recherche.tapeUneVille', 'Tape une ville')}
          setAddress={choisirUneVille}
          type="municipality"
        />
        {etatPosition === 'refusee' ? (
          <Button
            onPress={() => {
              Linking.openSettings?.();
            }}
            title={t('reserverTerrain.recherche.ouvrirLesReglages', 'Ouvrir les réglages')}
            variant="Ghost"
          />
        ) : (
          <Button
            onPress={demanderLaPosition}
            title={t('reserverTerrain.recherche.autoriser', 'Autoriser ma position')}
            variant="Secondary"
          />
        )}
      </View>
    );
  } else if (recherche?.isLoading && !recherche?.data) {
    corps = (
      <View style={{ gap: 12 }} testID="reserver-recherche-squelette">
        {[1, 2, 3].map((ligne) => (
          <View
            accessibilityState={{ busy: true }}
            key={ligne}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 24, height: 150,
            }}
          />
        ))}
      </View>
    );
  } else if (recherche?.error && !recherche?.data) {
    corps = (
      <View
        accessibilityRole="alert"
        style={{
          ...carteDeBloc,
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
        }}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('reserverTerrain.recherche.erreur', 'Impossible de charger les terrains.')}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t('reserverTerrain.recherche.erreurTexte', 'Vérifie ta connexion et réessaie.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => recherche.refetch?.()}
            title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else if (!cartes.length) {
    const elargir = distanceSuivante && centre ? (
      <Button
        onPress={() => setDistanceKm(distanceSuivante)}
        title={t(
          'reserverTerrain.recherche.elargir',
          'Élargir à {{nombre}} km',
          { nombre: distanceSuivante },
        )}
        variant="Secondary"
      />
    ) : null;
    let titreDuVide = t('reserverTerrain.recherche.vide', 'Aucun terrain libre avec ces filtres.');
    if (enCarte) {
      titreDuVide = t(
        'reserverTerrain.recherche.carteVide',
        'Aucun terrain libre ici. Élargis la distance.',
      );
    }
    corps = texteValide ? (
      <View style={carteDeBloc}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t(
            'reserverTerrain.recherche.rienTrouve',
            'Aucun terrain pour « {{texte}} » autour de toi.',
            {
              texte: texteCherche.trim(),
              ...SANS_ECHAPPEMENT,
            },
          )}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'reserverTerrain.recherche.rienTrouveTexte',
            'Essaie un nom de complexe, une autre ville, ou élargis la distance.',
          )}
        </Text>
        {elargir}
      </View>
    ) : (
      <View style={carteDeBloc}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{titreDuVide}</Text>
        {elargir}
        <Button
          onPress={() => setJour(ajouterJours(jour || aujourdhui, 1))}
          title={t('reserverTerrain.recherche.voirDemain', 'Voir demain')}
          variant="Ghost"
        />
      </View>
    );
  } else if (surOrdinateur) {
    // OR2 : la liste à gauche (la carte de l'épingle touchée en tête), la carte à droite.
    const enTete = carteChoisie
      ? [carteChoisie, ...cartes.filter((/** @type {any} */ carte) => carte !== carteChoisie)]
      : cartes;
    corps = (
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
        <View style={{ flex: 1, gap: 12, minWidth: 0 }}>
          {enTete.map((/** @type {any} */ carte) => (
            <CarteComplexeRecherche
              carte={carte}
              choisie={carte === carteChoisie}
              key={carte.slug}
              onCreneau={(creneau) => ouvrirLeCreneau(carte, creneau)}
              onOuvrir={() => ouvrirLeComplexe(carte)}
            />
          ))}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <CarteDesComplexes
            cartes={cartes}
            choisie={epingleChoisie}
            hauteur={HAUTEUR_CARTE_ORDINATEUR}
            onChoisir={setEpingleChoisie}
            onOuvrir={ouvrirLeComplexe}
          />
        </View>
      </View>
    );
  } else if (!enCarte) {
    corps = (
      <View style={{ gap: 12 }}>
        {cartes.map((/** @type {any} */ carte) => (
          <CarteComplexeRecherche
            carte={carte}
            key={carte.slug}
            onCreneau={(creneau) => ouvrirLeCreneau(carte, creneau)}
            onOuvrir={() => ouvrirLeComplexe(carte)}
          />
        ))}
      </View>
    );
  }
  // Téléphone, vue Carte, des complexes proposés : la carte se pose HORS du défilement (plus bas).
  const carteEnPlace = enCarte && !corps;

  let horsConnexion = null;
  if (variante === 'reseau' && recherche?.data) {
    const instant = new Date(Number(recherche.dataUpdatedAt) || Date.now());
    const lue = getZonedDateParts(instant, 'Europe/Paris');
    const minutes = String(lue.minute).padStart(2, '0');
    const heureLue = texteHeure(`${String(lue.hour).padStart(2, '0')}:${minutes}`);
    horsConnexion = (
      <View
        accessibilityRole="alert"
        style={{
          ...carteDeBloc,
          backgroundColor: withAlpha(Colors.warning500, 0.1),
          borderColor: withAlpha(Colors.warning500, 0.5),
        }}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t(
            'reserverTerrain.recherche.horsConnexion',
            'Hors connexion : les créneaux affichés datent de {{heure}} et peuvent être pris.',
            { heure: heureLue, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      </View>
    );
  }

  return (
    <View style={[Alignments.fill]}>
      {feuilles}
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? 1160 : undefined,
          paddingBottom: 32,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => recherche.refetch?.()}
            refreshing={Boolean(recherche?.isRefetching)}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={carteEnPlace ? { flexGrow: 0 } : [Alignments.fill]}
      >
        <Input
          accessibilityLabel={t('reserverTerrain.recherche.champ', 'Complexe, ville ou sport')}
          autoCorrect={false}
          icon="search"
          onChangeText={setTexte}
          placeholder={t('reserverTerrain.recherche.champ', 'Complexe, ville ou sport')}
          testID="reserver-recherche-champ"
          value={texte}
        />
        {propositions}
        {puces}
        {bascule}
        {horsConnexion}
        {corps}
      </ScrollView>
      {carteEnPlace ? (
        <View style={{ flex: 1, gap: 12, paddingBottom: 12 }}>
          <View
            onLayout={(evenement) => setHauteurCarte(Math.max(
              HAUTEUR_CARTE_MIN,
              Math.round(Number(evenement?.nativeEvent?.layout?.height) || 0),
            ))}
            style={{ flex: 1, minHeight: HAUTEUR_CARTE_MIN }}
          >
            <CarteDesComplexes
              cartes={cartes}
              choisie={epingleChoisie}
              hauteur={hauteurCarte}
              onChoisir={setEpingleChoisie}
              onOuvrir={ouvrirLeComplexe}
            />
          </View>
          {carteChoisie ? (
            <View testID="reserver-recherche-carte-choisie">
              <CarteComplexeRecherche
                carte={carteChoisie}
                choisie
                onCreneau={(creneau) => ouvrirLeCreneau(carteChoisie, creneau)}
                onOuvrir={() => ouvrirLeComplexe(carteChoisie)}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default RechercheDeTerrains;
