import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const GANG_BANNERS_BUCKET = 'gang-banners';

/** Square crop for club banners (rounded square preview). */
export const GANG_BANNER_ASPECT: [number, number] = [1, 1];

export type GangBannerPickSource = 'camera' | 'library';

export interface PickedGangBanner {
  uri: string;
  base64: string;
  contentType: string;
  extension: string;
}

function extensionFromMime(mime: string | undefined): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic' || mime === 'image/heif') return 'heic';
  return 'jpg';
}

function contentTypeFromAsset(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  return 'image/jpeg';
}

export async function pickGangBannerImage(
  source: GangBannerPickSource,
): Promise<PickedGangBanner | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission is required to take a club banner photo.'
        : 'Photo library permission is required to choose a club banner.',
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: GANG_BANNER_ASPECT,
          quality: 0.85,
          base64: true,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: GANG_BANNER_ASPECT,
          quality: 0.85,
          base64: true,
        });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) throw new Error('Could not read the selected image.');

  const contentType = contentTypeFromAsset(asset);
  return {
    uri: asset.uri,
    base64: asset.base64,
    contentType,
    extension: extensionFromMime(contentType),
  };
}

export async function uploadGangBannerImage(
  gangId: string,
  image: PickedGangBanner,
): Promise<string> {
  await removeGangBannerImage(gangId);

  const path = `${gangId}/banner.${image.extension}`;

  const { error } = await supabase.storage
    .from(GANG_BANNERS_BUCKET)
    .upload(path, decode(image.base64), {
      contentType: image.contentType,
      upsert: true,
      cacheControl: '3600',
    });

  if (error) throw error;

  const { data } = supabase.storage.from(GANG_BANNERS_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

export async function removeGangBannerImage(gangId: string): Promise<void> {
  const { data: files, error: listError } = await supabase.storage
    .from(GANG_BANNERS_BUCKET)
    .list(gangId);

  if (listError) throw listError;
  if (!files?.length) return;

  const paths = files.map((file) => `${gangId}/${file.name}`);
  const { error } = await supabase.storage.from(GANG_BANNERS_BUCKET).remove(paths);
  if (error) throw error;
}
