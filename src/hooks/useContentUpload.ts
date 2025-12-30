import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UploadOptions {
  title?: string;
  caption?: string;
  tags?: string[];
  isPublic?: boolean;
}

export const useContentUpload = () => {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadContent = async (file: File, options: UploadOptions = {}) => {
    if (!user) {
      toast.error('Please sign in to upload content');
      return null;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 1. Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = 'content-uploads';

      setUploadProgress(20);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      setUploadProgress(60);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const mediaUrl = urlData.publicUrl;

      // 3. Determine content type
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      const contentType = isVideo ? 'video' : isImage ? 'image' : 'other';
      const mediaType = isVideo ? 'video' : 'image';

      setUploadProgress(80);

      // 4. Create content record
      const { data: content, error: insertError } = await supabase
        .from('user_content')
        .insert({
          user_id: user.id,
          content_type: contentType,
          media_type: mediaType,
          media_url: mediaUrl,
          title: options.title || file.name,
          caption: options.caption,
          tags: options.tags || [],
          is_public: options.isPublic ?? true,
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success('Content published!');
      
      return content;
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Failed to upload content');
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteContent = async (contentId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('user_content')
        .delete()
        .eq('id', contentId)
        .eq('user_id', user.id);

      if (error) throw error;
      
      toast.success('Content deleted');
      return true;
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete content');
      return false;
    }
  };

  return {
    uploadContent,
    deleteContent,
    isUploading,
    uploadProgress,
  };
};
