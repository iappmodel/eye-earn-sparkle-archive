// Button Group Manager - Organize buttons into collapsible sections with drag-and-drop
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FolderPlus, ChevronDown, ChevronRight, Trash2, X, Check, Plus, Minus, Layers,
  Heart, Video, Compass, Gift, Shield, Sparkles, Activity, GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  ButtonUIGroup,
  ButtonHoverEffect,
  loadButtonUIGroups,
  saveButtonUIGroups,
  createButtonUIGroup,
  toggleUIGroupCollapse,
  deleteButtonUIGroup,
  addButtonToUIGroup,
  removeButtonFromUIGroup,
  setGroupHoverEffect,
  createGroupFromTemplate,
  GROUP_TEMPLATES,
  BUTTON_HOVER_OPTIONS,
  reorderButtonInGroup,
  moveButtonBetweenGroups,
} from './LongPressButtonWrapper';

interface DragState {
  buttonId: string;
  sourceGroupId: string;
  sourceIndex: number;
}

interface ButtonGroupManagerProps {
  isOpen: boolean;
  onClose: () => void;
  availableButtonIds: string[];
  buttonLabels: Record<string, string>;
}

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  'heart': <Heart className="w-4 h-4" />,
  'video': <Video className="w-4 h-4" />,
  'compass': <Compass className="w-4 h-4" />,
  'gift': <Gift className="w-4 h-4" />,
  'shield': <Shield className="w-4 h-4" />,
};

