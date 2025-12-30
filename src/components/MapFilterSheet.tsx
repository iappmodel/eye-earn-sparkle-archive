import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PROMOTION_CATEGORIES, getCategoryInfo } from './PromotionCategories';

interface MapFilters {
  distance: number; // in miles
  rewardTypes: ('vicoin' | 'icoin' | 'both')[];
  categories: string[];
  minReward: number;
}

interface MapFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: MapFilters;
  onFiltersChange: (filters: MapFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const REWARD_TYPES: { id: 'vicoin' | 'icoin' | 'both'; label: string; color: string }[] = [
  { id: 'vicoin', label: 'Vicoin', color: 'bg-violet-500' },
  { id: 'icoin', label: 'Icoin', color: 'bg-blue-500' },
  { id: 'both', label: 'Both', color: 'bg-gradient-to-r from-violet-500 to-blue-500' },
];

export const MapFilterSheet: React.FC<MapFilterSheetProps> = ({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  onApply,
  onReset,
}) => {
  const toggleRewardType = (type: 'vicoin' | 'icoin' | 'both') => {
    const newTypes = filters.rewardTypes.includes(type)
      ? filters.rewardTypes.filter(t => t !== type)
      : [...filters.rewardTypes, type];
    onFiltersChange({ ...filters, rewardTypes: newTypes });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    onFiltersChange({ ...filters, categories: newCategories });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Filter Promotions</SheetTitle>
          <SheetDescription>Refine your search to find the best offers</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-24">
          {/* Distance Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Distance: {filters.distance} miles</Label>
            <Slider
              value={[filters.distance]}
              onValueChange={([value]) => onFiltersChange({ ...filters, distance: value })}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 mi</span>
              <span>50 mi</span>
            </div>
          </div>

          {/* Reward Type Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Reward Type</Label>
            <div className="flex flex-wrap gap-2">
              {REWARD_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleRewardType(type.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all',
                    'border-2',
                    filters.rewardTypes.includes(type.id)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('w-3 h-3 rounded-full', type.color)} />
                    {type.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter with Icons */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Categories</Label>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
              {PROMOTION_CATEGORIES.slice(0, 10).map((category) => {
                const Icon = category.icon;
                const isSelected = filters.categories.includes(category.id);
                return (
                  <button
                    key={category.id}
                    onClick={() => toggleCategory(category.id)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border transition-all text-left',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    )}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', category.bgColor)}>
                      <Icon className={cn('w-4 h-4', category.color)} />
                    </div>
                    <span className="text-sm font-medium truncate">{category.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Minimum Reward Filter */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Minimum Reward: {filters.minReward} coins</Label>
            <Slider
              value={[filters.minReward]}
              onValueChange={([value]) => onFiltersChange({ ...filters, minReward: value })}
              min={0}
              max={500}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>500+</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              onApply();
              onOpenChange(false);
            }}
          >
            Apply Filters
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const defaultMapFilters: MapFilters = {
  distance: 10,
  rewardTypes: ['vicoin', 'icoin', 'both'],
  categories: [],
  minReward: 0,
};

export type { MapFilters };
