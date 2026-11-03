import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { formatJournalDate } from '@/lib/date';

type TaskComposerProps = {
  date: string;
  heading?: string;
  initialTitle?: string;
  submitLabel?: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
};

export function TaskComposer({
  date,
  heading = 'New task',
  initialTitle = '',
  submitLabel = 'Add task',
  visible,
  onClose,
  onSubmit,
}: TaskComposerProps) {
  const [title, setTitle] = useState(initialTitle);

  const close = () => {
    setTitle('');
    onClose();
  };

  const submit = () => {
    if (!title.trim()) return;
    onSubmit(title);
    close();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <Pressable
          accessibilityRole="button"
          onPress={close}
          style={styles.backdrop}
        >
          <Pressable onPress={() => undefined} style={styles.sheet}>
            <Text style={styles.eyebrow}>{formatJournalDate(date)}</Text>
            <Text style={styles.title}>{heading}</Text>
            <TextInput
              accessibilityLabel="Task title"
              autoFocus
              maxLength={80}
              onChangeText={setTitle}
              onSubmitEditing={submit}
              placeholder="What needs to be done?"
              placeholderTextColor="#9c9b96"
              returnKeyType="done"
              selectTextOnFocus={Boolean(initialTitle)}
              selectionColor="#111111"
              style={styles.input}
              value={title}
            />
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Cancel task editor"
                accessibilityRole="button"
                onPress={close}
                style={({ pressed }) => [
                  styles.cancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={submitLabel}
                accessibilityRole="button"
                disabled={!title.trim()}
                onPress={submit}
                style={({ pressed }) => [
                  styles.add,
                  !title.trim() && styles.addDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.addText}>{submitLabel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    backgroundColor: '#fbfbf9',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: Platform.OS === 'ios' ? 38 : 26,
    borderTopWidth: 1,
    borderColor: '#111111',
  },
  eyebrow: {
    color: '#74736e',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  title: {
    marginTop: 4,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 23,
  },
  input: {
    minHeight: 54,
    marginTop: 24,
    borderBottomWidth: 1,
    borderColor: '#111111',
    color: '#1b1b1a',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 15,
    paddingVertical: 12,
  },
  actions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 10,
  },
  cancel: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#111111',
  },
  add: {
    minHeight: 50,
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  addDisabled: {
    backgroundColor: '#aaa9a5',
  },
  cancelText: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  addText: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.58,
  },
});
