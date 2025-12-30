import React, { useRef } from 'react';
import { Download, Upload, FileJson, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  GestureCombo, 
  loadGestureCombos, 
  saveGestureCombos 
} from '@/hooks/useGestureCombos';
import { useToast } from '@/hooks/use-toast';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GestureComboImportExportProps {
  onImportComplete?: () => void;
}

export const GestureComboImportExport: React.FC<GestureComboImportExportProps> = ({
  onImportComplete,
}) => {
  const { toast } = useToast();
  const haptics = useHapticFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const combos = loadGestureCombos();
      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        combos: combos,
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
      
      // Validate structure
      if (!data.combos || !Array.isArray(data.combos)) {
        throw new Error('Invalid file format: missing combos array');
      }
      
      // Validate each combo
      const validCombos: GestureCombo[] = [];
      for (const combo of data.combos) {
        if (!combo.id || !combo.name || !combo.steps || !combo.action) {
          console.warn('[Import] Skipping invalid combo:', combo);
          continue;
        }
        
        // Ensure imported combos have unique IDs
        const importedCombo: GestureCombo = {
          id: combo.id.startsWith('custom-') ? `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : combo.id,
          name: combo.name,
          description: combo.description || '',
          steps: combo.steps,
          action: combo.action,
          enabled: combo.enabled ?? true,
        };
        
        validCombos.push(importedCombo);
      }
      
      if (validCombos.length === 0) {
        throw new Error('No valid combos found in file');
      }
      
      // Merge with existing combos (avoid duplicates by name)
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
      
      onImportComplete?.();
    } catch (error) {
      haptics.error();
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Could not parse the file.',
      });
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleImportClick}
        className="flex-1"
      >
        <Upload className="w-4 h-4 mr-2" />
        Import
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="flex-1"
      >
        <Download className="w-4 h-4 mr-2" />
        Export
      </Button>
    </div>
  );
};

export default GestureComboImportExport;
