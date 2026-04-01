import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';

/**
 * AddManualPlayerModal - Modal to add a player not registered in the app
 * @param {object} props
 * @param {boolean} props.visible - Modal visibility
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onAdd - Add handler with player data
 */
function AddManualPlayerModal({ onAdd, onClose, visible }) {
  const { Colors } = useTheme();

  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [number, setNumber] = useState('');
  const [errors, setErrors] = useState({});

  const handleAdd = () => {
    // Validation
    const newErrors = {};
    if (!firstname.trim()) newErrors.firstname = 'Prénom requis';
    if (!lastname.trim()) newErrors.lastname = 'Nom requis';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      number: number.trim() || null,
    });

    // Reset form
    setFirstname('');
    setLastname('');
    setNumber('');
    setErrors({});
  };

  const handleClose = () => {
    setFirstname('');
    setLastname('');
    setNumber('');
    setErrors({});
    onClose();
  };

  const styles = StyleSheet.create({
    badge: {
      alignItems: 'center',
      backgroundColor: `${Colors.warning500}20`,
      borderRadius: 8,
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    badgeIcon: {
      alignItems: 'center',
      backgroundColor: Colors.warning500,
      borderRadius: 10,
      height: 20,
      justifyContent: 'center',
      width: 20,
    },
    badgeIconText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '700',
    },
    badgeText: {
      color: Colors.warning500,
      flex: 1,
      fontSize: 12,
      fontWeight: '600',
    },
    closeButton: {
      alignItems: 'center',
      backgroundColor: Colors.neutral700,
      borderRadius: 16,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    closeText: {
      color: Colors.neutral200,
      fontSize: 18,
    },
    description: {
      color: Colors.neutral300,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    form: {
      gap: 16,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: 20,
    },
    modal: {
      backgroundColor: Colors.neutral800,
      borderColor: Colors.neutral700,
      borderRadius: 16,
      borderWidth: 1,
      maxWidth: 340,
      padding: 24,
      width: '100%',
    },
    overlay: {
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    title: {
      color: Colors.neutral00,
      fontSize: 18,
      fontWeight: '700',
    },
  });

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajouter un joueur</Text>
          </View>

          <View style={styles.badge}>
            <View style={styles.badgeIcon}>
              <Text style={styles.badgeIconText}>+</Text>
            </View>
            <Text style={styles.badgeText}>
              Ce joueur sera ajouté manuellement et n&apos;apparaîtra pas dans les statistiques de l&apos;équipe.
            </Text>
          </View>

          <Text style={styles.description}>
            Ajoutez un joueur qui n&apos;est pas encore inscrit sur l&apos;application.
          </Text>

          <View style={styles.form}>
            <Input
              error={errors.firstname}
              label="Prénom"
              onChangeText={setFirstname}
              placeholder="Ex: Lucas"
              value={firstname}
            />

            <Input
              error={errors.lastname}
              label="Nom"
              onChangeText={setLastname}
              placeholder="Ex: Dupont"
              value={lastname}
            />

            <Input
              keyboardType="numeric"
              label="Numéro (optionnel)"
              maxLength={3}
              onChangeText={setNumber}
              placeholder="Ex: 10"
              value={number}
            />
          </View>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={handleClose}
                title="Annuler"
                variant="Secondary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={handleAdd}
                title="Ajouter"
                variant="Primary"
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default AddManualPlayerModal;
