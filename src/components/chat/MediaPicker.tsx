import React, { useRef, useState } from 'react';
import { Image, Camera, File, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IMojiPicker, IMoji } from '@/components/imoji';

interface MediaPickerProps {
  onSelect: (file: File) => void;
  onIMojiSelect?: (imoji: IMoji) => void;
  disabled?: boolean;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ onSelect, onIMojiSelect, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showIMojiPicker, setShowIMojiPicker] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onSelect(file);
    }
    e.target.value = '';
  };

  const handleIMojiSelect = (imoji: IMoji) => {
    onIMojiSelect?.(imoji);
    setShowIMojiPicker(false);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" disabled={disabled} className="shrink-0">
            <Image className="w-5 h-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" side="top" align="start">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <Image className="w-4 h-4" />
              <span>Photo/Video</span>
            </button>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <Camera className="w-4 h-4" />
              <span>Camera</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm"
            >
              <File className="w-4 h-4" />
              <span>Document</span>
            </button>
            <button
              onClick={() => setShowIMojiPicker(true)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-primary"
            >
              <Sparkles className="w-4 h-4" />
              <span>iMoji</span>
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </PopoverContent>
      </Popover>

      {showIMojiPicker && (
        <IMojiPicker
          onSelect={handleIMojiSelect}
          compact={false}
        />
      )}
    </>
  );
};

// Media preview component for selected files
interface MediaPreviewProps {
  file: File;
  onRemove: () => void;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ file, onRemove }) => {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const previewUrl = URL.createObjectURL(file);

  return (
    <div className="relative inline-block">
      {isImage && (
        <img
          src={previewUrl}
          alt="Preview"
          className="w-20 h-20 object-cover rounded-lg"
        />
      )}
      {isVideo && (
        <video
          src={previewUrl}
          className="w-20 h-20 object-cover rounded-lg"
        />
      )}
      {!isImage && !isVideo && (
        <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
          <File className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};
