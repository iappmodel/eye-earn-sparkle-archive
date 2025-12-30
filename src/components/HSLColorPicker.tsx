// HSL Color Picker component for live page theme customization
import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

interface HSLColorPickerProps {
  value: string; // HSL string format: "270 95% 65%"
  onChange: (value: string) => void;
  label?: string;
  showPreview?: boolean;
}

interface HSLValues {
  h: number;
  s: number;
  l: number;
}

const parseHSL = (hslString: string): HSLValues => {
  if (!hslString) return { h: 270, s: 95, l: 65 };
  
  const parts = hslString.split(' ');
  return {
    h: parseInt(parts[0]) || 270,
    s: parseInt(parts[1]?.replace('%', '')) || 95,
    l: parseInt(parts[2]?.replace('%', '')) || 65,
  };
};

const toHSLString = (values: HSLValues): string => {
  return `${values.h} ${values.s}% ${values.l}%`;
};

export const HSLColorPicker: React.FC<HSLColorPickerProps> = ({
  value,
  onChange,
  label,
  showPreview = true,
}) => {
  const [hsl, setHsl] = useState<HSLValues>(parseHSL(value));

  useEffect(() => {
    setHsl(parseHSL(value));
  }, [value]);

  const handleChange = (key: keyof HSLValues, val: number) => {
    const newHsl = { ...hsl, [key]: val };
    setHsl(newHsl);
    onChange(toHSLString(newHsl));
  };

  const hslColor = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const gradientH = `linear-gradient(to right, 
    hsl(0, ${hsl.s}%, ${hsl.l}%), 
    hsl(60, ${hsl.s}%, ${hsl.l}%), 
    hsl(120, ${hsl.s}%, ${hsl.l}%), 
    hsl(180, ${hsl.s}%, ${hsl.l}%), 
    hsl(240, ${hsl.s}%, ${hsl.l}%), 
    hsl(300, ${hsl.s}%, ${hsl.l}%), 
    hsl(360, ${hsl.s}%, ${hsl.l}%)
  )`;
  const gradientS = `linear-gradient(to right, 
    hsl(${hsl.h}, 0%, ${hsl.l}%), 
    hsl(${hsl.h}, 100%, ${hsl.l}%)
  )`;
  const gradientL = `linear-gradient(to right, 
    hsl(${hsl.h}, ${hsl.s}%, 0%), 
    hsl(${hsl.h}, ${hsl.s}%, 50%), 
    hsl(${hsl.h}, ${hsl.s}%, 100%)
  )`;

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {showPreview && (
            <div 
              className="w-6 h-6 rounded-full border border-border shadow-sm"
              style={{ backgroundColor: hslColor }}
            />
          )}
        </div>
      )}
      
      {/* Hue Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/70">Hue</span>
          <span className="text-[10px] font-mono text-muted-foreground">{hsl.h}°</span>
        </div>
        <div 
          className="h-3 rounded-full relative overflow-hidden"
          style={{ background: gradientH }}
        >
          <Slider
            value={[hsl.h]}
            min={0}
            max={360}
            step={1}
            onValueChange={([val]) => handleChange('h', val)}
            className="absolute inset-0"
          />
        </div>
      </div>

      {/* Saturation Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/70">Saturation</span>
          <span className="text-[10px] font-mono text-muted-foreground">{hsl.s}%</span>
        </div>
        <div 
          className="h-3 rounded-full relative overflow-hidden"
          style={{ background: gradientS }}
        >
          <Slider
            value={[hsl.s]}
            min={0}
            max={100}
            step={1}
            onValueChange={([val]) => handleChange('s', val)}
            className="absolute inset-0"
          />
        </div>
      </div>

      {/* Lightness Slider */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/70">Lightness</span>
          <span className="text-[10px] font-mono text-muted-foreground">{hsl.l}%</span>
        </div>
        <div 
          className="h-3 rounded-full relative overflow-hidden"
          style={{ background: gradientL }}
        >
          <Slider
            value={[hsl.l]}
            min={0}
            max={100}
            step={1}
            onValueChange={([val]) => handleChange('l', val)}
            className="absolute inset-0"
          />
        </div>
      </div>

      {/* Color Preview with Value */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/30">
        <div 
          className="w-10 h-10 rounded-lg shadow-inner border border-white/10"
          style={{ 
            backgroundColor: hslColor,
            boxShadow: `0 0 20px ${hslColor}40`
          }}
        />
        <div className="flex-1">
          <div className="text-[10px] text-muted-foreground">HSL Value</div>
          <code className="text-xs font-mono text-foreground/80">
            {toHSLString(hsl)}
          </code>
        </div>
      </div>
    </div>
  );
};

export default HSLColorPicker;
