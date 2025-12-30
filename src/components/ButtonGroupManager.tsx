// Button Group Manager - Organize buttons into collapsible sections
import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, ChevronDown, ChevronRight, Trash2, X, Check, Plus, Minus, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import {
  ButtonUIGroup,
  loadButtonUIGroups,
  saveButtonUIGroups,
  createButtonUIGroup,
  toggleUIGroupCollapse,
  deleteButtonUIGroup,
  addButtonToUIGroup,
  removeButtonFromUIGroup,
} from './LongPressButtonWrapper';

interface ButtonGroupManagerProps {
  isOpen: boolean;
  onClose: () => void;
  availableButtonIds: string[];
  buttonLabels: Record<string, string>;
}

export const ButtonGroupManager: React.FC<ButtonGroupManagerProps> = ({
  isOpen,
  onClose,
  availableButtonIds,
  buttonLabels,
}) => {
  const { light, success } = useHapticFeedback();
  const [groups, setGroups] = useState<ButtonUIGroup[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedButtons, setSelectedButtons] = useState<string[]>([]);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGroups(loadButtonUIGroups());
    }
  }, [isOpen]);

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
                      <span className="font-medium text-sm">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({group.buttonIds.length} buttons)
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
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
                  
                  {/* Group Buttons */}
                  {!group.isCollapsed && (
                    <div className="p-2 space-y-1">
                      {group.buttonIds.map(buttonId => (
                        <div 
                          key={buttonId}
                          className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                        >
                          <span className="text-sm">{buttonLabels[buttonId] || buttonId}</span>
                          <button
                            onClick={() => handleRemoveFromGroup(group.id, buttonId)}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                      }
                      
                      {/* Add buttons to group */}
                      {editingGroup === group.id && (
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
                <span className="font-medium text-sm">Create New Group</span>
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
              <span className="font-medium">Create New Group</span>
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
            Grouped buttons can be collapsed to save screen space
          </p>
        </div>
      </div>
    </>
  );
};

export default ButtonGroupManager;
