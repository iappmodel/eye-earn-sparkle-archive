import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  List,
  Clock,
  Zap,
  Plus,
  MoreVertical,
  Trash2,
  Edit3,
  Globe,
  Repeat,
  ChevronRight,
  CalendarClock,
  Video,
  Image,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  format,
  addDays,
  setHours,
  setMinutes,
  isBefore,
  isAfter,
  startOfDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  isToday,
  isTomorrow,
  isPast,
  parseISO,
} from 'date-fns';

// ─── Types (UI-only; no persistence to backend) ─────────────────────────────

export type ScheduleRepeat = 'none' | 'daily' | 'weekly';

export interface ScheduledItem {
  id: string;
  title: string;
  scheduledAt: string; // ISO
  thumbnailUrl?: string | null;
  contentType?: 'video' | 'image' | 'post';
  repeat: ScheduleRepeat;
  platform?: string;
}

type ViewMode = 'calendar' | 'list';
type FilterMode = 'all' | 'upcoming' | 'past';

const STORAGE_KEY = 'schedule_shell_items';

function loadStoredItems(): ScheduledItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDemoItems();
    const parsed = JSON.parse(raw) as ScheduledItem[];
    return Array.isArray(parsed) ? parsed : getDemoItems();
  } catch {
    return getDemoItems();
  }
}

