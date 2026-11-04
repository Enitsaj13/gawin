import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import type { TodoBackup } from './backup';

export type PickedBackupFile = {
  content: string;
  fileName: string;
  size?: number;
};

export async function exportBackupFile(
  backup: TodoBackup,
  fileName: string,
): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('File sharing is not available on this device.');
  }

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(JSON.stringify(backup, null, 2));

  if (Platform.OS === 'ios') {
    const result = await Share.share(
      { url: file.uri },
      { subject: 'Gawin backup' },
    );
    const shared = result.action === Share.sharedAction;

    if (!shared) removeTemporaryFile(file);
    return shared;
  }

  await Sharing.shareAsync(file.uri, {
    dialogTitle: 'Save Gawin backup',
    mimeType: 'application/json',
    UTI: 'public.json',
  });

  return false;
}

export async function pickBackupFile(): Promise<PickedBackupFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['application/json', 'text/json'],
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  return {
    content: await new File(asset.uri).text(),
    fileName: asset.name,
    size: asset.size,
  };
}

function removeTemporaryFile(file: File) {
  try {
    if (file.exists) file.delete();
  } catch {
    // The operating system can clear an undeleted cache file later.
  }
}
