import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TextInput, TouchableOpacity, View,
} from 'react-native';

import { messageDeRefus } from '@/domains/complexe/complexeGerant';
import {
  corpsDeLaPage,
  DESCRIPTION_MAX,
  erreursDeLaPage,
  horairesEnLignes,
  nomDuJour,
  PHOTOS_MAX,
} from '@/domains/complexe/pageDuComplexe';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import AutocompleteAddressInput
  from '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BadgeComplexe from '@/views/complexe/components/BadgeComplexe';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import LogoComplexe from '@/views/complexe/components/LogoComplexe';
import PartenairesDuComplexe from '@/views/complexe/components/PartenairesDuComplexe';

import { RouteNames } from '@/navigation/routeNames';

import {
  useComplexeChoisi,
  useComplexeGere,
  useModifierComplexe,
} from '@/services/complexe/complexeQueries';
import { televerserPhoto } from '@/services/complexe/complexeService';

import { COMPLEXES_JOUEUR } from '@/config/fonctionsMasquees';
import MediaPlatform from '@/platform/media';

/** Une photo : 10 Mo au plus (comme les photos d'un terrain, E-G08). */
const PHOTO_OCTETS_MAX = 10 * 1024 * 1024;

/**
 * E-G11 — « MON COMPLEXE », LA PAGE — RESA-L5B-2 (20/10/2026), planches EG11 (états 1 à 4) et RA5
 * (logo, partenaires) ; plan :802-845 ; A-G04, A-G05, A-G25, RG-TEL, D6, RC-T03 ; serveurs RESA-L1A
 * (`GET|PUT /complexes/:id/manage`) et RESA-L4 (partenaires).
 * Dans l'ordre : « Ta page publique, telle que la voient les joueurs. » (+ « Voir ma page » quand
 * l'espace joueur est allumé), « IDENTITÉ » (logo carré et « Changer le logo », nom, photos de
 * couverture — 8 au plus, retirer demande confirmation —, description en 500 caractères), « NOS
 * PARTENAIRES » (RA5), « COORDONNÉES » (adresse avec sa position, téléphone AFFICHÉ — celui du
 * complexe, jamais d'un joueur —, e-mail, site web et SIRET facultatifs), « HORAIRES D'ACCUEIL »
 * (pour l'affichage, distincts des créneaux : une plage par jour), « SPORTS » (déduits des
 * terrains, pas d'ajout libre), « CE QUE LA PAGE AFFICHE » (l'âge minimum et l'annulation,
 * « Changer dans Réglages »), les pastilles (« Complexe de réservation » toujours ; « Vérifié »
 * quand FoundClub l'a vérifié), puis « Enregistrer » (seuls les champs changés partent ; « Ta page
 * est à jour. »).
 * États : chargement, erreur, complexe suspendu (« Ta page est masquée »), champs obligatoires.
 * Paramètre de route : `complexeId` (sinon SON complexe). Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeMaPage() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexeId } = useComplexeChoisi(params?.complexeId);
  const lecture = useComplexeGere(complexeId);
  const modifier = useModifierComplexe();
  const enregistre = lecture.data || null;

  const [saisie, setSaisie] = useState(/** @type {Record<string, any> | null} */ (null));
  const [tente, setTente] = useState(false);
  const [message, setMessage] = useState(
    /** @type {{ texte: string, ton: 'erreur' | 'ok' } | null} */ (null),
  );
  const [aRetirer, setARetirer] = useState(/** @type {any} */ (null));
  const [envoi, setEnvoi] = useState('');

  // La saisie part du complexe lu (une fois).
  useEffect(() => {
    if (enregistre && !saisie) {
      setSaisie({
        adresse: enregistre.address || null,
        description: String(enregistre.description || ''),
        email: String(enregistre.email || ''),
        horaires: horairesEnLignes(enregistre.openingHours),
        logo: enregistre.logo || null,
        nom: String(enregistre.name || ''),
        photos: Array.isArray(enregistre.photos) ? enregistre.photos : [],
        siret: String(enregistre.siret || ''),
        site: String(enregistre.websiteUrl || ''),
        telephone: String(enregistre.phoneNumber || ''),
      });
    }
  }, [enregistre, saisie]);

  const changer = (/** @type {Record<string, any>} */ morceau) => {
    setMessage(null);
    setSaisie((avant) => ({ ...(avant || {}), ...morceau }));
  };
  const carte = {
    backgroundColor: withAlpha(Colors.primary700, 0.45),
    borderColor: withAlpha(Colors.primary500, 0.5),
    borderRadius: 16,
    borderWidth: 1,
  };
  const legende = (/** @type {string} */ libelle) => (
    <Text
      accessibilityRole="header"
      style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}
    >
      {libelle.toUpperCase()}
    </Text>
  );
  const erreurs = saisie ? erreursDeLaPage(saisie) : {};
  const textesDErreur = {
    adresseObligatoire: t('complexeMaPage.erreurs.adresse', 'L’adresse est obligatoire.'),
    emailInvalide: t('complexeMaPage.erreurs.email', 'E-mail invalide.'),
    horairesInvalides: t(
      'complexeMaPage.erreurs.horaires',
      'Un horaire est invalide : HH:MM, et la fin après le début.',
    ),
    nomObligatoire: t('complexeMaPage.erreurs.nom', 'Le nom est obligatoire.'),
    siretInvalide: t('complexeMaPage.erreurs.siret', 'Le SIRET compte 14 chiffres.'),
    siteInvalide: t('complexeMaPage.erreurs.site', 'Le site web doit commencer par http(s)://.'),
    telephoneObligatoire: t('complexeMaPage.erreurs.telephone', 'Le téléphone est obligatoire.'),
  };
  const erreurDe = (/** @type {string} */ champ) => (tente && erreurs[champ]
    ? /** @type {Record<string, string>} */ (textesDErreur)[erreurs[champ]]
    : undefined);
  const ligneDErreur = (/** @type {string} */ champ) => {
    const texte = erreurDe(champ);
    return texte ? (
      <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>{texte}</Text>
    ) : null;
  };

  // ── Les images (logo, photos) ──────────────────────────────────────────────────────────
  const choisirUneImage = async (/** @type {'logo' | 'photo'} */ quoi) => {
    setMessage(null);
    const choisie = await MediaPlatform.pickImage();
    if (!choisie || choisie?.didCancel) return;
    const fichier = choisie?.assets?.[0] || choisie;
    if (Number(fichier?.fileSize ?? fichier?.size ?? 0) > PHOTO_OCTETS_MAX) {
      setMessage({
        texte: t('complexeMaPage.photoTropLourde', 'Cette photo dépasse 10 Mo.'),
        ton: 'erreur',
      });
      return;
    }
    setEnvoi(quoi);
    try {
      const envoyee = await televerserPhoto(choisie);
      if (envoyee?.id) {
        const image = { id: envoyee.id, url: envoyee.url };
        setSaisie((avant) => (quoi === 'logo'
          ? { ...(avant || {}), logo: image }
          : { ...(avant || {}), photos: [...(avant?.photos || []), image].slice(0, PHOTOS_MAX) }));
      }
    } catch {
      setMessage({
        texte: t('complexeMaPage.photoEchec', 'La photo n’est pas partie. Réessaie.'),
        ton: 'erreur',
      });
    } finally {
      setEnvoi('');
    }
  };

  // ── Enregistrer ────────────────────────────────────────────────────────────────────────
  const aJour = t('complexeMaPage.aJour', 'Ta page est à jour.');
  const enregistrer = async () => {
    if (!saisie || !enregistre) return;
    setTente(true);
    setMessage(null);
    if (Object.keys(erreursDeLaPage(saisie)).length) return;
    const donnees = corpsDeLaPage(saisie, enregistre);
    if (!Object.keys(donnees).length) {
      setMessage({ texte: aJour, ton: 'ok' });
      return;
    }
    try {
      await modifier.mutateAsync({ complexeId, donnees });
      setMessage({ texte: aJour, ton: 'ok' });
    } catch (erreur) {
      setMessage({
        texte: messageDeRefus(
          t,
          erreur,
          t('complexeReservations.fiche.erreurGeste', 'Le geste n’a pas pu être fait.'),
        ),
        ton: 'erreur',
      });
    }
  };

  let corps;
  if (lecture.isLoading || (!saisie && !lecture.error)) {
    corps = (
      <View accessibilityState={{ busy: true }} style={{ gap: 12 }} testID="page-squelette">
        {[160, 220, 120].map((hauteur) => (
          <View
            key={hauteur}
            style={[
              ApplicationStyle.borderRadius16,
              { backgroundColor: withAlpha(Colors.neutral00, 0.06), height: hauteur },
            ]}
          />
        ))}
      </View>
    );
  } else if (!saisie) {
    corps = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeMaPage.erreur', 'Impossible de charger ta page.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => lecture.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  } else {
    const regles = enregistre?.rules || {};
    corps = (
      <View style={{ gap: 20 }}>
        {enregistre?.status === 'suspendu' ? (
          <BandeauComplexe
            testID="page-suspendue"
            texte={t('complexeMaPage.suspendue', 'Ta page est masquée : complexe suspendu.')}
            ton="attention"
          />
        ) : null}

        {/* IDENTITÉ */}
        <View style={[carte, Spaces.padding[16], { gap: 16 }]}>
          {legende(t('complexeMaPage.identite', 'Identité'))}
          <View style={[Alignments.row, Alignments.alignCenter, { gap: 12 }]}>
            <LogoComplexe logo={saisie.logo?.url || null} nom={saisie.nom} taille={64} />
            <View style={{ flex: 1, gap: 4 }}>
              <Button
                isLoading={envoi === 'logo'}
                onPress={() => choisirUneImage('logo')}
                size="sm"
                title={t('complexeMaPage.changerLogo', 'Changer le logo')}
                variant="Secondary"
              />
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'complexeMaPage.logoAide',
                  'Ton logo apparaît sur ta page, sur ta carte dans la recherche et sur tes '
                  + 'affiches.',
                )}
              </Text>
            </View>
          </View>
          <Input
            accessibilityLabel={t('complexeMaPage.nom', 'Nom')}
            label={t('complexeMaPage.nom', 'Nom')}
            maxLength={120}
            onChangeText={(valeur) => changer({ nom: String(valeur) })}
            value={saisie.nom}
          />
          {ligneDErreur('nom')}
          <View style={{ gap: 8 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('complexeMaPage.photos', 'Photos de couverture (jusqu’à {{max}})', {
                max: PHOTOS_MAX, ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
              {saisie.photos.map((/** @type {any} */ photo) => (
                <View key={photo.id} style={{ height: 72, width: 96 }}>
                  <Image
                    source={{ uri: photo.url }}
                    style={{ borderRadius: 10, height: 72, width: 96 }}
                  />
                  <TouchableOpacity
                    accessibilityLabel={t('complexeMaPage.retirerPhoto', 'Retirer cette photo')}
                    accessibilityRole="button"
                    onPress={() => setARetirer(photo)}
                    style={[Alignments.alignCenter, Alignments.justifyCenter, {
                      backgroundColor: withAlpha(Colors.primary900, 0.8),
                      borderRadius: 22,
                      height: 44,
                      position: 'absolute',
                      right: -8,
                      top: -8,
                      width: 44,
                    }]}
                    testID={`page-photo-retirer-${photo.id}`}
                  >
                    <GlyphIcon color={Colors.neutral00} name="xmark" size={12} />
                  </TouchableOpacity>
                </View>
              ))}
              {saisie.photos.length < PHOTOS_MAX ? (
                <TouchableOpacity
                  accessibilityLabel={t('complexeMaPage.ajouterPhoto', 'Ajouter une photo')}
                  accessibilityRole="button"
                  onPress={() => choisirUneImage('photo')}
                  style={[Alignments.alignCenter, Alignments.justifyCenter, {
                    borderColor: withAlpha(Colors.primary500, 0.6),
                    borderRadius: 10,
                    borderStyle: 'dashed',
                    borderWidth: 1,
                    height: 72,
                    width: 96,
                  }]}
                >
                  <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                    {envoi === 'photo' ? '…' : '+'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Input
              accessibilityLabel={t('complexeMaPage.description', 'Description')}
              label={t('complexeMaPage.description', 'Description')}
              maxLength={DESCRIPTION_MAX}
              multiline
              onChangeText={(valeur) => changer({
                description: String(valeur).slice(0, DESCRIPTION_MAX),
              })}
              value={saisie.description}
            />
            <Text style={[Fonts.p3, Fonts.neutral200, { alignSelf: 'flex-end' }]}>
              {t('complexeGerant.reglages.compte', '{{nombre}} / {{max}}', {
                max: DESCRIPTION_MAX, nombre: saisie.description.length, ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
        </View>

        {/* NOS PARTENAIRES (RA5) */}
        <View style={[carte, Spaces.padding[16]]}>
          <PartenairesDuComplexe complexeId={complexeId} />
        </View>

        {/* COORDONNÉES */}
        <View style={[carte, Spaces.padding[16], { gap: 12 }]}>
          {legende(t('complexeMaPage.coordonnees', 'Coordonnées'))}
          <AutocompleteAddressInput
            address={saisie.adresse || undefined}
            label={t('complexeMaPage.adresse', 'Adresse')}
            permettreLieuSurCarte
            placeholder={t('complexeMaPage.adresseExemple', 'Adresse du complexe')}
            setAddress={(option) => changer({ adresse: option || null })}
          />
          {ligneDErreur('adresse')}
          <PhoneInput
            label={t('complexeMaPage.telephone', 'Téléphone affiché')}
            onBlur={() => {}}
            onChange={(/** @type {string} */ valeur) => changer({
              telephone: String(valeur || ''),
            })}
            value={saisie.telephone}
          />
          {ligneDErreur('telephone')}
          <Input
            accessibilityLabel={t('complexeMaPage.email', 'E-mail')}
            autoCapitalize="none"
            keyboardType="email-address"
            label={t('complexeMaPage.email', 'E-mail')}
            onChangeText={(valeur) => changer({ email: String(valeur) })}
            value={saisie.email}
          />
          {ligneDErreur('email')}
          <Input
            accessibilityLabel={t('complexeMaPage.site', 'Site web (facultatif)')}
            autoCapitalize="none"
            keyboardType="url"
            label={t('complexeMaPage.site', 'Site web (facultatif)')}
            onChangeText={(valeur) => changer({ site: String(valeur) })}
            value={saisie.site}
          />
          {ligneDErreur('site')}
          <Input
            accessibilityLabel={t('complexeMaPage.siret', 'SIRET (facultatif)')}
            keyboardType="number-pad"
            label={t('complexeMaPage.siret', 'SIRET (facultatif)')}
            onChangeText={(valeur) => changer({ siret: String(valeur) })}
            placeholder={t('complexeMaPage.siretExemple', '14 chiffres')}
            value={saisie.siret}
          />
          {ligneDErreur('siret')}
        </View>

        {/* HORAIRES D'ACCUEIL */}
        <View style={[carte, Spaces.padding[16], { gap: 8 }]}>
          {legende(t('complexeMaPage.horaires', 'Horaires d’accueil'))}
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeMaPage.horairesAide',
              'Pour l’affichage ; les créneaux se règlent par terrain.',
            )}
          </Text>
          {saisie.horaires.map((/** @type {any} */ ligne, rang) => {
            const jour = nomDuJour(ligne.day);
            const changerLigne = (/** @type {Record<string, any>} */ morceau) => changer({
              horaires: saisie.horaires.map((/** @type {any} */ autre, i) => (
                i === rang ? { ...autre, ...morceau } : autre)),
            });
            const heure = (/** @type {'from' | 'to'} */ cle, /** @type {string} */ etiquette) => (
              <TextInput
                accessibilityLabel={`${jour} : ${etiquette}`}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={(valeur) => changerLigne({ [cle]: String(valeur) })}
                style={[Fonts.p2, Fonts.neutral00, {
                  borderBottomColor: withAlpha(Colors.neutral00, 0.4),
                  borderBottomWidth: 1,
                  minHeight: 44,
                  textAlign: 'center',
                  width: 64,
                }]}
                value={ligne[cle]}
              />
            );
            return (
              <View
                key={ligne.day}
                style={[Alignments.row, Alignments.alignCenter, { gap: 8, minHeight: 48 }]}
              >
                <TouchableOpacity
                  accessibilityLabel={t('complexeMaPage.ouvertLe', 'Ouvert le {{jour}}', {
                    jour: jour.toLowerCase(), ...SANS_ECHAPPEMENT,
                  })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: ligne.ouvert }}
                  onPress={() => changerLigne({ ouvert: !ligne.ouvert })}
                  style={[Alignments.row, Alignments.alignCenter, {
                    gap: 8, minHeight: 44, width: 136,
                  }]}
                >
                  <View
                    style={{
                      backgroundColor: ligne.ouvert ? Colors.primary500 : 'transparent',
                      borderColor: Colors.primary500,
                      borderRadius: 6,
                      borderWidth: 2,
                      height: 22,
                      width: 22,
                    }}
                  />
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{jour}</Text>
                </TouchableOpacity>
                {ligne.ouvert ? (
                  <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
                    {heure('from', t('complexeMaPage.ouverture', 'ouverture'))}
                    <Text style={[Fonts.p2, Fonts.neutral200]}>–</Text>
                    {heure('to', t('complexeMaPage.fermeture', 'fermeture'))}
                  </View>
                ) : (
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {t('complexeMaPage.ferme', 'Fermé')}
                  </Text>
                )}
              </View>
            );
          })}
          {ligneDErreur('horaires')}
        </View>

        {/* SPORTS */}
        <View style={[carte, Spaces.padding[16], { gap: 8 }]}>
          {legende(t('complexeMaPage.sports', 'Sports'))}
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            {(enregistre?.sports || []).map((/** @type {any} */ sport) => (
              <View
                key={sport.documentId}
                style={{
                  backgroundColor: withAlpha(Colors.primary500, 0.18),
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{sport.name}</Text>
              </View>
            ))}
          </View>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'complexeMaPage.sportsAide',
              'Ils viennent de tes terrains : ajoute un terrain pour ajouter un sport.',
            )}
          </Text>
        </View>

        {/* CE QUE LA PAGE AFFICHE */}
        <View style={[carte, Spaces.padding[16], { gap: 8 }]}>
          {legende(t('complexeMaPage.affiche', 'Ce que la page affiche'))}
          <Text style={[Fonts.p2, Fonts.neutral00]}>
            {t(
              'complexeMaPage.regles',
              'Réservation à partir de {{age}} ans · Annulation gratuite jusqu’à {{heures}} h '
              + 'avant',
              {
                age: Number(regles.minAge) || 18,
                heures: Number(regles.cancellationDelayHours) || 0,
                ...SANS_ECHAPPEMENT,
              },
            )}
          </Text>
          <TouchableOpacity
            accessibilityRole="link"
            onPress={() => navigation.navigate(RouteNames.ComplexeReglages, { complexeId })}
            style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
          >
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>
              {t('complexeMaPage.changerReglages', 'Changer dans Réglages')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* LES PASTILLES */}
        <View style={{ gap: 8 }}>
          <View style={{ alignSelf: 'flex-start' }}><BadgeComplexe /></View>
          {enregistre?.verified ? (
            <Text style={[Fonts.p3Bold, Fonts.success500]}>
              {t('complexeMaPage.verifie', 'Vérifié')}
            </Text>
          ) : (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'complexeMaPage.pasVerifie',
                '« Vérifié » s’ajoutera quand FoundClub l’aura vérifié.',
              )}
            </Text>
          )}
        </View>

        {message ? (
          <BandeauComplexe testID="page-message" texte={message.texte} ton={message.ton} />
        ) : null}
        <View testID="page-enregistrer">
          <Button
            disabled={Boolean(modifier.isPending)}
            isLoading={Boolean(modifier.isPending)}
            onPress={enregistrer}
            title={t('complexeMaPage.enregistrer', 'Enregistrer')}
          />
        </View>
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
          maxWidth: 720,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={[Fonts.h2Black, Fonts.neutral00, { letterSpacing: 1 }]}
          >
            {t('complexeMaPage.titre', 'Mon complexe').toUpperCase()}
          </Text>
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.wrap, { gap: 8 }]}>
            <Text style={[Fonts.p2, Fonts.neutral200, { flexShrink: 1 }]}>
              {t('complexeMaPage.apercu', 'Ta page publique, telle que la voient les joueurs.')}
            </Text>
            {COMPLEXES_JOUEUR && enregistre?.slug ? (
              <TouchableOpacity
                accessibilityRole="link"
                onPress={() => navigation.navigate(RouteNames.ReserverComplexe, {
                  slug: enregistre.slug,
                })}
                style={[Alignments.justifyCenter, { minHeight: 44 }]}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {t('complexeMaPage.voirMaPage', 'Voir ma page')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        {corps}
      </ScrollView>

      <BottomModal
        close={() => setARetirer(null)}
        isVisible={Boolean(aRetirer)}
        webPresentation="dialog"
      >
        <View style={{ gap: 16 }} testID="page-photo-feuille">
          <View style={{ gap: 4 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('complexeMaPage.retirerPhotoTitre', 'Retirer cette photo ?')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200]}>
              {t('complexeMaPage.retirerPhotoDit', 'Elle disparaît de ta page publique.')}
            </Text>
          </View>
          <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
            <View style={{ flexBasis: 140, flexGrow: 1 }}>
              <Button
                onPress={() => setARetirer(null)}
                title={t('complexeMaPage.garder', 'Garder')}
                variant="Ghost"
              />
            </View>
            <View style={{ flexBasis: 140, flexGrow: 1 }} testID="page-photo-confirmer">
              <Button
                onPress={() => {
                  changer({
                    photos: (saisie?.photos || []).filter(
                      (/** @type {any} */ photo) => photo.id !== aRetirer?.id,
                    ),
                  });
                  setARetirer(null);
                }}
                title={t('complexeMaPage.retirer', 'Retirer')}
                variant="DangerFilled"
              />
            </View>
          </View>
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default ComplexeMaPage;
