import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { StoryViewer } from './StoryViewer';

interface Story {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  items: {
    id: string;
    type: 'image' | 'video';
    url: string;
    duration?: number;
    createdAt: string;
  }[];
  hasUnviewed: boolean;
}

interface StoriesBarProps {
  onCreateStory?: () => void;
}

// Mock stories data
const mockStories: Story[] = [
  {
    id: '1',
    userId: 'user1',
    username: 'travel_mike',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    items: [
      { id: 's1', type: 'image', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1080&h=1920&fit=crop', createdAt: new Date().toISOString() },
      { id: 's2', type: 'image', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1080&h=1920&fit=crop', createdAt: new Date().toISOString() },
    ],
    hasUnviewed: true,
  },
  {
    id: '2',
    userId: 'user2',
    username: 'foodie_anna',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    items: [
      { id: 's3', type: 'image', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1080&h=1920&fit=crop', createdAt: new Date().toISOString() },
    ],
    hasUnviewed: true,
  },
  {
    id: '3',
    userId: 'user3',
    username: 'fitness_pro',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop',
    items: [
      { id: 's4', type: 'image', url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1920&fit=crop', createdAt: new Date().toISOString() },
    ],
    hasUnviewed: false,
  },
  {
    id: '4',
    userId: 'user4',
    username: 'tech_guru',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop',
    items: [
      { id: 's5', type: 'image', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1920&fit=crop', createdAt: new Date().toISOString() },
    ],
    hasUnviewed: true,
  },
  {
    id: '5',
    userId: 'user5',
    username: 'art_lover',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    items: [
      { id: 's6', type: 'image', url: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1080&h=1920&fit=crop', createdAt: new Date().toISOString() },
    ],
    hasUnviewed: true,
  },
];

export const StoriesBar: React.FC<StoriesBarProps> = ({ onCreateStory }) => {
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleStoryClick = (story: Story, index: number) => {
    setSelectedStory(story);
    setSelectedIndex(index);
  };

  const handleNextStory = () => {
    if (selectedIndex < mockStories.length - 1) {
      setSelectedStory(mockStories[selectedIndex + 1]);
      setSelectedIndex(selectedIndex + 1);
    } else {
      setSelectedStory(null);
    }
  };

  const handlePrevStory = () => {
    if (selectedIndex > 0) {
      setSelectedStory(mockStories[selectedIndex - 1]);
      setSelectedIndex(selectedIndex - 1);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {/* Add Story Button */}
        <button
          onClick={onCreateStory}
          className="flex flex-col items-center gap-1 min-w-[72px]"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Your Story</span>
        </button>

        {/* Stories */}
        {mockStories.map((story, index) => (
          <button
            key={story.id}
            onClick={() => handleStoryClick(story, index)}
            className="flex flex-col items-center gap-1 min-w-[72px]"
          >
            <div className={cn(
              "p-0.5 rounded-full",
              story.hasUnviewed
                ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500"
                : "bg-muted-foreground/30"
            )}>
              <Avatar className="w-16 h-16 border-2 border-background">
                <AvatarImage src={story.avatarUrl} />
                <AvatarFallback>{story.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
            </div>
            <span className="text-xs text-foreground/80 truncate max-w-[72px]">
              {story.username}
            </span>
          </button>
        ))}
      </div>

      {/* Story Viewer */}
      {selectedStory && (
        <StoryViewer
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          onNext={handleNextStory}
          onPrev={handlePrevStory}
          hasNext={selectedIndex < mockStories.length - 1}
          hasPrev={selectedIndex > 0}
        />
      )}
    </>
  );
};