function saveStoredItems(items: ScheduledItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function getDemoItems(): ScheduledItem[] {
  const now = new Date();
  return [
    {
      id: 'demo-1',
      title: 'Morning Reel',
      scheduledAt: setHours(setMinutes(addDays(now, 1), 0), 9).toISOString(),
      contentType: 'video',
      repeat: 'none',
      platform: 'TikTok',
    },
    {
      id: 'demo-2',
      title: 'Product Launch Post',
      scheduledAt: setHours(setMinutes(addDays(now, 2), 30), 14).toISOString(),
      contentType: 'post',
      repeat: 'none',
      platform: 'Instagram',
    },
    {
      id: 'demo-3',
      title: 'Weekly Recap',
      scheduledAt: setHours(setMinutes(addDays(now, 5), 0), 18).toISOString(),
      contentType: 'video',
      repeat: 'weekly',
      platform: 'YouTube',
    },
  ];
}

const TIMEZONES = [
  { value: 'local', label: 'Local time' },
  { value: 'America/New_York', label: 'Eastern (ET)' },
  { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'UTC', label: 'UTC' },
];

function getNextMondayOffset(): number {
  const d = new Date();
  const day = d.getDay();
  return day === 0 ? 1 : day === 1 ? 0 : 8 - day;
}

const QUICK_SLOTS: { label: string; hour: number; minute: number; dayOffset: number }[] = [
  { label: 'Tomorrow 9:00 AM', hour: 9, minute: 0, dayOffset: 1 },
  { label: 'Tomorrow 6:00 PM', hour: 18, minute: 0, dayOffset: 1 },
  { label: 'In 2 days 12:00 PM', hour: 12, minute: 0, dayOffset: 2 },
  { label: 'Next Monday 10:00 AM', hour: 10, minute: 0, dayOffset: 0 }, // overwritten in render
];

// ─── Component ─────────────────────────────────────────────────────────────

export const ScheduleShell: React.FC = () => {
  const [items, setItems] = useState<ScheduledItem[]>(loadStoredItems);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterMode, setFilterMode] = useState<FilterMode>('upcoming');
  const [timezone, setTimezone] = useState('local');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formHour, setFormHour] = useState(12);
  const [formMinute, setFormMinute] = useState(0);
  const [formRepeat, setFormRepeat] = useState<ScheduleRepeat>('none');

  const persist = (next: ScheduledItem[]) => {
    setItems(next);
    saveStoredItems(next);
  };

  const filteredItems = useMemo(() => {
    const now = new Date();
    if (filterMode === 'upcoming') return items.filter((i) => isAfter(parseISO(i.scheduledAt), now));
    if (filterMode === 'past') return items.filter((i) => isBefore(parseISO(i.scheduledAt), now));
    return items;
  }, [items, filterMode]);

  const upcomingItems = useMemo(
    () => items.filter((i) => isAfter(parseISO(i.scheduledAt), new Date())).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [items],
  );

  const nextUp = upcomingItems[0];
  const thisWeekStart = startOfWeek(calendarMonth, { weekStartsOn: 0 });
  const thisWeekEnd = endOfWeek(calendarMonth, { weekStartsOn: 0 });
  const countThisWeek = items.filter((i) => {
    const d = parseISO(i.scheduledAt);
    return isWithinInterval(d, { start: thisWeekStart, end: thisWeekEnd }) && isAfter(d, new Date());
  }).length;

  const daysWithSchedules = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(format(parseISO(i.scheduledAt), 'yyyy-MM-dd')));
    return set;
  }, [items]);

  const openAdd = () => {
    setEditingId(null);
    setFormTitle('');
    const tomorrow = addDays(new Date(), 1);
    setFormDate(tomorrow);
    setFormHour(9);
    setFormMinute(0);
    setFormRepeat('none');
    setSheetOpen(true);
  };

  const openEdit = (item: ScheduledItem) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDate(parseISO(item.scheduledAt));
    setFormHour(new Date(item.scheduledAt).getHours());
    setFormMinute(new Date(item.scheduledAt).getMinutes());
    setFormRepeat(item.repeat);
    setSheetOpen(true);
  };

  const handleSave = () => {
    const at = setHours(setMinutes(formDate, formMinute), formHour);
    if (isBefore(at, new Date())) {
      toast.error('Please choose a future date and time.');
      return;
    }
    if (!formTitle.trim()) {
      toast.error('Add a title for this scheduled item.');
      return;
    }
    if (editingId) {
      persist(
        items.map((i) =>
          i.id === editingId
            ? { ...i, title: formTitle.trim(), scheduledAt: at.toISOString(), repeat: formRepeat }
            : i,
        ),
      );
      toast.success('Schedule updated.');
    } else {
      persist([
        ...items,
        {
          id: `schedule-${Date.now()}`,
          title: formTitle.trim(),
          scheduledAt: at.toISOString(),
          repeat: formRepeat,
          contentType: 'post',
        },
      ]);
      toast.success('Added to schedule.');
    }
    setSheetOpen(false);
  };

  const handleRemove = (id: string) => {
    persist(items.filter((i) => i.id !== id));
    toast.success('Removed from schedule.');
  };

  const handleQuickSlot = (slot: (typeof QUICK_SLOTS)[0]) => {
    const d = addDays(new Date(), slot.dayOffset);
    const at = setHours(setMinutes(d, slot.minute), slot.hour);
    if (isBefore(at, new Date())) return;
    persist([
      ...items,
      {
        id: `schedule-${Date.now()}`,
        title: 'New scheduled post',
        scheduledAt: at.toISOString(),
        repeat: 'none',
        contentType: 'post',
      },
    ]);
    toast.success(`Scheduled for ${format(at, 'EEE, MMM d \'at\' h:mm a')}`);
  };

  const formatUpcoming = (iso: string) => {
    const d = parseISO(iso);
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`;
    if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`;
    return format(d, "EEE, MMM d 'at' h:mm a");
  };

  const contentIcon = (item: ScheduledItem) => {
    switch (item.contentType) {
      case 'video':
        return <Video className="w-4 h-4 text-muted-foreground" />;
      case 'image':
        return <Image className="w-4 h-4 text-muted-foreground" />;
      default:
        return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Plan and preview your content calendar. No automatic publishing—this is a scheduling shell only.
      </p>
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">This week</p>
            <p className="text-2xl font-bold text-foreground">{countThisWeek}</p>
            <p className="text-xs text-muted-foreground">posts scheduled</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Next up</p>
            {nextUp ? (
              <>
                <p className="text-sm font-semibold text-foreground truncate">{nextUp.title}</p>
                <p className="text-xs text-muted-foreground">{formatUpcoming(nextUp.scheduledAt)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nothing scheduled</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Timezone */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-muted-foreground" aria-hidden />
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((z) => (
              <SelectItem key={z.value} value={z.value}>
                {z.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* View + Filter */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="w-4 h-4" />
                List
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarIcon className="w-4 h-4" />
                Calendar
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div role="tablist" aria-label="Filter schedule" className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            {(['all', 'upcoming', 'past'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filterMode === f}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                  filterMode === f ? 'bg-background text-foreground shadow' : 'hover:bg-background/50 hover:text-foreground',
                )}
                onClick={() => setFilterMode(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="mt-0">

          <TabsContent value="list" className="mt-4 space-y-4">
            {/* Quick add slots */}
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Quick schedule
                </CardTitle>
                <CardDescription>Add a placeholder to your schedule (UI only)</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {QUICK_SLOTS.map((slot, idx) => {
                  const dayOffset = slot.label.startsWith('Next Monday') ? getNextMondayOffset() : slot.dayOffset;
                  const resolved = { ...slot, dayOffset };
                  return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleQuickSlot(resolved)}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {slot.label}
                  </Button>
                  );
                })}
              </CardContent>
            </Card>

            {/* Add button */}
            <Button onClick={openAdd} className="w-full gap-2" size="lg">
              <Plus className="w-4 h-4" />
              Add to schedule
            </Button>

            {/* List */}
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                      <CalendarClock className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-foreground">No scheduled items</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
                      {filterMode === 'upcoming'
                        ? 'Add a post or use a quick slot to see it here.'
                        : filterMode === 'past'
                          ? 'Past scheduled items will appear here.'
                          : 'Add items or switch to Upcoming to see your schedule.'}
                    </p>
                    {filterMode === 'upcoming' && (
                      <Button onClick={openAdd} variant="outline" className="mt-4 gap-2">
                        <Plus className="w-4 h-4" />
                        Add to schedule
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[320px] pr-2">
                <ul className="space-y-2">
                  {filteredItems.map((item) => (
                    <li key={item.id}>
                      <Card className="overflow-hidden transition-colors hover:border-primary/30">
                        <CardContent className="p-0">
                          <div className="flex items-center gap-3 p-3">
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {item.thumbnailUrl ? (
                                <img
                                  src={item.thumbnailUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                contentIcon(item)
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(item.scheduledAt), "EEE, MMM d 'at' h:mm a")}
                                </span>
                                {item.repeat !== 'none' && (
                                  <Badge variant="secondary" className="text-[10px] gap-0.5">
                                    <Repeat className="w-3 h-3" />
                                    {item.repeat}
                                  </Badge>
                                )}
                                {item.platform && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.platform}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                  <span className="sr-only">Actions</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEdit(item)}>
                                  <Edit3 className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleRemove(item.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <Card>
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={undefined}
                  onSelect={() => {}}
                  modifiers={{
                    scheduled: (date) => daysWithSchedules.has(format(date, 'yyyy-MM-dd')),
                  }}
                  modifiersClassNames={{
                    scheduled: 'bg-primary/20 text-primary font-semibold relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary',
                  }}
                />
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Dots indicate days with scheduled posts
                </p>
              </CardContent>
            </Card>
            <div className="mt-4 flex flex-wrap gap-2">
              {upcomingItems.slice(0, 5).map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  size="sm"
                  className="justify-between gap-2 text-left min-w-0 flex-1"
                  onClick={() => openEdit(item)}
                >
                  <span className="truncate">{item.title}</span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </Button>
              ))}
            </div>
            <Button onClick={openAdd} className="w-full mt-4 gap-2" variant="secondary">
              <Plus className="w-4 h-4" />
              Add to schedule
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add / Edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingId ? 'Edit schedule' : 'Add to schedule'}</SheetTitle>
            <SheetDescription>
              Choose when this post should go out. This is a preview only; no publish logic runs.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 py-4">
            <div className="space-y-4 pr-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-title">Title</Label>
                <Input
                  id="schedule-title"
                  placeholder="e.g. Morning Reel"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Calendar
                  mode="single"
                  selected={formDate}
                  onSelect={(d) => d && setFormDate(d)}
                  disabled={(date) => isBefore(startOfDay(date), startOfDay(new Date()))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-hour">Hour</Label>
                  <Select
                    value={String(formHour)}
                    onValueChange={(v) => setFormHour(Number(v))}
                  >
                    <SelectTrigger id="schedule-hour">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-minute">Minute</Label>
                  <Select
                    value={String(formMinute)}
                    onValueChange={(v) => setFormMinute(Number(v))}
                  >
                    <SelectTrigger id="schedule-minute">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 15, 30, 45].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {String(m).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Repeat</Label>
                <Select value={formRepeat} onValueChange={(v) => setFormRepeat(v as ScheduleRepeat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Don't repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <SheetFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingId ? 'Update' : 'Add to schedule'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ScheduleShell;
