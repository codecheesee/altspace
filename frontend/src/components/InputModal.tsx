import { useState, useEffect, useRef } from 'react';

interface InputModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function InputModal({
  isOpen,
  title,
  description,
  placeholder,
  defaultValue = '',
  onConfirm,
  onCancel,
}: InputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: '#18181b', border: '1px solid #3f3f46',
          borderRadius: '12px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
          padding: '20px', width: '320px', display: 'flex', flexDirection: 'column', gap: '12px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fafafa' }}>{title}</h3>
        {description && (
          <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa' }}>{description}</p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => {
            if (e.key === 'Enter') onConfirm(value);
            if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
          }}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#27272a', border: '1px solid #52525b',
            borderRadius: '8px', padding: '8px 12px',
            fontSize: '13px', color: '#fafafa', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: '#3f3f46', border: 'none', color: '#d4d4d8', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(value)}
            style={{ fontSize: '12px', padding: '6px 14px', borderRadius: '6px', background: '#2563eb', border: 'none', color: '#fff', cursor: 'pointer' }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
