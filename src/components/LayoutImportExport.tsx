// Layout Import/Export component for saving and sharing navigation configurations
import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { 
  Download, Upload, Copy, Check, Share2, FileJson, 
  AlertCircle, X
} from 'lucide-react';
import { useUICustomization } from '@/contexts/UICustomizationContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface LayoutImportExportProps {
  className?: string;
}

export const LayoutImportExport: React.FC<LayoutImportExportProps> = ({ className }) => {
  const { exportLayout, importLayout, pageLayout } = useUICustomization();
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [exportedJson, setExportedJson] = useState('');
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportLayout();
    setExportedJson(json);
    setIsExportOpen(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportedJson);
      setCopied(true);
      toast.success('Layout copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visuai-layout-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Layout downloaded');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'VisuAI Layout',
          text: 'Check out my custom VisuAI navigation layout!',
          files: [new File([exportedJson], 'layout.json', { type: 'application/json' })],
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleImportFromText = () => {
    setImportError(null);
    if (!importJson.trim()) {
      setImportError('Please paste a layout configuration');
      return;
    }
    
    const success = importLayout(importJson);
    if (success) {
      toast.success('Layout imported successfully');
      setIsImportOpen(false);
      setImportJson('');
    } else {
      setImportError('Invalid layout format. Please check your JSON.');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
      setImportError(null);
    };
    reader.onerror = () => {
      setImportError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const pageCount = pageLayout.pages.length;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Export Button */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogTrigger asChild>
          <button
            onClick={handleExport}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-primary/10 border border-primary/30",
              "text-primary hover:bg-primary/20 transition-all",
              "text-xs font-medium"
            )}
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="w-5 h-5 text-primary" />
              Export Layout
            </DialogTitle>
            <DialogDescription>
              Save your {pageCount}-page navigation layout
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Preview */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <pre className="text-[10px] font-mono text-muted-foreground overflow-auto max-h-48">
                {exportedJson}
              </pre>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg",
                  "bg-muted hover:bg-muted/80 transition-colors",
                  "text-sm font-medium"
                )}
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg",
                  "bg-primary text-primary-foreground hover:bg-primary/90 transition-colors",
                  "text-sm font-medium"
                )}
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleShare}
                className={cn(
                  "p-2 rounded-lg",
                  "bg-accent/20 hover:bg-accent/30 transition-colors"
                )}
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Button */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-muted/50 border border-border/30",
              "text-foreground hover:bg-muted transition-all",
              "text-xs font-medium"
            )}
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Import Layout
            </DialogTitle>
            <DialogDescription>
              Load a saved navigation configuration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* File Upload */}
            <div 
              className={cn(
                "border-2 border-dashed rounded-xl p-6",
                "flex flex-col items-center justify-center gap-2",
                "cursor-pointer hover:border-primary/50 transition-colors",
                "border-border/50"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileJson className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to select file or drag & drop
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                .json files only
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </div>

            {/* Or separator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or paste JSON</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Text Input */}
            <textarea
              value={importJson}
              onChange={(e) => {
                setImportJson(e.target.value);
                setImportError(null);
              }}
              placeholder='{"version": "1.0", "pageLayout": {...}}'
              className={cn(
                "w-full h-32 p-3 rounded-lg",
                "bg-muted/30 border border-border/30",
                "text-xs font-mono resize-none",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                importError && "border-destructive"
              )}
            />

            {/* Error Message */}
            {importError && (
              <div className="flex items-center gap-2 text-destructive text-xs">
                <AlertCircle className="w-4 h-4" />
                {importError}
              </div>
            )}

            {/* Import Button */}
            <button
              onClick={handleImportFromText}
              disabled={!importJson.trim()}
              className={cn(
                "w-full py-2.5 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:bg-primary/90 transition-colors",
                "text-sm font-medium",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Import Layout
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LayoutImportExport;
