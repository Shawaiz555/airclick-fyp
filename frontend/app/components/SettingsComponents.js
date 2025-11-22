// Shared Settings Components with Project Theme
// Used by both User and Admin settings pages for consistency
// Theme: Indigo → Purple → Pink background with Cyan → Blue accents

'use client';

// Futuristic Slider Component with glow effects
export const FuturisticSlider = ({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  displayValue,
  leftLabel,
  rightLabel,
  color = 'cyan' // cyan, purple, green, amber
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  const colorClasses = {
    cyan: {
      glow: 'shadow-cyan-500/50',
      bg: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      text: 'text-cyan-300',
      badge: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
    },
    purple: {
      glow: 'shadow-purple-500/50',
      bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
      text: 'text-purple-300',
      badge: 'bg-purple-500/20 border-purple-500/30 text-purple-300'
    },
    green: {
      glow: 'shadow-emerald-500/50',
      bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
      text: 'text-emerald-300',
      badge: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
    },
    amber: {
      glow: 'shadow-amber-500/50',
      bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
      text: 'text-amber-300',
      badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300'
    }
  };

  const colors = colorClasses[color] || colorClasses.cyan;

  return (
    <div className="group space-y-3 p-4 rounded-xl bg-gray-800/40 border border-gray-700/40 hover:border-cyan-500/30 transition-all duration-300">
      <div className="flex justify-between items-center">
        <label className="text-[15px] font-medium text-white">{label}</label>
        <span className={`text-[13px] font-semibold px-3 py-1 rounded-full border ${colors.badge}`}>
          {displayValue}
        </span>
      </div>

      {/* Custom Slider Track */}
      <div className="relative h-3 mt-2">
        {/* Background track */}
        <div className="absolute inset-0 bg-gray-700/60 rounded-full border border-gray-600/30"></div>

        {/* Filled track with glow */}
        <div
          className={`absolute left-0 top-0 h-full ${colors.bg} rounded-full transition-all duration-150 shadow-lg ${colors.glow}`}
          style={{ width: `${percentage}%` }}
        ></div>

        {/* Slider input (invisible but functional) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        {/* Thumb indicator */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 ${colors.bg} rounded-full border-2 border-white shadow-lg ${colors.glow} transition-all duration-150 pointer-events-none`}
          style={{ left: `calc(${percentage}% - 10px)` }}
        >
          <div className="absolute inset-1 bg-white rounded-full"></div>
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-[12px] text-gray-400 font-medium">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      {description && (
        <p className="text-[12px] text-gray-400 leading-relaxed">{description}</p>
      )}
    </div>
  );
};

// Futuristic Toggle Switch with animations
export const FuturisticToggle = ({
  label,
  description,
  checked,
  onChange,
  color = 'cyan',
  warning = false
}) => {
  const colorClasses = {
    cyan: {
      active: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      glow: 'shadow-cyan-500/50',
      border: 'border-cyan-500/30'
    },
    purple: {
      active: 'bg-gradient-to-r from-purple-500 to-pink-500',
      glow: 'shadow-purple-500/50',
      border: 'border-purple-500/30'
    },
    green: {
      active: 'bg-gradient-to-r from-emerald-500 to-green-500',
      glow: 'shadow-emerald-500/50',
      border: 'border-emerald-500/30'
    },
    amber: {
      active: 'bg-gradient-to-r from-amber-500 to-orange-500',
      glow: 'shadow-amber-500/50',
      border: 'border-amber-500/30'
    }
  };

  const colors = colorClasses[color] || colorClasses.cyan;

  return (
    <div className={`group flex items-center justify-between p-4 rounded-xl transition-all duration-300
      ${warning
        ? 'bg-amber-500/10 border border-amber-500/30 hover:border-amber-500/50'
        : 'bg-gray-800/40 border border-gray-700/40 hover:border-cyan-500/30'
      }`}
    >
      <div>
        <p className="text-[15px] font-medium text-white">{label}</p>
        <p className={`text-[13px] ${warning ? 'text-amber-300/80' : 'text-gray-400'}`}>{description}</p>
      </div>

      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className={`
          w-14 h-7 bg-gray-700 rounded-full
          peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-500/20
          peer peer-checked:after:translate-x-7
          after:content-[''] after:absolute after:top-[3px] after:left-[3px]
          after:bg-gray-400 after:rounded-full after:h-[22px] after:w-[22px]
          after:transition-all after:duration-300 after:ease-out
          peer-checked:after:bg-white
          ${checked ? `${colors.active} shadow-lg ${colors.glow}` : ''}
          transition-all duration-300
          border border-gray-600/50 peer-checked:border-transparent
        `}></div>
      </label>
    </div>
  );
};

// Futuristic Input Field
export const FuturisticInput = ({
  label,
  description,
  value,
  onChange,
  placeholder,
  type = 'text'
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-[15px] font-medium text-white">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-xl px-4 py-3
          text-[15px] text-white placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
          transition-all duration-300"
      />
      {description && (
        <p className="text-[12px] text-gray-400">{description}</p>
      )}
    </div>
  );
};

// Futuristic Select Dropdown
export const FuturisticSelect = ({
  label,
  description,
  value,
  onChange,
  options
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-[15px] font-medium text-white">{label}</label>
      <select
        value={value}
        onChange={onChange}
        className="w-full bg-gray-700/50 border border-cyan-500/30 rounded-xl px-4 py-3
          text-[15px] text-white
          focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent
          transition-all duration-300 cursor-pointer"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {description && (
        <p className="text-[12px] text-gray-400">{description}</p>
      )}
    </div>
  );
};

// Futuristic Section Card
export const SettingsSection = ({
  title,
  description,
  icon,
  color = 'cyan',
  children
}) => {
  const colorClasses = {
    cyan: {
      border: 'border-cyan-500/20 hover:border-cyan-500/40',
      title: 'text-cyan-200',
      iconBg: 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20',
      iconText: 'text-cyan-400'
    },
    purple: {
      border: 'border-purple-500/20 hover:border-purple-500/40',
      title: 'text-purple-200',
      iconBg: 'bg-gradient-to-r from-purple-500/20 to-pink-500/20',
      iconText: 'text-purple-400'
    },
    green: {
      border: 'border-emerald-500/20 hover:border-emerald-500/40',
      title: 'text-emerald-200',
      iconBg: 'bg-gradient-to-r from-emerald-500/20 to-green-500/20',
      iconText: 'text-emerald-400'
    },
    amber: {
      border: 'border-amber-500/20 hover:border-amber-500/40',
      title: 'text-amber-200',
      iconBg: 'bg-gradient-to-r from-amber-500/20 to-orange-500/20',
      iconText: 'text-amber-400'
    }
  };

  const colors = colorClasses[color] || colorClasses.cyan;

  return (
    <div className={`bg-gray-800/30 backdrop-blur-lg rounded-2xl border ${colors.border}
      transition-all duration-300 shadow-xl overflow-hidden`}>
      {/* Header */}
      <div className="p-6 pb-4 border-b border-gray-700/30">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl ${colors.iconBg} flex items-center justify-center border border-gray-700/30`}>
            <span className={colors.iconText}>{icon}</span>
          </div>
          <div>
            <h2 className={`text-lg font-semibold ${colors.title}`}>{title}</h2>
            {description && (
              <p className="text-[13px] text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  );
};

// Futuristic Action Buttons
export const ActionButtons = ({
  onSave,
  onReset,
  isSaving,
  hasChanges
}) => (
  <div className="flex flex-col sm:flex-row gap-4 pt-4">
    <button
      onClick={onSave}
      disabled={isSaving || !hasChanges}
      className={`flex-1 py-3.5 px-6 rounded-xl font-medium text-[15px] transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-cyan-400/50
        flex items-center justify-center gap-2
        ${hasChanges
          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 cursor-pointer'
          : 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/30'
        }
        disabled:opacity-60`}
    >
      {isSaving ? (
        <>
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Saving...</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Save Changes</span>
        </>
      )}
    </button>

    <button
      onClick={onReset}
      disabled={isSaving}
      className="flex-1 py-3.5 px-6 rounded-xl font-medium text-[15px] text-gray-300
        bg-gray-700/50 border border-gray-600/30
        hover:bg-gray-600/50 hover:border-gray-500/50 hover:text-white
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-gray-500/30
        disabled:opacity-50 cursor-pointer"
    >
      Reset to Defaults
    </button>
  </div>
);

// Info Box Component
export const InfoBox = ({ title, message, color = 'blue' }) => {
  const colorClasses = {
    blue: {
      bg: 'bg-cyan-500/5',
      border: 'border-cyan-500/20',
      icon: 'text-cyan-400',
      title: 'text-cyan-300',
      text: 'text-cyan-200/80'
    },
    amber: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      icon: 'text-amber-400',
      title: 'text-amber-300',
      text: 'text-amber-200/80'
    }
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl p-4 mt-6`}>
      <div className="flex items-start gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${colors.icon} mt-0.5 flex-shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className={`text-[14px] font-medium ${colors.title}`}>{title}</p>
          <p className={`text-[13px] ${colors.text} mt-1 leading-relaxed`}>{message}</p>
        </div>
      </div>
    </div>
  );
};

// Page Header Component
export const SettingsHeader = ({ title, subtitle, hasChanges }) => (
  <div className="mb-8">
    <h1 className="text-3xl md:text-[44px] font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
      {title}
    </h1>
    <p className="text-[15px] text-purple-200/90">{subtitle}</p>
    {hasChanges && (
      <div className="flex items-center gap-2 mt-3">
        <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
        <p className="text-amber-400 text-[13px] font-medium">You have unsaved changes</p>
      </div>
    )}
  </div>
);

// Icons for sections
export const Icons = {
  cursor: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  click: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
    </svg>
  ),
  gesture: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  ),
  display: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  settings: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    </svg>
  ),
  users: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
};
