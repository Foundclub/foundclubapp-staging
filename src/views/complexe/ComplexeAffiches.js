import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import {
  encartFidelite,
  MENTION_PROMOTION,
  prixDe,
  PROMO_TEXTE_MAX,
  TEXTE_NEUTRE,
  textePromotion,
} from '@/domains/complexe/afficheDuComplexe';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';
import BandeauComplexe from '@/views/complexe/components/BandeauComplexe';
import DeuxVolets from '@/views/complexe/components/DeuxVolets';

import { RouteNames } from '@/navigation/routeNames';

import { FILE_SHARE_OUTCOMES } from '@/platform/share/fileShareContract';

import { partagerAffiche, useApercuAffiche } from '@/services/complexe/complexeAfficheService';
import { useComplexeChoisi, useFideliteDuComplexe } from '@/services/complexe/complexeQueries';

import { useIsDesktop } from '@/responsive';
import { buildPublicWebUrl, buildShareMessageWithUrl } from '@/utils/shareLinks';

/** Le temps de laisser finir la saisie du prix ou du texte avant de redemander l'aperçu. */
const ATTENTE_DE_SAISIE_MS = 600;

/**
 * La valeur, une fois la saisie posée (l'aperçu n'est pas redemandé à chaque lettre).
 * @template T
 * @param {T} valeur - La valeur saisie.
 * @returns {T} La valeur, en retard de 600 ms.
 */
const useApresSaisie = (valeur) => {
  const [posee, setPosee] = useState(valeur);
  useEffect(() => {
    const minuterie = setTimeout(() => setPosee(valeur), ATTENTE_DE_SAISIE_MS);
    return () => clearTimeout(minuterie);
  }, [valeur]);
  return posee;
};

/**
 * E-G13 — LES AFFICHES DU COMPLEXE — RESA-L5B-2 (20/10/2026), planches EG13 et RA7 (qui en
 * remplace les états 1, 2, 4 et 5) ; plan :890-932 ; A-G10, A-G11, A-G12, A-G30, A-G31, RC-G11 ;
 * serveur RESA-L4 (`POST /complexes/:id/affiche`, le dessin de l'affiche club du moteur
 * d'affiches).
 * Dans l'ordre de RA7 : « Ton affiche complexe est prête », « Fais-la voir : chaque scan ouvre ta
 * page. », le style (Écusson, Famille), l'aperçu, « LE TEXTE » — « Neutre » (« Scannez et ajoutez
 * le complexe à vos favoris. ») ou « Promotion » (le prix de la place, le texte modifiable, la
 * mention fixe « La promotion s'applique sur place. L'app ne l'encaisse pas. », « Réinitialiser »)
 * —, la fidélité sur l'affiche (lue dans le programme de E-G14, allumée d'office ; sans programme
 * actif, l'invitation « Crée ton programme de fidélité… »), puis « Partager l'affiche », « Story
 * 9:16 », « Imprimer en A4 » (PDF). Le code QR mène à la page du complexe avec le bandeau du favori
 * (A-G12) : c'est le serveur qui l'écrit. Aucun prix calculé ni encaissé (RC-G11). Le moteur n'a
 * pas de photo de fond : l'affiche porte le logo (ou les initiales). Sur ordinateur, l'aperçu à
 * gauche, les réglages à droite (plan §9). Complexe suspendu : les affiches sont en pause.
 * Paramètre de route : `complexeId` (sinon SON complexe). Caché par `COMPLEXES_GERANT`.
 * @returns {import('react').ReactElement} L'écran.
 */
