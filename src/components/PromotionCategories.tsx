import React from 'react';
import { 
  Utensils, 
  ShoppingBag, 
  Film, 
  Heart, 
  Wrench,
  Coffee,
  Dumbbell,
  Sparkles,
  Car,
  Book,
  Music,
  Plane,
  Home,
  Shirt,
  Gift,
  type LucideIcon
} from 'lucide-react';

export interface CategoryInfo {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const PROMOTION_CATEGORIES: CategoryInfo[] = [
  { id: 'food_drink', label: 'Food & Drink', icon: Utensils, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  { id: 'entertainment', label: 'Entertainment', icon: Film, color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
  { id: 'health', label: 'Health & Wellness', icon: Heart, color: 'text-red-500', bgColor: 'bg-red-500/10' },
  { id: 'services', label: 'Services', icon: Wrench, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  { id: 'cafe', label: 'Café', icon: Coffee, color: 'text-amber-600', bgColor: 'bg-amber-600/10' },
  { id: 'fitness', label: 'Fitness', icon: Dumbbell, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  { id: 'beauty', label: 'Beauty', icon: Sparkles, color: 'text-fuchsia-500', bgColor: 'bg-fuchsia-500/10' },
  { id: 'automotive', label: 'Automotive', icon: Car, color: 'text-slate-500', bgColor: 'bg-slate-500/10' },
  { id: 'education', label: 'Education', icon: Book, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  { id: 'nightlife', label: 'Nightlife', icon: Music, color: 'text-violet-500', bgColor: 'bg-violet-500/10' },
  { id: 'travel', label: 'Travel', icon: Plane, color: 'text-cyan-500', bgColor: 'bg-cyan-500/10' },
  { id: 'home', label: 'Home & Garden', icon: Home, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { id: 'fashion', label: 'Fashion', icon: Shirt, color: 'text-rose-500', bgColor: 'bg-rose-500/10' },
  { id: 'gifts', label: 'Gifts', icon: Gift, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
];

export const getCategoryInfo = (categoryId: string): CategoryInfo => {
  return PROMOTION_CATEGORIES.find(c => c.id === categoryId) || {
    id: 'general',
    label: 'General',
    icon: ShoppingBag,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
  };
};

export const CategoryIcon: React.FC<{ 
  category: string; 
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}> = ({ category, size = 'md', showLabel = false, className }) => {
  const info = getCategoryInfo(category);
  const Icon = info.icon;
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const containerSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`${containerSizes[size]} ${info.bgColor} rounded-lg flex items-center justify-center`}>
        <Icon className={`${sizeClasses[size]} ${info.color}`} />
      </div>
      {showLabel && (
        <span className="text-sm font-medium">{info.label}</span>
      )}
    </div>
  );
};
