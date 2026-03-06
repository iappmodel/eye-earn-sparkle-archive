import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Megaphone, Video, BarChart3, Image, Upload } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface CreatorToolsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const tools = [
  {
    id: 'post',
    icon: Camera,
    label: 'Create Post',
    description: 'Share photos and videos',
    path: '/create',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'promotion',
    icon: Megaphone,
    label: 'Create Promotion',
    description: 'Promote your business',
    path: '/create',
    color: 'from-purple-500 to-violet-500',
  },
  {
    id: 'story',
    icon: Image,
    label: 'Add Story',
    description: 'Share a moment',
    path: '/create',
    color: 'from-amber-500 to-orange-500',
  },
  {
    id: 'studio',
    icon: Video,
    label: 'Studio',
    description: 'Edit videos with AI tools',
    path: '/studio',
    color: 'from-rose-500 to-pink-500',
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Analytics',
    description: 'Views, engagement, earnings',
    path: '/my-page',
    color: 'from-emerald-500 to-teal-500',
  },
];

export const CreatorToolsSheet: React.FC<CreatorToolsSheetProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  const handleSelect = (path: string, id: string) => {
    onClose();
    if (id === 'post' || id === 'promotion' || id === 'story') {
      const type = id === 'post' ? 'post' : id === 'promotion' ? 'promotion' : 'story';
      navigate('/create', { state: { preselectedType: type } });
    } else if (id === 'analytics') {
      navigate('/my-page?tab=analytics');
    } else {
      navigate(path);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-24">
        <SheetHeader>
          <SheetTitle className="text-center">
            <span className="flex items-center justify-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Creator Tools
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleSelect(tool.path, tool.id)}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-2xl transition-all',
                'hover:scale-[1.02] active:scale-[0.98]',
                'bg-gradient-to-br', tool.color,
                'text-white shadow-lg'
              )}
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <tool.icon className="w-6 h-6" />
              </div>
              <span className="font-semibold text-sm">{tool.label}</span>
              <span className="text-xs text-white/80">{tool.description}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};
