import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Image, Video, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ContentUploadProps {
  onUploadComplete: (url: string, type: 'image' | 'video') => void;
  mediaType: 'image' | 'video' | 'carousel';
  existingUrl?: string;
  onRemove?: () => void;
}

export const ContentUpload: React.FC<ContentUploadProps> = ({
  onUploadComplete,
  mediaType,
  existingUrl,
  onRemove,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingUrl || null);
  const [uploadedType, setUploadedType] = useState<'image' | 'video' | null>(null);

  const acceptedTypes = mediaType === 'video' 
    ? 'video/*' 
    : mediaType === 'image' 
    ? 'image/*' 
    : 'image/*,video/*';

  const maxSize = mediaType === 'video' ? 100 * 1024 * 1024 : 20 * 1024 * 1024; // 100MB for video, 20MB for images

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file size
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Maximum size is ${maxSize / (1024 * 1024)}MB`,
        variant: 'destructive',
      });
      return;
    }

    // Determine file type
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image or video file',
        variant: 'destructive',
      });
      return;
    }

    // Create preview
    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
    setUploadedType(isVideo ? 'video' : 'image');

    // Start upload
    setUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const { data, error } = await supabase.storage
        .from('content-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('content-uploads')
        .getPublicUrl(data.path);

      setProgress(100);
      onUploadComplete(publicUrl, isVideo ? 'video' : 'image');
      
      toast({
        title: 'Upload complete',
        description: 'Your file has been uploaded successfully',
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Please try again',
        variant: 'destructive',
      });
      setPreviewUrl(null);
      setUploadedType(null);
    } finally {
      setUploading(false);
    }
  }, [user, maxSize, toast, onUploadComplete]);

  const handleRemove = () => {
    setPreviewUrl(null);
    setUploadedType(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  const handleClick = () => {
    if (!uploading && !previewUrl) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative rounded-2xl overflow-hidden bg-muted">
          {uploadedType === 'video' ? (
            <video
              src={previewUrl}
              className="w-full aspect-[4/3] object-cover"
              controls
            />
          ) : (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full aspect-[4/3] object-cover"
            />
          )}
          
          {/* Overlay during upload */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
              <Progress value={progress} className="w-2/3" />
              <span className="text-white text-sm">{progress}%</span>
            </div>
          )}

          {/* Success indicator */}
          {!uploading && progress === 100 && (
            <div className="absolute top-3 right-3 bg-green-500 text-white p-2 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}

          {/* Remove button */}
          {!uploading && (
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-3 left-3"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={cn(
            'aspect-[4/3] rounded-2xl border-2 border-dashed transition-colors cursor-pointer',
            'flex flex-col items-center justify-center gap-4',
            uploading
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 bg-muted/30'
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <Progress value={progress} className="w-2/3" />
              <span className="text-sm text-muted-foreground">Uploading... {progress}%</span>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Tap to upload {mediaType}</p>
                <p className="text-sm text-muted-foreground">
                  {mediaType === 'video' ? 'Max 100MB' : 'Max 20MB'}
                </p>
              </div>
              <div className="flex gap-2">
                <div className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs',
                  mediaType === 'image' || mediaType === 'carousel'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  <Image className="w-3 h-3" /> Image
                </div>
                <div className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs',
                  mediaType === 'video' || mediaType === 'carousel'
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}>
                  <Video className="w-3 h-3" /> Video
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
