import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { DOCX, typeFromName, type CvFile } from './cvText';

export * from './cvText';

// A CV as a file, in the formats people actually have, chosen with the system's picker. A PDF
// or a photo goes to the model as it is; a Word file is opened here and its text sent; a plain
// text file is sent as text. Anything else gets a plain message saying what to save it as.

// The system's file picker; null when the person backs out.
export async function pickCv(): Promise<CvFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', DOCX, 'application/msword', 'text/plain', 'text/markdown', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  const mediaType = (a.mimeType || typeFromName(a.name) || 'application/octet-stream').toLowerCase();
  const base64 = await readBase64(a);
  const size = a.size ?? Math.floor((base64.length * 3) / 4);
  return { name: a.name, mediaType, size, base64 };
}

async function readBase64(a: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (a.base64) return a.base64.replace(/^data:[^,]*,/, '');
    const blob = a.file ?? (await (await fetch(a.uri)).blob());
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    return dataUrl.replace(/^data:[^,]*,/, '');
  }
  return new File(a.uri).base64();
}
