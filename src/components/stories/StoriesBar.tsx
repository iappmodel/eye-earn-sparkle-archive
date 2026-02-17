import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useStories } from '@/hooks/useStories';
import type { Story } from '@/services/stories.service';
import { StoryViewer } from './StoryViewer';

interface StoriesBarProps {
  onCreateStory?: () => void;
}

export const StoriesBar: React.FC<StoriesBarProps> = ({ onCreateStory }) => {
  const { stories, loading, markAsViewed } = useStories();
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleStoryClick = (story: Story, index: number) => {
    setSelectedStory(story);
    setSelectedIndex(index);
  };

  const handleNextStory = () => {
    if (selectedIndex < stories.length - 1) {
      setSelectedStory(stories[selectedIndex + 1]);
      setSelectedIndex(selectedIndex + 1);
    } else {
      setSelectedStory(null);
    }
  };

  const handlePrevStory = () => {
    if (selectedIndex > 0) {
      setSelectedStory(stories[selectedIndex - 1]);
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
        {!loading && stories.map((story, index) => (
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
          hasNext={selectedIndex < stories.length - 1}
          hasPrev={selectedIndex > 0}
          onItemView={markAsViewed}
        />
      )}
    </>
  );
};
