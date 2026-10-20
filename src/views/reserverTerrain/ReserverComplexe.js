import { useNavigation, useRoute } from '@react-navigation/native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { libelleSport } from '@/domains/complexe/complexeTerrain';
import { apercuDeLaFidelite } from '@/domains/complexe/partieDuJoueur';
import {
  contenuDEchec,
  horairesLisibles,
  jourDeParis,
  numeroLisible,
  texteAnnulation,
  varianteDEchec,
} from '@/domains/complexe/reserverTerrain';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BadgeComplexe from '@/views/complexe/components/BadgeComplexe';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';
import CarteTerrainJoueur from '@/views/reserverTerrain/components/CarteTerrainJoueur';
import FeuilleRetirerFavori from '@/views/reserverTerrain/components/FeuilleRetirerFavori';
import FeuilleSignaler from '@/views/reserverTerrain/components/FeuilleSignaler';
import FeuilleTelephone from '@/views/reserverTerrain/components/FeuilleTelephone';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import {
  useAjouterAuxFavoris,
  useComplexePublic,
  useMaRelationAuComplexe,
  usePartenairesPublics,
  useRetirerDesFavoris,
  useTerrainsPublics,
} from '@/services/complexe/complexeJoueurQueries';

import { isBirthdateUnderAge } from '@/constants/parentalDeclaration';
import { openExternalMap } from '@/platform/maps/externalMap';
import { useIsDesktop } from '@/responsive';

/** @typedef {{ creneau: any, terrain: any }} FeuilleOuverte */

const COUVERTURE = 112;
const COLONNE_RESERVER = 420;

/**
 * Une adresse de site sans son protocole, pour l'afficher : « lefive-montrivage.fr ».
 * @param {unknown} url - L'adresse.
 * @returns {string} Le texte.
 */
