import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useAdminCollectiviteSearch } from '@/services/collectivite/collectiviteQueries';

import { getErrorMessage } from '@/utils/errors/displayError';

/**
 * 🏛️ CHERCHER UN CLUB OU UN COMPTE DANS LA CONSOLE — sortie telle quelle de la fiche d une
 * collectivite (AdminCollectiviteDetail, D61) par COLL-CONSOLE (02/10), pour que l ecran des
 * demandes RELIE une demande « Par FoundClub » a son club avec la MEME recherche.
 * Deux lettres au moins ; ce qui est deja pris se lit `dejaTexte` et ne se choisit pas.
 * @param {{ deja: Set<string>, dejaTexte: string, enCours: boolean, kind: 'club' | 'user',
 *   libelleAction: string, onChoisir: (cible: any) => void, placeholder: string,
 *   testID: string }} props - La recherche.
 * @returns {import('react').ReactElement} Le champ et ses resultats.
 */
function CollectiviteTargetSearch({
  deja, dejaTexte, enCours, kind, libelleAction, onChoisir, placeholder, testID,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [texte, setTexte] = useState('');
  const resultats = useAdminCollectiviteSearch(kind, texte);
  const lignes = Array.isArray(resultats.data) ? resultats.data : [];
  const champStyle = { borderColor: `${Colors.primary500}80`, color: Colors.neutral00 };

  let contenu = null;
  if (texte.trim().length >= 2) {
    if (resultats.isLoading) {
      contenu = (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('adminCollectivites.detail.searching', 'Recherche…')}
        </Text>
      );
    } else if (resultats.error) {
      contenu = (
        <Text style={[Fonts.p3Bold, Fonts.error500]}>
          {getErrorMessage(/** @type {any} */ (resultats.error))}
        </Text>
      );
    } else if (lignes.length === 0) {
      contenu = (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t('adminCollectivites.detail.noResult', 'Aucun résultat.')}
        </Text>
      );
    } else {
      contenu = lignes.map((/** @type {any} */ cible) => {
        const pris = deja.has(String(cible?.documentId));
        return (
          <View
            key={cible?.documentId}
            style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}
            testID={`${testID}-resultat-${cible?.documentId}`}
          >
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00]}>{cible?.label}</Text>
              {cible?.subtitle ? (
                <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300]}>{cible.subtitle}</Text>
              ) : null}
            </View>
            <Button
              disabled={pris || enCours}
              onPress={() => {
                onChoisir(cible);
                setTexte('');
              }}
              size="sm"
              title={pris ? dejaTexte : libelleAction}
              variant="Secondary"
            />
          </View>
        );
      });
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <TextInput
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setTexte}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral400}
        style={[
          ApplicationStyle.borderRadius16,
          ApplicationStyle.borderWidth1,
          Fonts.p2,
          Spaces.padding[12],
          champStyle,
        ]}
        testID={testID}
        value={texte}
      />
      {contenu}
    </View>
  );
}

export default CollectiviteTargetSearch;
