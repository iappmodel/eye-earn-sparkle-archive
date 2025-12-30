import React, { useState } from 'react';
import { X, Play, Pause, Scissors, LayoutGrid, LayoutPanelLeft, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface OriginalContent {
  id: string;
  username: string;
  thumbnailUrl: string;
  videoUrl?: string;
}

interface DuetStitchCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: OriginalContent;
  mode: 'duet' | 'stitch';
}

export const DuetStitchCreator: React.FC<DuetStitchCreatorProps> = ({
  isOpen,
  onClose,
  originalContent,
  mode,
}) => {
  const [layout, setLayout] = useState<'side-by-side' | 'top-bottom' | 'green-screen'>('side-by-side');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stitchStart, setStitchStart] = useState([0]);
  const [stitchEnd, setStitchEnd] = useState([5]);

  const handleStartRecording = () => {
    setIsRecording(true);
    toast.info('Recording started...');
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    toast.success('Recording saved!');
  };

  const handlePublish = () => {
    toast.success(`${mode === 'duet' ? 'Duet' : 'Stitch'} published!`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
          <X className="w-6 h-6" />
        </Button>
        <h2 className="text-white font-semibold text-lg">
          {mode === 'duet' ? 'Create Duet' : 'Create Stitch'}
        </h2>
        <Button onClick={handlePublish} size="sm">
          Publish
        </Button>
      </div>

      {/* Preview Area */}
      <div className="absolute top-20 bottom-48 left-4 right-4">
        {mode === 'duet' ? (
          <div className={cn(
            "w-full h-full rounded-xl overflow-hidden",
            layout === 'side-by-side' && "flex",
            layout === 'top-bottom' && "flex flex-col"
          )}>
            {/* Original Video */}
            <div className={cn(
              "bg-muted relative",
              layout === 'side-by-side' && "w-1/2 h-full",
              layout === 'top-bottom' && "w-full h-1/2",
              layout === 'green-screen' && "absolute inset-0"
            )}>
              <img
                src={originalContent.thumbnailUrl}
                alt="Original"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                @{originalContent.username}
              </div>
            </div>

            {/* Your Video */}
            <div className={cn(
              "bg-muted/50 flex items-center justify-center relative",
              layout === 'side-by-side' && "w-1/2 h-full",
              layout === 'top-bottom' && "w-full h-1/2",
              layout === 'green-screen' && "absolute top-4 right-4 w-32 h-48 rounded-lg"
            )}>
              <Video className="w-12 h-12 text-muted-foreground" />
              <span className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                You
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full rounded-xl overflow-hidden flex flex-col">
            {/* Original Video Clip */}
            <div className="flex-1 bg-muted relative">
              <img
                src={originalContent.thumbnailUrl}
                alt="Original"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                Clip from @{originalContent.username}
              </div>
            </div>

            {/* Timeline for stitch */}
            <div className="p-4 bg-black/50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white text-xs">Clip: {stitchStart[0]}s - {stitchEnd[0]}s</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white/60 text-xs">Start</span>
                <Slider
                  value={stitchStart}
                  onValueChange={setStitchStart}
                  max={10}
                  step={0.5}
                  className="flex-1"
                />
                <span className="text-white/60 text-xs">End</span>
                <Slider
                  value={stitchEnd}
                  onValueChange={setStitchEnd}
                  min={stitchStart[0]}
                  max={15}
                  step={0.5}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Layout Options (Duet only) */}
      {mode === 'duet' && (
        <div className="absolute bottom-36 left-4 right-4 flex items-center justify-center gap-4">
          <Button
            variant={layout === 'side-by-side' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setLayout('side-by-side')}
            className="text-white"
          >
            <LayoutPanelLeft className="w-5 h-5" />
          </Button>
          <Button
            variant={layout === 'top-bottom' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setLayout('top-bottom')}
            className="text-white"
          >
            <LayoutGrid className="w-5 h-5" />
          </Button>
          <Button
            variant={layout === 'green-screen' ? 'default' : 'ghost'}
            size="icon"
            onClick={() => setLayout('green-screen')}
            className="text-white"
          >
            <Video className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Recording Controls */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className="flex items-center justify-center gap-6">
          <Button variant="ghost" size="icon" className="text-white">
            <ChevronLeft className="w-6 h-6" />
          </Button>

          <Button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={cn(
              "w-20 h-20 rounded-full",
              isRecording ? "bg-red-500 hover:bg-red-600" : "bg-white hover:bg-white/90"
            )}
          >
            {isRecording ? (
              <div className="w-8 h-8 bg-white rounded" />
            ) : (
              <div className="w-8 h-8 bg-red-500 rounded-full" />
            )}
          </Button>

          <Button variant="ghost" size="icon" className="text-white">
            <ChevronRight className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};