function ComplexeAffiches() {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const route = useRoute();
  const params = /** @type {{ complexeId?: string } | undefined} */ (route?.params);
  const { complexe, complexeId } = useComplexeChoisi(params?.complexeId);
  const programme = useFideliteDuComplexe(complexeId).data?.programme || null;
  const encart = encartFidelite(t, programme);
  const surOrdinateur = useIsDesktop();
  const enPause = Boolean(complexe?.status) && complexe.status !== 'actif';

  const [style, setStyle] = useState(/** @type {'ecusson' | 'famille'} */ ('ecusson'));
  const [texte, setTexte] = useState(/** @type {'neutre' | 'promotion'} */ ('neutre'));
  const [prix, setPrix] = useState('5');
  const [textePromo, setTextePromo] = useState('');
  const [texteModifie, setTexteModifie] = useState(false);
  const [fidelite, setFidelite] = useState(true);
  const [occupe, setOccupe] = useState('');
  const [erreur, setErreur] = useState('');
  const [enregistree, setEnregistree] = useState('');

  const phrase = textePromotion(prixDe(prix));
  const textePromotionAffiche = texteModifie ? textePromo : phrase;
  const choix = {
    fidelite: Boolean(encart) && fidelite,
    prix: useApresSaisie(prix),
    style,
    texte,
    texteModifie,
    textePromo: useApresSaisie(textePromotionAffiche),
  };
  const apercu = useApercuAffiche(complexeId, choix, { enabled: !enPause });

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
  const puce = (
    /** @type {string} */ libelle,
    /** @type {boolean} */ choisie,
    /** @type {() => void} */ onPress,
  ) => (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: choisie }}
      key={libelle}
      onPress={onPress}
      style={{
        backgroundColor: choisie ? withAlpha(Colors.primary500, 0.22) : 'transparent',
        borderColor: choisie ? Colors.primary500 : withAlpha(Colors.primary500, 0.4),
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: 'center',
        minHeight: 44,
        paddingHorizontal: 16,
      }}
    >
      <Text style={[Fonts.p2Bold, choisie ? Fonts.neutral00 : Fonts.primary200]}>{libelle}</Text>
    </TouchableOpacity>
  );
  const choixDuTexte = (
    /** @type {'neutre' | 'promotion'} */ cle,
    /** @type {string} */ titre,
    /** @type {string} */ dit,
  ) => {
    const choisi = texte === cle;
    return (
      <TouchableOpacity
        accessibilityLabel={titre}
        accessibilityRole="radio"
        accessibilityState={{ checked: choisi }}
        key={cle}
        onPress={() => setTexte(cle)}
        style={[carte, Spaces.padding[12], {
          borderColor: choisi ? Colors.primary500 : withAlpha(Colors.primary500, 0.3),
          borderWidth: choisi ? 2 : 1,
          gap: 4,
        }]}
        testID={`affiche-texte-${cle}`}
      >
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{dit}</Text>
      </TouchableOpacity>
    );
  };

  const partager = async (/** @type {'a4' | 'post' | 'story'} */ format) => {
    if (!complexeId || occupe) return;
    setErreur('');
    setEnregistree('');
    setOccupe(format);
    try {
      // RESA-FIN-APP (20/10) — le texte du partage : le complexe et le lien de sa page (celui du QR).
      // Sur Android il part dans le presse-papiers (l'affiche part par « ouvrir avec »).
      const lien = complexe?.slug
        ? buildPublicWebUrl({ path: `/annuaire/complexes/${complexe.slug}?depuis=affiche` })
        : null;
      const message = buildShareMessageWithUrl({
        intro: t('complexeAffiches.texteDuPartage', 'Réserve ton terrain chez {{nom}} sur FoundClub.', {
          nom: String(complexe?.name || ''), ...SANS_ECHAPPEMENT,
        }),
        url: lien,
      });
      const resultat = await partagerAffiche(complexeId, { ...choix, format }, {
        dialogTitle: t('complexeAffiches.partager', 'Partager l’affiche'),
        message,
      });
      // RESA-FIN-APP — tournée 2 : sur Android l'affiche est RANGÉE (Photos, Téléchargements) ; un
      // fichier rangé sans un mot est indiscernable d'un échec : l'écran dit où (mots de l'affiche
      // d'un événement). Feuille de partage (iPhone), téléchargement (site) : rien de plus.
      const copie = resultat?.messageCopied
        ? ` ${t('showcase.messageCopied', 'Le texte est copié : colle-le avec l’image.')}`
        : '';
      if (resultat?.outcome === FILE_SHARE_OUTCOMES.GALLERY) {
        setEnregistree(`${t('showcase.savedGallery', 'C’est enregistré dans ta galerie photo.')}${copie}`);
      } else if (resultat?.outcome === FILE_SHARE_OUTCOMES.DOWNLOADS) {
        setEnregistree(`${t('showcase.savedDownloads', 'C’est enregistré dans tes téléchargements.')}${copie}`);
      }
    } catch (_e) {
      setErreur(t('complexeAffiches.erreur', 'L’affiche n’a pas pu être créée.'));
    } finally {
      setOccupe('');
    }
  };

  // ── L'aperçu ───────────────────────────────────────────────────────────────────────────
  let vueDeLAffiche;
  if (apercu.data) {
    vueDeLAffiche = (
      <Image
        accessibilityLabel={t('complexeAffiches.apercu', 'Aperçu de l’affiche')}
        resizeMode="contain"
        source={{ uri: apercu.data }}
        style={{ aspectRatio: 4 / 5, borderRadius: 12, width: '100%' }}
      />
    );
  } else if (apercu.isLoading) {
    vueDeLAffiche = (
      <View
        accessibilityState={{ busy: true }}
        style={[ApplicationStyle.borderRadius16, {
          aspectRatio: 4 / 5, backgroundColor: withAlpha(Colors.neutral00, 0.06), width: '100%',
        }]}
        testID="affiche-generation"
      />
    );
  } else {
    vueDeLAffiche = (
      <View
        accessibilityRole="alert"
        style={[carte, Spaces.padding[16], {
          backgroundColor: withAlpha(Colors.error500, 0.08),
          borderColor: withAlpha(Colors.error500, 0.4),
          gap: 8,
        }]}
      >
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
          {t('complexeAffiches.erreur', 'L’affiche n’a pas pu être créée.')}
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Button
            onPress={() => apercu.refetch?.()}
            title={t('complexeGerant.accueil.reessayer', 'Réessayer')}
            variant="Secondary"
          />
        </View>
      </View>
    );
  }

  const libelleFidelite = t('complexeAffiches.fidelite.titre', 'Ta fidélité sur l’affiche');
  const reglages = (
    <View style={{ gap: 20 }}>
      <View style={{ gap: 8 }}>
        {legende(t('complexeAffiches.texte.titre', 'Le texte'))}
        {choixDuTexte(
          'neutre',
          t('complexeAffiches.texte.neutre', 'Neutre'),
          t('complexeAffiches.texte.neutreDit', TEXTE_NEUTRE),
        )}
        {choixDuTexte(
          'promotion',
          t('complexeAffiches.texte.promotion', 'Promotion'),
          phrase || t(
            'complexeAffiches.texte.promotionDit',
            'Une place de réservation à un prix que tu fixes.',
          ),
        )}
        {texte === 'promotion' ? (
          <View style={[carte, Spaces.padding[12], { gap: 8 }]} testID="affiche-promotion">
            <Input
              accessibilityLabel={t('complexeAffiches.promotion.prix', 'Prix de la place')}
              keyboardType="decimal-pad"
              label={t('complexeAffiches.promotion.prix', 'Prix de la place')}
              onChangeText={(valeur) => setPrix(String(valeur))}
              value={prix}
            />
            <Input
              accessibilityLabel={t('complexeAffiches.promotion.texte', 'Le texte')}
              label={t('complexeAffiches.promotion.texte', 'Le texte')}
              maxLength={PROMO_TEXTE_MAX}
              multiline
              onChangeText={(valeur) => {
                setTexteModifie(true);
                setTextePromo(String(valeur).slice(0, PROMO_TEXTE_MAX));
              }}
              value={textePromotionAffiche}
            />
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('complexeAffiches.promotion.mention', MENTION_PROMOTION)}
            </Text>
            {texteModifie ? (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => {
                  setTexteModifie(false);
                  setTextePromo('');
                }}
                style={[Alignments.justifyCenter, { alignSelf: 'flex-start', minHeight: 44 }]}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {t('complexeAffiches.promotion.reinitialiser', 'Réinitialiser')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
      {encart ? (
        <TouchableOpacity
          accessibilityLabel={libelleFidelite}
          accessibilityRole="switch"
          accessibilityState={{ checked: fidelite }}
          onPress={() => setFidelite((avant) => !avant)}
          style={[carte, Spaces.padding[12], Alignments.row, Alignments.alignCenter, {
            gap: 12, minHeight: 56,
          }]}
          testID="affiche-fidelite"
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{libelleFidelite}</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t('complexeAffiches.fidelite.dit', '{{encart}} · réglée dans « Fidélité »', {
                encart, ...SANS_ECHAPPEMENT,
              })}
            </Text>
          </View>
          <View
            style={{
              backgroundColor: fidelite
                ? withAlpha(Colors.primary500, 0.6)
                : withAlpha(Colors.neutral00, 0.16),
              borderRadius: 14,
              height: 28,
              justifyContent: 'center',
              paddingHorizontal: 3,
              width: 48,
            }}
          >
            <View
              style={{
                alignSelf: fidelite ? 'flex-end' : 'flex-start',
                backgroundColor: Colors.primary100,
                borderRadius: 11,
                height: 22,
                width: 22,
              }}
            />
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => navigation.navigate(RouteNames.ComplexeFidelite, { complexeId })}
          style={[Alignments.justifyCenter, { minHeight: 44 }]}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>
            {t(
              'complexeAffiches.fidelite.creer',
              'Crée ton programme de fidélité pour le mettre en avant sur tes affiches',
            )}
          </Text>
        </TouchableOpacity>
      )}
      {enregistree ? (
        <BandeauComplexe testID="affiche-enregistree" texte={enregistree} ton="ok" />
      ) : null}
      {erreur ? (
        <BandeauComplexe testID="affiche-erreur-partage" texte={erreur} ton="erreur" />
      ) : null}
      <View style={{ gap: 8 }}>
        <Button
          disabled={Boolean(occupe)}
          isLoading={occupe === 'post'}
          onPress={() => partager('post')}
          title={t('complexeAffiches.partager', 'Partager l’affiche')}
        />
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          <View style={{ flexBasis: 140, flexGrow: 1 }}>
            <Button
              disabled={Boolean(occupe)}
              isLoading={occupe === 'story'}
              onPress={() => partager('story')}
              title={t('complexeAffiches.story', 'Story 9:16')}
              variant="Secondary"
            />
          </View>
          <View style={{ flexBasis: 140, flexGrow: 1 }}>
            <Button
              disabled={Boolean(occupe)}
              isLoading={occupe === 'a4'}
              onPress={() => partager('a4')}
              title={t('complexeAffiches.a4', 'Imprimer en A4')}
              variant="Secondary"
            />
          </View>
        </View>
      </View>
    </View>
  );

  const corps = enPause ? (
    <BandeauComplexe
      testID="affiche-pause"
      texte={t('complexeAffiches.pause', 'Ton complexe est suspendu : ses affiches sont en pause.')}
      ton="attention"
    />
  ) : (
    <DeuxVolets actif={surOrdinateur} droite={reglages}>
      <View style={{ gap: 16 }}>
        <View style={[Alignments.row, Alignments.wrap, { gap: 8 }]}>
          {puce(
            t('complexeAffiches.style.ecusson', 'Écusson'),
            style === 'ecusson',
            () => setStyle('ecusson'),
          )}
          {puce(
            t('complexeAffiches.style.famille', 'Famille'),
            style === 'famille',
            () => setStyle('famille'),
          )}
        </View>
        {vueDeLAffiche}
        {surOrdinateur ? null : reglages}
      </View>
    </DeuxVolets>
  );

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
          maxWidth: surOrdinateur ? 1120 : 560,
          paddingBottom: 24,
          paddingTop: 12,
          width: '100%',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={{ gap: 4 }}>
          <Text accessibilityRole="header" style={[Fonts.h3Black, Fonts.neutral00]}>
            {t('complexeAffiches.titre', 'Ton affiche complexe est prête')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {t('complexeAffiches.sousTitre', 'Fais-la voir : chaque scan ouvre ta page.')}
          </Text>
        </View>
        {corps}
      </ScrollView>
    </ScreenContainer>
  );
}

export default ComplexeAffiches;
