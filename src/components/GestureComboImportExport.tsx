import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  GestureCombo, 
  loadGestureCombos, 
  saveGestureCombos 
} from '@/hooks/useGestureCombos';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { cn } from '@/lib/utils';

interface GestureComboImportExportProps {
  onImportComplete?: () => void;
}

type ImportMode = 'merge' | 'replace';

export const GestureComboImportExport: React.FC<GestureComboImportExportProps> = ({
  onImportComplete,
}) => {
  const { toast } = useToast();
  const haptics = useHapticFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');

  const handleExport = () => {
    try {
      const combos = loadGestureCombos();
      const exportData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        combos,
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `gesture-combos-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      haptics.success();
      toast({
        title: 'Export Successful',
        description: `Exported ${combos.length} gesture combos.`,
      });
    } catch (error) {
      haptics.error();
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: 'Could not export gesture combos.',
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Support legacy array or versioned payload
      const rawCombos: unknown[] = Array.isArray(data) ? data : (data?.combos ?? []);
      if (!Array.isArray(rawCombos) || rawCombos.length === 0) {
        throw new Error('Invalid file format: missing or empty combos array');
      }
      
      const validCombos: GestureCombo[] = [];
      for (const combo of rawCombos as Record<string, unknown>[]) {
        if (!combo?.name || !combo?.steps || !combo?.action) {
          console.warn('[Import] Skipping invalid combo:', combo);
          continue;
        }
        const importedCombo: GestureCombo = {
          id: String(combo.id || '').startsWith('custom-') ? `imported-${Date.now()}-${Math.random().toString(36).slice(2, 11)}` : (combo.id as string) || `imported-${Date.now()}`,
          name: String(combo.name),
          description: String(combo.description || ''),
          steps: Array.isArray(combo.steps) ? combo.steps as GestureCombo['steps'] : [],
          action: combo.action as GestureCombo['action'],
          enabled: combo.enabled !== false,
        };
        validCombos.push(importedCombo);
      }
      
      if (validCombos.length === 0) {
        throw new Error('No valid combos found in file');
      }
      
      if (importMode === 'replace') {
        saveGestureCombos(validCombos);
        haptics.success();
        toast({
          title: 'Import Successful',
          description: `Replaced all combos with ${validCombos.length} from file.`,
        });
      } else {
        const existingCombos = loadGestureCombos();
        const existingNames = new Set(existingCombos.map(c => c.name.toLowerCase()));
        const newCombos = validCombos.filter(c => !existingNames.has(c.name.toLowerCase()));
        const mergedCombos = [...existingCombos, ...newCombos];
        saveGestureCombos(mergedCombos);
        haptics.success();
        toast({
          title: 'Import Successful',
          description: `Imported ${newCombos.length} new combos. ${validCombos.length - newCombos.length} duplicates skipped.`,
        });
      }
      
      onImportComplete?.();
    } catch (error) {
      haptics.error();
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Could not parse the file.',
      });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Import:</span>
        <button
          onClick={() => { setImportMode('merge'); haptics.light(); }}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-colors',
            importMode === 'merge' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          )}
        >
          Merge
        </button>
        <button
          onClick={() => { setImportMode('replace'); haptics.light(); }}
          className={cn(
            'px-2 py-1 rounded text-xs font-medium transition-colors',
            importMode === 'replace' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
          )}
        >
          Replace all
        </button>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleImportClick} className="flex-1">
          <Upload className="w-4 h-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          Export all
        </Button>
      </div>
    </div>
  );
};

export default GestureComboImportExport;
