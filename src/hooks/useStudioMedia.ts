import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface MediaFile {
  id: string;
  file: File;
  url: string;
  type: 'image' | 'video';
  uploadProgress: number;
  isUploading: boolean;
  storagePath?: string;
}

export const useStudioMedia = () => {
  const { user } = useAuth();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [currentMedia, setCurrentMedia] = useState<MediaFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadToStorage = useCallback(async (file: File, mediaId: string): Promise<string | null> => {
    if (!user) {
      toast.error('Please sign in to upload media');
      return null;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('studio-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Failed to upload media', { description: uploadError.message });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('studio-media')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }, [user]);

  const addMedia = useCallback(async (files: FileList | File[]) => {
    if (!user) {
      toast.error('Please sign in to upload media');
      return;
    }

    setIsUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      // Validate file type
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');

      if (!isVideo && !isImage) {
        toast.error('Invalid file type', { description: 'Please upload images or videos only.' });
        continue;
      }

      // Validate file size (100MB for videos, 20MB for images)
      const maxSize = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error('File too large', { 
          description: `Maximum size is ${isVideo ? '100MB' : '20MB'} for ${isVideo ? 'videos' : 'images'}.` 
        });
        continue;
      }

      const mediaId = `media-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const localUrl = URL.createObjectURL(file);

      // Add to state with uploading status
      const newMedia: MediaFile = {
        id: mediaId,
        file,
        url: localUrl,
        type: isVideo ? 'video' : 'image',
        uploadProgress: 0,
        isUploading: true,
      };

      setMediaFiles(prev => [...prev, newMedia]);
      
      // Set as current if first upload
      if (mediaFiles.length === 0) {
        setCurrentMedia(newMedia);
      }

      // Upload to storage
      const storageUrl = await uploadToStorage(file, mediaId);

      if (storageUrl) {
        setMediaFiles(prev => 
          prev.map(m => 
            m.id === mediaId 
              ? { ...m, url: storageUrl, storagePath: storageUrl, isUploading: false, uploadProgress: 100 }
              : m
          )
        );
        
        // Update current media if it's this one
        setCurrentMedia(prev => 
          prev?.id === mediaId 
            ? { ...prev, url: storageUrl, storagePath: storageUrl, isUploading: false, uploadProgress: 100 }
            : prev
        );
        
        toast.success('Media uploaded successfully');
      } else {
        // Remove failed upload
        setMediaFiles(prev => prev.filter(m => m.id !== mediaId));
        if (currentMedia?.id === mediaId) {
          setCurrentMedia(null);
        }
      }
    }

    setIsUploading(false);
  }, [user, uploadToStorage, mediaFiles.length, currentMedia?.id]);

  const removeMedia = useCallback(async (mediaId: string) => {
    const media = mediaFiles.find(m => m.id === mediaId);
    
    if (media?.storagePath && user) {
      // Extract the path from the full URL
      const urlParts = media.storagePath.split('/studio-media/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        const { error } = await supabase.storage
          .from('studio-media')
          .remove([filePath]);
        
        if (error) {
          console.error('Delete error:', error);
        }
      }
    }

    // Revoke local URL if exists
    if (media?.url.startsWith('blob:')) {
      URL.revokeObjectURL(media.url);
    }

    setMediaFiles(prev => prev.filter(m => m.id !== mediaId));
    
    if (currentMedia?.id === mediaId) {
      const remaining = mediaFiles.filter(m => m.id !== mediaId);
      setCurrentMedia(remaining.length > 0 ? remaining[0] : null);
    }

    toast.success('Media removed');
  }, [mediaFiles, currentMedia?.id, user]);

  const selectMedia = useCallback((mediaId: string) => {
    const media = mediaFiles.find(m => m.id === mediaId);
    if (media) {
      setCurrentMedia(media);
    }
  }, [mediaFiles]);

  const clearAll = useCallback(async () => {
    // Revoke all local URLs
    mediaFiles.forEach(m => {
      if (m.url.startsWith('blob:')) {
        URL.revokeObjectURL(m.url);
      }
    });

    setMediaFiles([]);
    setCurrentMedia(null);
  }, [mediaFiles]);

  return {
    mediaFiles,
    currentMedia,
    isUploading,
    addMedia,
    removeMedia,
    selectMedia,
    clearAll,
    setCurrentMedia,
  };
};
