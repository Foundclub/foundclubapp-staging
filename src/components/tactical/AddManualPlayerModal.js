import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import useTheme from '@/theme/themeContext';
import Input from '@/components/molecules/input/Input';
import Button from '@/components/atoms/button/Button';

/**
 * AddManualPlayerModal - Modal to add a player not registered in the app
 * @param {object} props
 * @param {boolean} props.visible - Modal visibility
 * @param {function} props.onClose - Close handler
 * @param {function} props.onAdd - Add handler with player data
 */
const AddManualPlayerModal = ({ visible, onClose, onAdd }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  
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
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    modal: {
      backgroundColor: Colors.neutral800,
      borderRadius: 16,
      padding: 24,
      width: '100%',
      maxWidth: 340,
      borderWidth: 1,
      borderColor: Colors.neutral700,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    title: {
      color: Colors.neutral00,
      fontSize: 18,
      fontWeight: '700',
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: Colors.neutral700,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeText: {
      color: Colors.neutral200,
      fontSize: 18,
    },
    description: {
      color: Colors.neutral300,
      fontSize: 14,
      marginBottom: 20,
      lineHeight: 20,
    },
    form: {
      gap: 16,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 24,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Colors.warning500 + '20',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    badgeIcon: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Colors.warning500,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeIconText: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: '700',
    },
    badgeText: {
      color: Colors.warning500,
      fontSize: 12,
      fontWeight: '600',
      flex: 1,
    },
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          activeOpacity={1}
        />
        
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Ajouter un joueur</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badge}>
            <View style={styles.badgeIcon}>
              <Text style={styles.badgeIconText}>+</Text>
            </View>
            <Text style={styles.badgeText}>
              Ce joueur sera ajouté manuellement et n'apparaîtra pas dans les statistiques de l'équipe.
            </Text>
          </View>

          <Text style={styles.description}>
            Ajoutez un joueur qui n'est pas encore inscrit sur l'application.
          </Text>

          <View style={styles.form}>
            <Input
              label="Prénom"
              placeholder="Ex: Lucas"
              value={firstname}
              onChangeText={setFirstname}
              error={errors.firstname}
            />
            
            <Input
              label="Nom"
              placeholder="Ex: Dupont"
              value={lastname}
              onChangeText={setLastname}
              error={errors.lastname}
            />
            
            <Input
              label="Numéro (optionnel)"
              placeholder="Ex: 10"
              value={number}
              onChangeText={setNumber}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>

          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <Button
                title="Annuler"
                variant="Secondary"
                onPress={handleClose}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Ajouter"
                variant="Primary"
                onPress={handleAdd}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default AddManualPlayerModal;
