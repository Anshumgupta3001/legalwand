import React from 'react';

const TypeToggle = ({ options, value, onChange }) => {
  return (
    <div
      className="flex p-1 rounded-md gap-1"
      style={{ backgroundColor: '#f2ede6' }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-medium transition-all duration-150
              ${isActive
                ? 'bg-bg-card text-txt-primary shadow-sm font-semibold'
                : 'text-txt-muted hover:text-txt-secondary hover:bg-bg-hover/60'
              }
            `}
          >
            {option.icon && <span>{option.icon}</span>}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TypeToggle;
