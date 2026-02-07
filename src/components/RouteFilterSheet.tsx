import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Zap, TrendingUp, Target, Scale } from 'lucide-react';
import { PROMOTION_CATEGORIES } from './PromotionCategories';
import type { RouteFilters, RouteOptimization } from '@/hooks/usePromoRoute';

interface RouteFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: RouteFilters;
  onFiltersChange: (filters: RouteFilters) => void;
  onApply: () => void;
  onReset: () => void;
}

const OPTIMIZATION_OPTIONS: { id: RouteOptimization; label: string; description: string; icon: React.ElementType }[] = [
  { id: 'more_earnings', label: 'More Earnings', description: 'Maximize total rewards', icon: TrendingUp },
  { id: 'faster', label: 'Fastest', description: 'Shortest total distance', icon: Zap },
  { id: 'effective', label: 'Most Effective', description: 'Best reward-per-km ratio', icon: Target },
  { id: 'balanced', label: 'Balanced', description: 'Mix of speed & earnings', icon: Scale },
];

const REWARD_TYPES: { id: 'vicoin' | 'icoin' | 'both'; label: string; color: string }[] = [
  { id: 'vicoin', label: 'Vicoin', color: 'bg-violet-500' },
  { id: 'icoin', label: 'Icoin', color: 'bg-blue-500' },
  { id: 'both', label: 'Both', color: 'bg-gradient-to-r from-violet-500 to-blue-500' },
];

export const RouteFilterSheet: React.FC<RouteFilterSheetProps> = ({
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
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle>Route Filters</SheetTitle>
          <SheetDescription>Customize your route preferences</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto pb-24">
          {/* Optimization Strategy */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Optimization Strategy</Label>
            <div className="grid grid-cols-2 gap-2">
              {OPTIMIZATION_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = filters.optimization === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onFiltersChange({ ...filters, optimization: opt.id })}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border transition-all text-left',
                      isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    )}
                  >
                    <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reward Type */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Reward Type</Label>
            <div className="flex flex-wrap gap-2">
              {REWARD_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => toggleRewardType(type.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-all border-2',
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

          {/* Max Stops */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Max Stops: {filters.maxStops}</Label>
            <Slider
              value={[filters.maxStops]}
              onValueChange={([value]) => onFiltersChange({ ...filters, maxStops: value })}
              min={2}
              max={20}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>2</span>
              <span>20</span>
            </div>
          </div>

          {/* Max Distance */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Max Distance: {filters.maxDistance} km</Label>
            <Slider
              value={[filters.maxDistance]}
              onValueChange={([value]) => onFiltersChange({ ...filters, maxDistance: value })}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 km</span>
              <span>50 km</span>
            </div>
          </div>

          {/* Min Reward Per Stop */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Min Reward Per Stop: {filters.minRewardPerStop} coins</Label>
            <Slider
              value={[filters.minRewardPerStop]}
              onValueChange={([value]) => onFiltersChange({ ...filters, minRewardPerStop: value })}
              min={0}
              max={200}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0</span>
              <span>200+</span>
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Categories</Label>
            <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto">
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
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onReset}>
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
