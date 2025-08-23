import React, { useState, useEffect, useRef } from 'react';
import { SketchPicker, ColorResult } from 'react-color';

type ColorInputProps = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

const ColorInput: React.FC<ColorInputProps> = ({ label, value, onChange, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePickerChange = (colorResult: ColorResult) => {
    onChange(colorResult.hex);
  };

  return (
    <div className=''>
      {label && <label className='mb-1 block text-sm font-medium'>{label}</label>}
      <div className='flex items-center'>
        <div
          className={`border-base-200 relative mr-2 flex h-7 w-8 items-center justify-center overflow-hidden rounded border ${
            disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
          }`}
          style={{ backgroundColor: value }}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        />

        <input
          type='text'
          value={value}
          spellCheck={false}
          onChange={(e) => !disabled && onChange(e.target.value)}
          disabled={disabled}
          className='bg-base-100 text-base-content border-base-200 min-w-4 max-w-36 flex-1 rounded border p-1 font-mono text-sm disabled:cursor-not-allowed disabled:opacity-50'
        />
      </div>

      {isOpen && !disabled && (
        <div ref={pickerRef} className='relative z-50 mt-2'>
          <div className='absolute'>
            <SketchPicker
              width='100%'
              color={value}
              onChange={handlePickerChange}
              disableAlpha={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ColorInput;