const siteLisible = (url) => String(url || '')
  .trim()
  .replace(/^https?:\/\//i, '')
  .replace(/^www\./i, '')
  .replace(/\/$/, '');

/**
 * Une adresse de site qui s'ouvre : « https:// » ajouté si le complexe ne l'a pas écrit.
 * @param {unknown} url - L'adresse.
 * @returns {string} L'adresse complète.
 */
const siteComplet = (url) => {
  const brute = String(url || '').trim();
  return /^https?:\/\//i.test(brute) ? brute : `https://${brute}`;
};

/**
 * E-P02 — « LA PAGE DU COMPLEXE » — RESA-L6A (14/10/2026), planches EP02, RA2 et OR2, plan E-P02.
 * La page d'un complexe pour un membre (et, au lot L7, pour le public du site). Elle part de la
 * fiche club sans ses blocs d'adhésion, de membres ni d'équipes :
 *   · la carte d'identité : couverture, logo carré, le nom, la pastille « Complexe de réservation »
 *     (A-G05, toujours) et « Vérifié » (si vérifié), la ville, les sports ;
 *   · « Réserver » : une carte par terrain (E-P03, ou la feuille E-P06 « par téléphone »), puis les
 *     Règles (âge minimum — mis en évidence sous l'âge, R2 —, annulation, paiement sur place,
 *     le mot aux joueurs A-G26) ;
 *   · « Infos » : description, photos, horaires d'accueil, adresse et itinéraire, téléphone DU
 *     complexe et « Appeler » (RG-TEL), site web.
 * Sur ordinateur (OR2) : les infos à gauche, la colonne « Réserver » à droite, sans segments.
 * Paramètres : `slug` ; `apercu` (le gérant regarde sa page : bandeau « Aperçu ») ; `depuis`.
 * RESA-L6B-2 (20/10/2026, serveur RESA-L4 ; planches EP02 états 1 à 4 et 10, RA2) — la communauté :
 *   · le cœur (AT-15 A) : « Ajouter aux favoris » (on entre dans le canal, A-G08 : « Ajouté à tes
 *     favoris. Tu reçois maintenant les nouvelles du complexe. ») / « Dans tes favoris » ⇒ la
 *     feuille du retrait (le canal gardé, Q5 ; la case « Quitter aussi le canal », AT-11 A) ;
 *   · le bandeau d'arrivée par l'affiche (`depuis: 'affiche'`, A-G12) : « Ajoute … à tes
 *     favoris » ;
 *   · « … » ⇒ « Signaler ce complexe » (motif ; N-09) ;
 *   · « Ta fidélité ici 8/10 » et ce qui reste, ou la récompense (RC-G10) ;
 *   · « Canal du complexe · 214 membres » ⇒ le canal (E-P12), sinon « Mets le complexe en favori
 *     pour recevoir ses nouvelles. » ;
 *   · « Nos partenaires » (Infos, A-G25, planche RA2) : une rangée par partenaire, son site.
 * L'aperçu du gérant ne montre rien de tout cela (rien ne le concerne). « Dernier message hier »
 * (le canal) : le serveur ne le rend pas. Caché par `COMPLEXES_JOUEUR`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ReserverComplexe() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ apercu?: boolean, depuis?: string, slug?: string } | undefined} */ (
    route?.params
  );
  const slug = params?.slug;
  const communaute = !params?.apercu;
  const { userData } = useAuth();
  const surOrdinateur = useIsDesktop();
  const complexeLu = useComplexePublic(slug);
  const terrainsLus = useTerrainsPublics(slug);
  const [segment, setSegment] = useState('reserver');
  const [feuille, setFeuille] = useState(/** @type {FeuilleOuverte | null} */ (null));
  const relation = useMaRelationAuComplexe(slug, { enabled: communaute })?.data || null;
  const partenairesLus = usePartenairesPublics(slug);
  const ajouter = useAjouterAuxFavoris();
  const retirer = useRetirerDesFavoris();
  const [annonceFavori, setAnnonceFavori] = useState(/** @type {string | null} */ (null));
  const [retrait, setRetrait] = useState(false);
  const [refusFavori, setRefusFavori] = useState(/** @type {string | null} */ (null));
  const [signaler, setSignaler] = useState(false);

  const aujourdhui = jourDeParis();
  const complexe = complexeLu?.data;
  const terrains = Array.isArray(terrainsLus?.data) ? terrainsLus.data : [];
  const ageMinimum = Number(complexe?.rules?.minAge) || 18;
  const naissance = /** @type {any} */ (userData)?.birthdate;
  const sousLAge = !naissance || isBirthdateUnderAge(naissance, ageMinimum);

  // RESA-L6B-2 — le cœur : favori ⇒ canal (A-G08) ; un plus jeune que l'âge du complexe garde son
  // favori sans le canal (le serveur le dit par `canal.raison`) : alors seulement « Ajouté ».
  const estFavori = Boolean(relation?.favori);
  const mettreEnFavori = async (/** @type {'affiche' | 'bouton'} */ origin) => {
    setRefusFavori(null);
    try {
      const reponse = await ajouter.mutateAsync({ origin, slug });
      setAnnonceFavori(reponse?.canal && !reponse.canal.raison
        ? t(
          'reserverTerrain.complexe.ajouteAuxFavorisCanal',
          'Ajouté à tes favoris. Tu reçois maintenant les nouvelles du complexe.',
        )
        : t('reserverTerrain.complexe.ajouteAuxFavoris', 'Ajouté à tes favoris.'));
    } catch (erreur) {
      setRefusFavori(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };
  const retirerDesFavoris = async (/** @type {boolean} */ quitterCanal) => {
    setRefusFavori(null);
    try {
      await retirer.mutateAsync({ quitterCanal, slug });
      setRetrait(false);
      setAnnonceFavori(null);
    } catch (erreur) {
      setRefusFavori(contenuDEchec(t, varianteDEchec(erreur), { erreur }).titre);
    }
  };

  const versLeCalendrier = (/** @type {any} */ terrain, /** @type {any} */ creneau = null) => {
    navigation.navigate(RouteNames.ReserverCreneau, {
      ...(creneau ? { date: aujourdhui, from: creneau.from } : {}),
      slug,
      terrainId: terrain.documentId,
    });
  };
  const toucherUnCreneau = (/** @type {any} */ terrain, /** @type {any} */ creneau) => {
    if (terrain?.bookingMode === 'telephone') {
      setFeuille({ creneau: { ...creneau, date: aujourdhui }, terrain });
      return;
    }
    versLeCalendrier(terrain, creneau);
  };

  const carteDeBloc = {
    backgroundColor: withAlpha(Colors.primary800, 0.6),
    borderColor: withAlpha(Colors.primary500, 0.24),
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  };
  const titreDeBloc = [Fonts.p1Bold, Fonts.neutral00];

  // -------------------------------------------------------------------------------------------
  // Les états d'avant la page
  // -------------------------------------------------------------------------------------------

  let etat = null;
  if (complexeLu?.isLoading && !complexe) {
    etat = (
      <View style={{ gap: 12 }} testID="reserver-complexe-squelette">
        {[220, 180, 180].map((hauteur, rang) => (
          <View
            accessibilityState={{ busy: true }}
            // eslint-disable-next-line react/no-array-index-key
            key={rang}
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 24, height: hauteur,
            }}
          />
        ))}
      </View>
    );
  } else if (complexeLu?.error && !complexe) {
    const parti = varianteDEchec(complexeLu.error) === 'complexeParti';
    etat = (
      <View accessibilityRole="alert" style={carteDeBloc}>
        <Text style={titreDeBloc}>
          {parti
            ? t('reserverTerrain.complexe.parti', 'Ce complexe n’est plus sur FoundClub.')
            : t('reserverTerrain.complexe.erreur', 'Impossible de charger ce complexe.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          {parti ? (
            <Button
              onPress={() => navigateToSearchHub(navigation, 'reservations')}
              title={t('reserverTerrain.complexe.reserverAilleurs', 'Réserver ailleurs')}
              variant="Secondary"
            />
          ) : (
            <Button
              onPress={() => complexeLu.refetch?.()}
              title={t('reserverTerrain.recherche.reessayer', 'Réessayer')}
              variant="Secondary"
            />
          )}
        </View>
      </View>
    );
  }

  // -------------------------------------------------------------------------------------------
  // Les blocs de la page
  // -------------------------------------------------------------------------------------------

  const photos = Array.isArray(complexe?.photos) ? complexe.photos.filter(Boolean) : [];
  const sports = (Array.isArray(complexe?.sports) ? complexe.sports : [])
    .map((/** @type {any} */ sport) => libelleSport(sport))
    .filter(Boolean)
    .join(' · ');

  const bandeauApercu = params?.apercu ? (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.14),
          borderColor: withAlpha(Colors.primary500, 0.5),
          borderRadius: 16,
          borderWidth: 1,
          gap: 12,
          padding: 12,
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
        {t('reserverTerrain.complexe.apercu', 'Aperçu : c’est ce que voient les joueurs.')}
      </Text>
      <Button
        onPress={() => navigation.goBack()}
        size="sm"
        title={t('reserverTerrain.complexe.quitter', 'Quitter')}
        variant="Ghost"
      />
    </View>
  ) : null;

  const identite = complexe ? (
    <View
      style={{
        ...carteDeBloc, alignItems: 'center', gap: 8, overflow: 'hidden', paddingTop: 0,
      }}
    >
      {photos[0] ? (
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{ uri: String(photos[0]) }}
          style={{ height: COUVERTURE, marginHorizontal: -16, width: '120%' }}
        />
      ) : (
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.12),
            height: COUVERTURE,
            marginHorizontal: -16,
            width: '120%',
          }}
        />
      )}
      <View style={{ marginTop: -40 }}>
        <LogoComplexe logo={complexe.logo || null} nom={String(complexe.name || '')} taille={80} />
      </View>
      <Text
        accessibilityRole="header"
        style={[Fonts.h3Black, Fonts.neutral00, Fonts.textCenter, { letterSpacing: 1 }]}
      >
        {String(complexe.name || '').toUpperCase()}
      </Text>
      <View style={[Alignments.row, Alignments.wrap, Alignments.justifyCenter, { gap: 8 }]}>
        <BadgeComplexe />
        {complexe.verified ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.success500, 0.14),
              borderColor: withAlpha(Colors.success500, 0.45),
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={[Fonts.p3Bold, Fonts.success500]}>
              {t('reserverTerrain.complexe.verifie', 'Vérifié')}
            </Text>
          </View>
        ) : null}
      </View>
      {complexe.city ? (
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 6 }]}>
          <Image
            source={Images.pin}
            style={[{ height: 14, width: 14 }, ApplicationStyle.tintColor.primary200]}
          />
          <Text style={[Fonts.p2, Fonts.neutral100]}>{String(complexe.city)}</Text>
        </View>
      ) : null}
      {sports ? <Text style={[Fonts.p3, Fonts.neutral200]}>{sports}</Text> : null}
      {communaute ? (
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 8, marginTop: 4 }]}>
          <TouchableOpacity
            accessibilityLabel={estFavori
              ? t('reserverTerrain.complexe.dansTesFavoris', 'Dans tes favoris')
              : t('reserverTerrain.complexe.ajouterAuxFavoris', 'Ajouter aux favoris')}
            accessibilityRole="button"
            accessibilityState={{ busy: Boolean(ajouter?.isPending), selected: estFavori }}
            disabled={Boolean(ajouter?.isPending)}
            onPress={() => (estFavori ? setRetrait(true) : mettreEnFavori('bouton'))}
            style={[
              Alignments.row,
              Alignments.alignCenter,
              {
                backgroundColor: estFavori ? withAlpha(Colors.primary500, 0.16) : 'transparent',
                borderColor: withAlpha(Colors.primary500, 0.6),
                borderRadius: 999,
                borderWidth: 1,
                gap: 8,
                minHeight: 44,
                paddingHorizontal: 16,
              },
            ]}
            testID="complexe-favori"
          >
            <SvgIcon
              color={Colors.primary500}
              height={18}
              name={estFavori ? 'heart-filled' : 'heart'}
              width={18}
            />
            <Text style={[Fonts.p2Bold, Fonts.primary200]}>
              {estFavori
                ? t('reserverTerrain.complexe.dansTesFavoris', 'Dans tes favoris')
                : t('reserverTerrain.complexe.ajouterAuxFavoris', 'Ajouter aux favoris')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={t('reserverTerrain.complexe.plusDActions', 'Plus d’actions')}
            accessibilityRole="button"
            onPress={() => setSignaler(true)}
            style={[
              Alignments.alignCenter,
              Alignments.justifyCenter,
              {
                borderColor: withAlpha(Colors.primary500, 0.6),
                borderRadius: 22,
                borderWidth: 1,
                height: 44,
                width: 44,
              },
            ]}
            testID="complexe-plus"
          >
            <SvgIcon color={Colors.primary500} height={18} name="dots-horizontal" width={18} />
          </TouchableOpacity>
        </View>
      ) : null}
      {annonceFavori ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[Fonts.p3Bold, Fonts.success500, Fonts.textCenter]}
        >
          {annonceFavori}
        </Text>
      ) : null}
      {refusFavori && !retrait ? (
        <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300, Fonts.textCenter]}>
          {refusFavori}
        </Text>
      ) : null}
    </View>
  ) : null;

  // RESA-L6B-2 — le bandeau d'arrivée par l'affiche (A-G12) : seulement s'il n'est pas déjà favori.
  const bandeauAffiche = communaute && complexe && params?.depuis === 'affiche' && !estFavori
    && !annonceFavori ? (
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary500, 0.12),
          borderColor: withAlpha(Colors.primary500, 0.5),
          borderRadius: 16,
          borderWidth: 1,
          gap: 10,
          padding: 14,
        }}
      >
        <View style={[Alignments.row, Alignments.alignCenter, { gap: 10 }]}>
          <SvgIcon color={Colors.primary500} height={20} name="heart" width={20} />
          <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
            {t('reserverTerrain.complexe.ajouteADesFavoris', 'Ajoute {{nom}} à tes favoris', {
              nom: String(complexe.name || ''),
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => mettreEnFavori('affiche')}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 12,
            justifyContent: 'center',
            minHeight: 44,
          }}
          testID="complexe-bandeau-affiche"
        >
          <Text style={[Fonts.p2Bold, Fonts.primary900]}>
            {t('reserverTerrain.complexe.ajouterAuxFavoris', 'Ajouter aux favoris')}
          </Text>
        </TouchableOpacity>
      </View>
    ) : null;

  // RESA-L6B-2 — « Ta fidélité ici » (RC-G10) : un programme actif chez ce complexe.
  const fidelite = communaute ? apercuDeLaFidelite(t, relation?.fidelite) : null;
  const blocFidelite = fidelite ? (
    <View style={carteDeBloc} testID="complexe-fidelite">
      <View style={[Alignments.row, Alignments.alignCenter, { justifyContent: 'space-between' }]}>
        <Text style={titreDeBloc}>
          {t('reserverTerrain.complexe.taFidelite', 'Ta fidélité ici')}
        </Text>
        {!fidelite.disponible ? (
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {`${fidelite.compte}/${fidelite.seuil}`}
          </Text>
        ) : null}
      </View>
      {!fidelite.disponible ? (
        <View
          style={{
            backgroundColor: withAlpha(Colors.primary500, 0.18),
            borderRadius: 4,
            height: 6,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              backgroundColor: Colors.primary500,
              height: 6,
              width: `${Math.round((fidelite.compte / Math.max(1, fidelite.seuil)) * 100)}%`,
            }}
          />
        </View>
      ) : null}
      <Text style={[Fonts.p2, fidelite.disponible ? Fonts.success500 : Fonts.neutral100]}>
        {fidelite.texte}
      </Text>
    </View>
  ) : null;

  // RESA-L6B-2 — le canal (A-G07, A-G08) : membre ⇒ « Canal du complexe » et le NOMBRE de membres
  // (jamais la liste, E-P12) ; sinon, ce que le favori apporte.
  const canal = relation?.canal || null;
  let blocCanal = null;
  if (communaute && complexe && canal?.membre && canal?.chatId) {
    blocCanal = (
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => navigation.navigate(RouteNames.Conversation, { chatId: canal.chatId })}
        style={[carteDeBloc, { gap: 4, minHeight: 52 }]}
        testID="complexe-canal"
      >
        <Text style={titreDeBloc}>{t('reserverTerrain.favoris.canal', 'Canal du complexe')}</Text>
        {Number(canal.membres) > 0 ? (
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t('reserverTerrain.complexe.membres', {
              count: Number(canal.membres),
              defaultValue_one: '{{count}} membre',
              defaultValue_other: '{{count}} membres',
            })}
          </Text>
        ) : null}
      </TouchableOpacity>
    );
  } else if (communaute && complexe && relation) {
    blocCanal = (
      <View style={[carteDeBloc, { alignItems: 'center', flexDirection: 'row', gap: 10 }]}>
        <SvgIcon color={Colors.primary500} height={18} name="heart" width={18} />
        <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
          {t(
            'reserverTerrain.complexe.canalNonMembre',
            'Mets le complexe en favori pour recevoir ses nouvelles.',
          )}
        </Text>
      </View>
    );
  }

  // RESA-L6B-2 — « Nos partenaires » (A-G25, planche RA2 : repris de la fiche club).
  const partenaires = Array.isArray(partenairesLus?.data) ? partenairesLus.data : [];
  const blocPartenaires = partenaires.length ? (
    <View style={carteDeBloc} testID="complexe-partenaires">
      <Text style={titreDeBloc}>
        {t('reserverTerrain.complexe.partenaires', 'Nos partenaires')}
      </Text>
      {partenaires.map((partenaire) => {
        const lien = String(partenaire?.link || '').trim();
        const nom = String(partenaire?.title || '');
        const rangee = (
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}>
            {partenaire?.logo ? (
              <Image
                accessibilityIgnoresInvertColors
                source={{ uri: String(partenaire.logo) }}
                style={{ borderRadius: 19, height: 38, width: 38 }}
              />
            ) : (
              <View
                style={[
                  Alignments.alignCenter,
                  Alignments.justifyCenter,
                  {
                    backgroundColor: withAlpha(Colors.primary500, 0.2),
                    borderRadius: 19,
                    height: 38,
                    width: 38,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                  {nom.split(/\s+/).filter(Boolean).slice(0, 2)
                    .map((mot) => mot.charAt(0).toLocaleUpperCase())
                    .join('')}
                </Text>
              </View>
            )}
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{nom}</Text>
          </View>
        );
        return lien ? (
          <TouchableOpacity
            accessibilityLabel={nom}
            accessibilityRole="link"
            key={`${nom}-${lien}`}
            onPress={() => {
              Linking.openURL(siteComplet(lien)).catch(() => {});
            }}
          >
            {rangee}
          </TouchableOpacity>
        ) : (
          <View key={nom}>{rangee}</View>
        );
      })}
    </View>
  ) : null;

  const ligneDeRegle = (/** @type {string} */ texte, /** @type {boolean} */ enEvidence = false) => (
    <View
      style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}
      testID={enEvidence ? 'regle-age-en-evidence' : undefined}
    >
      <Image
        source={Images.check}
        style={[
          { height: 14, width: 14 },
          enEvidence
            ? ApplicationStyle.tintColor.warning500
            : ApplicationStyle.tintColor.primary500,
        ]}
      />
      <Text
        style={[
          enEvidence ? Fonts.p2Bold : Fonts.p2,
          enEvidence ? Fonts.warning500 : Fonts.neutral100,
        ]}
      >
        {texte}
      </Text>
    </View>
  );

  const regles = complexe ? (
    <View style={carteDeBloc}>
      <Text style={titreDeBloc}>{t('reserverTerrain.complexe.regles', 'Règles')}</Text>
      {ligneDeRegle(
        t('reserverTerrain.regles.age', 'Réservation à partir de {{age}} ans', { age: ageMinimum }),
        sousLAge,
      )}
      {ligneDeRegle(texteAnnulation(t, complexe?.rules?.cancellationDelayHours))}
      {ligneDeRegle(t('reserverTerrain.regles.paiement', 'Paiement sur place'))}
      {String(complexe.playersNote || '').trim() ? (
        <View style={{ gap: 4, marginTop: 4 }}>
          <Text style={[Fonts.p3Bold, Fonts.primary200]}>
            {t('reserverTerrain.complexe.motDuComplexe', 'Le mot du complexe')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral00]}>{String(complexe.playersNote).trim()}</Text>
        </View>
      ) : null}
    </View>
  ) : null;

  const listeDesTerrains = (
    <View style={{ gap: 12 }}>
      {terrainsLus?.isLoading && !terrains.length ? (
        <View
          accessibilityState={{ busy: true }}
          style={{
            backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 24, height: 180,
          }}
        />
      ) : null}
      {!terrainsLus?.isLoading && !terrains.length ? (
        <View style={carteDeBloc}>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {t(
              'reserverTerrain.complexe.aucunTerrain',
              'Ce complexe n’ouvre pas encore ses terrains à la réservation.',
            )}
          </Text>
        </View>
      ) : null}
      {terrains.map((/** @type {any} */ terrain) => (
        <CarteTerrainJoueur
          date={aujourdhui}
          key={terrain.documentId}
          onCreneau={(creneau) => toucherUnCreneau(terrain, creneau)}
          onTelephone={() => setFeuille({ creneau: null, terrain })}
          onVoir={() => versLeCalendrier(terrain)}
          slug={String(slug || '')}
          terrain={terrain}
        />
      ))}
    </View>
  );

  const horaires = horairesLisibles(t, complexe?.openingHours);
  const adresse = complexe?.address?.label ? String(complexe.address.label) : '';
  const telephone = String(complexe?.phoneNumber || '').trim();
  const infos = complexe ? (
    <View style={{ gap: 12 }}>
      {String(complexe.description || '').trim() || photos.length > 1 ? (
        <View style={carteDeBloc}>
          <Text style={titreDeBloc}>{t('reserverTerrain.complexe.leComplexe', 'Le complexe')}</Text>
          {String(complexe.description || '').trim() ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>{String(complexe.description).trim()}</Text>
          ) : null}
          {photos.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={[Alignments.row, { gap: 8 }]}>
                {photos.slice(1).map((/** @type {string} */ photo) => (
                  <Image
                    accessibilityIgnoresInvertColors
                    key={photo}
                    resizeMode="cover"
                    source={{ uri: photo }}
                    style={{ borderRadius: 12, height: 96, width: 140 }}
                  />
                ))}
              </View>
            </ScrollView>
          ) : null}
        </View>
      ) : null}
      {horaires.length ? (
        <View style={carteDeBloc}>
          <Text style={titreDeBloc}>
            {t(
              'reserverTerrain.complexe.horaires',
              'Horaires d’accueil',
            )}
          </Text>
          {horaires.map((ligne) => (
            <View
              key={ligne.jours}
              style={[Alignments.row, { gap: 12, justifyContent: 'space-between' }]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{ligne.jours}</Text>
              <Text style={[Fonts.p2, Fonts.neutral100, { flexShrink: 1, textAlign: 'right' }]}>
                {ligne.heures}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {adresse ? (
        <View style={carteDeBloc}>
          <Text style={titreDeBloc}>{t('reserverTerrain.complexe.adresse', 'Adresse')}</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{adresse}</Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              icon="pin"
              onPress={() => openExternalMap({
                label: adresse,
                latitude: complexe?.address?.lat,
                longitude: complexe?.address?.lng,
              })}
              title={t('reserverTerrain.complexe.itineraire', 'Itinéraire')}
              variant="Secondary"
            />
          </View>
        </View>
      ) : null}
      {telephone ? (
        <View style={carteDeBloc}>
          <Text style={titreDeBloc}>
            {t('reserverTerrain.complexe.telephone', 'Téléphone du complexe')}
          </Text>
          <Text selectable style={[Fonts.p1Bold, Fonts.primary200]}>
            {numeroLisible(telephone)}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              icon="phone"
              onPress={() => {
                Linking.openURL(`tel:${telephone}`).catch(() => {});
              }}
              title={t('reserverTerrain.complexe.appeler', 'Appeler')}
              variant="Secondary"
            />
          </View>
        </View>
      ) : null}
      {String(complexe.websiteUrl || '').trim() ? (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => {
            Linking.openURL(siteComplet(complexe.websiteUrl)).catch(() => {});
          }}
          style={[carteDeBloc, Alignments.row, Alignments.alignCenter, { minHeight: 52 }]}
        >
          <Image
            source={Images.share}
            style={[{ height: 16, width: 16 }, ApplicationStyle.tintColor.primary500]}
          />
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>{siteLisible(complexe.websiteUrl)}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  ) : null;

  let page = etat;
  if (!page && complexe && surOrdinateur) {
    // OR2 : la colonne principale (identité, infos, règles) et la colonne « Réserver » à droite.
    page = (
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 24 }]}>
        <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
          {identite}
          {infos}
          {blocPartenaires}
          {blocFidelite}
          {regles}
          {blocCanal}
        </View>
        <View style={{ gap: 12, width: COLONNE_RESERVER }}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {t('reserverTerrain.complexe.reserverAujourdhui', 'Réserver · aujourd’hui')}
          </Text>
          {listeDesTerrains}
        </View>
      </View>
    );
  } else if (!page && complexe) {
    page = (
      <View style={{ gap: 16 }}>
        {identite}
        <SegmentedControl
          onChange={setSegment}
          options={[
            { label: t('reserverTerrain.complexe.segmentReserver', 'Réserver'), value: 'reserver' },
            { label: t('reserverTerrain.complexe.segmentInfos', 'Infos'), value: 'infos' },
          ]}
          value={segment}
        />
        {segment === 'reserver' ? (
          <>
            {listeDesTerrains}
            {blocFidelite}
            {regles}
          </>
        ) : (
          <>
            {infos}
            {blocPartenaires}
          </>
        )}
        {blocCanal}
      </View>
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      bottomInsetMode="screen"
      contentContainerStyle={[Spaces.paddingTop[0], Alignments.fill]}
    >
      <ScrollView
        contentContainerStyle={{
          alignSelf: 'center',
          gap: 16,
          maxWidth: surOrdinateur ? 1160 : undefined,
          paddingBottom: 32,
          paddingTop: 12,
          width: '100%',
        }}
        refreshControl={(
          <RefreshControl
            colors={[Colors.primary500]}
            onRefresh={() => {
              complexeLu.refetch?.();
              terrainsLus.refetch?.();
            }}
            refreshing={false}
            tintColor={Colors.primary500}
          />
        )}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {bandeauApercu}
        {bandeauAffiche}
        {page}
      </ScrollView>
      {communaute && slug ? (
        <FeuilleSignaler
          onFermer={() => setSignaler(false)}
          slug={String(slug)}
          visible={signaler}
        />
      ) : null}
      {communaute ? (
        <FeuilleRetirerFavori
          enCours={Boolean(retirer?.isPending)}
          explication={t(
            'reserverTerrain.complexe.resterasDansLeCanal',
            'Tu resteras dans le canal (tu peux le quitter depuis le canal).',
          )}
          onFermer={() => setRetrait(false)}
          onRetirer={retirerDesFavoris}
          refus={retrait ? refusFavori : null}
          visible={retrait}
        />
      ) : null}
      <FeuilleTelephone
        creneau={feuille?.creneau || null}
        onFermer={() => setFeuille(null)}
        telephone={feuille?.terrain?.phone || null}
        terrain={feuille?.terrain || null}
        visible={Boolean(feuille)}
      />
    </ScreenContainer>
  );
}

export default ReserverComplexe;