export const ButtonGroupManager: React.FC<ButtonGroupManagerProps> = ({
  isOpen,
  onClose,
  availableButtonIds,
  buttonLabels,
}) => {
  const { light, success, medium } = useHapticFeedback();
  const [groups, setGroups] = useState<ButtonUIGroup[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedButtons, setSelectedButtons] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingHover, setEditingHover] = useState<string | null>(null);
  
  // Drag and drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ groupId: string; index: number } | null>(null);
  const draggedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGroups(loadButtonUIGroups());
    }
  }, [isOpen]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.DragEvent, buttonId: string, groupId: string, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', buttonId);
    setDragState({ buttonId, sourceGroupId: groupId, sourceIndex: index });
    medium();
    
    // Add a small delay to allow the drag image to be created
    setTimeout(() => {
      if (draggedRef.current) {
        draggedRef.current.style.opacity = '0.5';
      }
    }, 0);
  }, [medium]);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, groupId: string, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (dropTarget?.groupId !== groupId || dropTarget?.index !== index) {
      setDropTarget({ groupId, index });
      light();
    }
  }, [dropTarget, light]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDropTarget(null);
    if (draggedRef.current) {
      draggedRef.current.style.opacity = '1';
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent, targetGroupId: string, targetIndex: number) => {
    e.preventDefault();
    
    if (!dragState) return;
    
    const { buttonId, sourceGroupId, sourceIndex } = dragState;
    
    if (sourceGroupId === targetGroupId) {
      // Reorder within the same group
      if (sourceIndex !== targetIndex) {
        reorderButtonInGroup(sourceGroupId, sourceIndex, targetIndex);
        success();
      }
    } else {
      // Move between groups
      moveButtonBetweenGroups(sourceGroupId, targetGroupId, buttonId, targetIndex);
      success();
    }
    
    setGroups(loadButtonUIGroups());
    setDragState(null);
    setDropTarget(null);
  }, [dragState, success]);

  // Handle drop on group header (add to end)
  const handleDropOnGroup = useCallback((e: React.DragEvent, targetGroupId: string) => {
    e.preventDefault();
    
    if (!dragState) return;
    
    const { buttonId, sourceGroupId } = dragState;
    const targetGroup = groups.find(g => g.id === targetGroupId);
    
    if (sourceGroupId !== targetGroupId && targetGroup) {
      moveButtonBetweenGroups(sourceGroupId, targetGroupId, buttonId, targetGroup.buttonIds.length);
      success();
      setGroups(loadButtonUIGroups());
    }
    
    setDragState(null);
    setDropTarget(null);
  }, [dragState, groups, success]);

  const handleCreateGroup = () => {
    if (selectedButtons.length < 1) return;
    
    light();
    const newGroup = createButtonUIGroup(selectedButtons, newGroupName || undefined);
    setGroups([...groups, newGroup]);
    setIsCreating(false);
    setNewGroupName('');
    setSelectedButtons([]);
    success();
  };

  const handleApplyTemplate = (templateId: string) => {
    light();
    const newGroup = createGroupFromTemplate(templateId, availableButtonIds);
    if (newGroup) {
      setGroups([...groups, newGroup]);
      success();
    }
    setShowTemplates(false);
  };

  const handleDeleteGroup = (groupId: string) => {
    light();
    deleteButtonUIGroup(groupId);
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const handleToggleCollapse = (groupId: string) => {
    light();
    toggleUIGroupCollapse(groupId);
    setGroups(groups.map(g => 
      g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
    ));
  };

  const handleAddToGroup = (groupId: string, buttonId: string) => {
    light();
    addButtonToUIGroup(groupId, buttonId);
    setGroups(loadButtonUIGroups());
  };

  const handleRemoveFromGroup = (groupId: string, buttonId: string) => {
    light();
    removeButtonFromUIGroup(groupId, buttonId);
    setGroups(loadButtonUIGroups());
  };

  const handleSetGroupHover = (groupId: string, hover: ButtonHoverEffect) => {
    light();
    setGroupHoverEffect(groupId, hover);
    setGroups(groups.map(g => 
      g.id === groupId ? { ...g, hoverEffect: hover } : g
    ));
  };

  const toggleButtonSelection = (buttonId: string) => {
    light();
    setSelectedButtons(prev => 
      prev.includes(buttonId) 
        ? prev.filter(id => id !== buttonId)
        : [...prev, buttonId]
    );
  };

  const getUngroupedButtons = (): string[] => {
    const groupedIds = new Set(groups.flatMap(g => g.buttonIds));
    return availableButtonIds.filter(id => !groupedIds.has(id));
  };

  const getAvailableTemplates = () => {
    return GROUP_TEMPLATES.filter(template => {
      // Check if any buttons from this template are available and not already grouped
      const ungrouped = getUngroupedButtons();
      return template.buttonIds.some(id => ungrouped.includes(id));
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[9999] max-w-md mx-auto rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl animate-scale-in overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-3">
            <Layers className="w-5 h-5 text-primary" />
            <span className="text-lg font-semibold">Button Groups</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Quick Templates Section */}
          {getAvailableTemplates().length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-accent">Quick Templates</span>
                </div>
                {showTemplates ? (
                  <ChevronDown className="w-4 h-4 text-accent" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-accent" />
                )}
              </button>
              
              {showTemplates && (
                <div className="space-y-1.5 animate-fade-in">
                  {getAvailableTemplates().map(template => {
                    const matchingButtons = template.buttonIds.filter(id => 
                      getUngroupedButtons().includes(id)
                    );
                    return (
                      <button
                        key={template.id}
                        onClick={() => handleApplyTemplate(template.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                          {TEMPLATE_ICONS[template.icon] || <Layers className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{template.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </div>
                          <div className="text-[10px] text-primary mt-0.5">
                            {matchingButtons.length} button{matchingButtons.length !== 1 ? 's' : ''} available
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Existing Groups */}
          {groups.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Your Groups</span>
              {groups.map(group => (
                <div key={group.id} className="rounded-xl bg-muted/30 overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center justify-between p-3 bg-muted/50">
                    <button
                      onClick={() => handleToggleCollapse(group.id)}
                      className="flex items-center gap-2 flex-1"
                    >
                      {group.isCollapsed ? (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                      {group.icon && TEMPLATE_ICONS[group.icon] && (
                        <span className="text-primary">{TEMPLATE_ICONS[group.icon]}</span>
                      )}
                      <span className="font-medium text-sm">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({group.buttonIds.length})
                      </span>
                      {group.hoverEffect && group.hoverEffect !== 'none' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                          {BUTTON_HOVER_OPTIONS.find(h => h.value === group.hoverEffect)?.label}
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingHover(editingHover === group.id ? null : group.id)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          editingHover === group.id 
                            ? 'bg-accent text-accent-foreground' 
                            : 'hover:bg-muted'
                        )}
                        title="Set group hover effect"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingGroup(editingGroup === group.id ? null : group.id)}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          editingGroup === group.id 
                            ? 'bg-primary text-primary-foreground' 
                            : 'hover:bg-muted'
                        )}
                      >
                        {editingGroup === group.id ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Group Hover Effect Selector */}
                  {editingHover === group.id && (
                    <div className="p-2 bg-accent/10 border-b border-accent/20 animate-fade-in">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-medium text-accent">Group Hover Effect</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {BUTTON_HOVER_OPTIONS.map(option => (
                          <button
                            key={option.value}
                            onClick={() => handleSetGroupHover(group.id, option.value)}
                            className={cn(
                              'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                              group.hoverEffect === option.value
                                ? 'bg-accent text-accent-foreground'
                                : 'bg-muted/50 hover:bg-muted text-foreground/70'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        All buttons in this group will use this hover effect
                      </p>
                    </div>
                  )}
                  
                  {/* Group Buttons with Drag and Drop */}
                  {!group.isCollapsed && (
                    <div 
                      className="p-2 space-y-1 min-h-[40px]"
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (group.buttonIds.length === 0) {
                          handleDragOver(e, group.id, 0);
                        }
                      }}
                      onDrop={(e) => {
                        if (group.buttonIds.length === 0) {
                          handleDrop(e, group.id, 0);
                        }
                      }}
                    >
                      {group.buttonIds.map((buttonId, index) => (
                        <div key={buttonId} className="relative">
                          {/* Drop indicator above */}
                          {dropTarget?.groupId === group.id && dropTarget?.index === index && dragState?.sourceGroupId !== group.id && (
                            <div className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full animate-pulse" />
                          )}
                          {dropTarget?.groupId === group.id && dropTarget?.index === index && dragState?.sourceGroupId === group.id && dragState?.sourceIndex > index && (
                            <div className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full animate-pulse" />
                          )}
                          
                          <div 
                            ref={dragState?.buttonId === buttonId ? draggedRef : null}
                            draggable
                            onDragStart={(e) => handleDragStart(e, buttonId, group.id, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, group.id, index)}
                            onDrop={(e) => handleDrop(e, group.id, index)}
                            className={cn(
                              'flex items-center justify-between p-2 rounded-lg bg-background/50 cursor-grab active:cursor-grabbing transition-all',
                              dragState?.buttonId === buttonId && 'opacity-50 ring-2 ring-primary',
                              dropTarget?.groupId === group.id && dropTarget?.index === index && dragState?.buttonId !== buttonId && 'ring-2 ring-primary/50'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                              <span className="text-sm">{buttonLabels[buttonId] || buttonId}</span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFromGroup(group.id, buttonId);
                              }}
                              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </div>
                          
                          {/* Drop indicator below (only for last item) */}
                          {index === group.buttonIds.length - 1 && 
                           dropTarget?.groupId === group.id && 
                           dropTarget?.index === group.buttonIds.length && (
                            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-primary rounded-full animate-pulse" />
                          )}
                        </div>
                      ))}
                      
                      {/* Add buttons to group */}
                      {editingGroup === group.id && getUngroupedButtons().length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-primary/10 border border-primary/20">
                          <span className="text-xs text-primary font-medium">Add to group:</span>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {getUngroupedButtons().map(buttonId => (
                              <button
                                key={buttonId}
                                onClick={() => handleAddToGroup(group.id, buttonId)}
                                className="px-2 py-1 rounded-md bg-muted/50 hover:bg-primary hover:text-primary-foreground text-xs transition-colors"
                              >
                                {buttonLabels[buttonId] || buttonId}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create New Group */}
          {isCreating ? (
            <div className="space-y-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-primary" />
                <span className="font-medium text-sm">Create Custom Group</span>
              </div>
              
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name (optional)"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              
              <div className="space-y-2">
                <span className="text-xs text-muted-foreground">Select buttons to group:</span>
                <div className="flex flex-wrap gap-1.5">
                  {getUngroupedButtons().map(buttonId => (
                    <button
                      key={buttonId}
                      onClick={() => toggleButtonSelection(buttonId)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                        selectedButtons.includes(buttonId)
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                          : 'bg-muted/50 hover:bg-muted text-foreground/70'
                      )}
                    >
                      {buttonLabels[buttonId] || buttonId}
                    </button>
                  ))}
                </div>
                {getUngroupedButtons().length === 0 && (
                  <p className="text-xs text-muted-foreground italic">All buttons are already grouped</p>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setSelectedButtons([]);
                    setNewGroupName('');
                  }}
                  className="flex-1 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateGroup}
                  disabled={selectedButtons.length < 1}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedButtons.length >= 1
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                  )}
                >
                  Create Group
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
            >
              <FolderPlus className="w-5 h-5" />
              <span className="font-medium">Create Custom Group</span>
            </button>
          )}

          {/* Ungrouped Buttons */}
          {getUngroupedButtons().length > 0 && groups.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Ungrouped Buttons</span>
              <div className="flex flex-wrap gap-1.5">
                {getUngroupedButtons().map(buttonId => (
                  <span
                    key={buttonId}
                    className="px-2.5 py-1.5 rounded-lg bg-muted/30 text-xs text-muted-foreground"
                  >
                    {buttonLabels[buttonId] || buttonId}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Group hover effects apply to all buttons in the group
          </p>
        </div>
      </div>
    </>
  );
};

export default ButtonGroupManager;
