import { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Provider } from '../types';

export interface ApiKeyValidatorProps {
  provider: Provider;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

type ValidationState = 'idle' | 'validating' | 'valid' | 'invalid';

export function ApiKeyValidator({ provider, value, onChange, disabled = false, placeholder }: ApiKeyValidatorProps) {
  const [showKey, setShowKey] = useState(false);
  const [validationState, setValidationState] = useState<ValidationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const debounceTimerRef = useRef<number | null>(null);
  const lastValidatedValueRef = useRef<string>('');

  // Debounced validation effect
  useEffect(() => {
    // Don't validate if disabled, empty, or value hasn't changed
    if (disabled || !value || value === lastValidatedValueRef.current) {
      return;
    }

    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set validating state immediately for better UX
    setValidationState('validating');
    setErrorMessage('');

    // Start new debounce timer
    debounceTimerRef.current = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/settings/validate-api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, api_key: value }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          setValidationState('invalid');
          setErrorMessage(errorText || 'Validation failed');
          lastValidatedValueRef.current = value;
          return;
        }

        const result = await response.json();
        if (result.valid) {
          setValidationState('valid');
          setErrorMessage('');
        } else {
          setValidationState('invalid');
          setErrorMessage(result.error || 'Invalid API key');
        }
        lastValidatedValueRef.current = value;
      } catch (error) {
        setValidationState('invalid');
        setErrorMessage('Failed to validate API key');
        lastValidatedValueRef.current = value;
      }
    }, 500); // 500ms debounce

    // Cleanup function
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, provider, disabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Reset validation state when user types
    if (newValue === '') {
      setValidationState('idle');
      setErrorMessage('');
      lastValidatedValueRef.current = '';
    } else if (newValue !== lastValidatedValueRef.current) {
      setValidationState('validating');
      setErrorMessage('');
    }
  };

  const getValidationIcon = () => {
    switch (validationState) {
      case 'validating':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'invalid':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getInputBorderColor = () => {
    switch (validationState) {
      case 'valid':
        return 'border-green-500 focus:border-green-500 focus:ring-green-500';
      case 'invalid':
        return 'border-red-500 focus:border-red-500 focus:ring-red-500';
      default:
        return 'border-slate-700 focus:border-[#a078f7] focus:ring-[#a078f7]';
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          placeholder={placeholder || `Enter ${provider === 'openai' ? 'sk-' : provider === 'google' ? 'AIza' : ''}...`}
          disabled={disabled}
          className={cn(
            'w-full bg-[#161022] rounded-lg text-sm text-white px-3 py-2 pr-20 transition-colors',
            getInputBorderColor(),
            disabled && 'bg-[#161022]/50 text-slate-400 cursor-not-allowed'
          )}
        />

        {/* Right side icons */}
        <div className="absolute right-3 top-2 flex items-center gap-2">
          {/* Validation icon */}
          {!disabled && value && getValidationIcon()}

          {/* Eye/lock icon */}
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-slate-400 hover:text-white"
            disabled={disabled}
          >
            {disabled ? (
              <span className="material-symbols-outlined text-lg">lock</span>
            ) : showKey ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {validationState === 'invalid' && errorMessage && (
        <div className="text-xs text-red-400 flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          {errorMessage}
        </div>
      )}

      {/* Success message */}
      {validationState === 'valid' && (
        <div className="text-xs text-green-400 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          API key validated successfully
        </div>
      )}
    </div>
  );
}
