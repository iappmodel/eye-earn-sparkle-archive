import { useState, useCallback, useMemo } from 'react';
import { z } from 'zod';
import {
  sanitizeText,
  sanitizeEmail,
  sanitizeUsername,
  sanitizePhone,
  sanitizeUrl,
  sanitizeSearchQuery,
  sanitizeHashtag,
  containsXss,
} from '@/lib/sanitize';

type SanitizerType = 
  | 'text'
  | 'email'
  | 'username'
  | 'phone'
  | 'url'
  | 'search'
  | 'hashtag'
  | 'none';

interface UseSanitizedInputOptions {
  type?: SanitizerType;
  maxLength?: number;
  required?: boolean;
  customSchema?: z.ZodType<string>;
  rejectXss?: boolean;
}

interface UseSanitizedInputResult {
  value: string;
  sanitizedValue: string;
  error: string | null;
  isValid: boolean;
  isDirty: boolean;
  handleChange: (value: string) => void;
  handleBlur: () => void;
  reset: () => void;
  validate: () => boolean;
}

/**
 * Hook for sanitized and validated form inputs
 */
export function useSanitizedInput(
  initialValue = '',
  options: UseSanitizedInputOptions = {}
): UseSanitizedInputResult {
  const {
    type = 'text',
    maxLength = 1000,
    required = false,
    customSchema,
    rejectXss = true,
  } = options;

  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [touched, setTouched] = useState(false);

  // Get the appropriate sanitizer
  const sanitizer = useMemo(() => {
    switch (type) {
      case 'email':
        return sanitizeEmail;
      case 'username':
        return sanitizeUsername;
      case 'phone':
        return sanitizePhone;
      case 'url':
        return sanitizeUrl;
      case 'search':
        return sanitizeSearchQuery;
      case 'hashtag':
        return sanitizeHashtag;
      case 'none':
        return (s: string) => s;
      default:
        return sanitizeText;
    }
  }, [type]);

  // Get the validation schema
  const schema = useMemo(() => {
    if (customSchema) return customSchema;

    let baseSchema = z.string();

    if (maxLength > 0) {
      baseSchema = baseSchema.max(maxLength, `Maximum ${maxLength} characters allowed`);
    }

    if (required) {
      baseSchema = baseSchema.min(1, 'This field is required');
    }

    switch (type) {
      case 'email':
        return baseSchema.email('Please enter a valid email address');
      case 'url':
        return baseSchema.url('Please enter a valid URL').or(z.literal(''));
      case 'phone':
        return baseSchema.regex(/^\+?[\d\s-]{7,15}$/, 'Please enter a valid phone number').or(z.literal(''));
      case 'username':
        return baseSchema
          .regex(/^[a-z0-9_.]+$/, 'Only lowercase letters, numbers, underscores, and periods allowed')
          .min(3, 'Username must be at least 3 characters');
      default:
        return baseSchema;
    }
  }, [type, maxLength, required, customSchema]);

  // Sanitized value
  const sanitizedValue = useMemo(() => {
    const sanitized = sanitizer(value);
    return maxLength > 0 ? sanitized.slice(0, maxLength) : sanitized;
  }, [value, sanitizer, maxLength]);

  // Validate input
  const validateInput = useCallback((val: string): string | null => {
    // Check for XSS
    if (rejectXss && containsXss(val)) {
      return 'Invalid characters detected';
    }

    // Validate against schema
    const result = schema.safeParse(val);
    if (!result.success) {
      return result.error.errors[0]?.message || 'Invalid input';
    }

    return null;
  }, [schema, rejectXss]);

  // Check if currently valid
  const isValid = useMemo(() => {
    if (!touched && !required) return true;
    return validateInput(sanitizedValue) === null;
  }, [sanitizedValue, touched, required, validateInput]);

  // Handle value change
  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    setIsDirty(true);
    
    // Clear error on change if it was valid
    if (error) {
      const validationError = validateInput(sanitizer(newValue));
      if (!validationError) {
        setError(null);
      }
    }
  }, [error, validateInput, sanitizer]);

  // Handle blur - validate on blur
  const handleBlur = useCallback(() => {
    setTouched(true);
    const validationError = validateInput(sanitizedValue);
    setError(validationError);
  }, [sanitizedValue, validateInput]);

  // Manual validation
  const validate = useCallback(() => {
    setTouched(true);
    const validationError = validateInput(sanitizedValue);
    setError(validationError);
    return validationError === null;
  }, [sanitizedValue, validateInput]);

  // Reset input
  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
    setIsDirty(false);
    setTouched(false);
  }, [initialValue]);

  return {
    value,
    sanitizedValue,
    error,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    reset,
    validate,
  };
}

/**
 * Hook for sanitized form with multiple fields
 */
export function useSanitizedForm<T extends Record<string, UseSanitizedInputOptions>>(
  fields: T,
  initialValues: Partial<Record<keyof T, string>> = {}
): {
  values: Record<keyof T, string>;
  sanitizedValues: Record<keyof T, string>;
  errors: Record<keyof T, string | null>;
  isValid: boolean;
  isDirty: boolean;
  handleChange: (field: keyof T, value: string) => void;
  handleBlur: (field: keyof T) => void;
  validate: () => boolean;
  reset: () => void;
} {
  const inputs = Object.entries(fields).reduce((acc, [key, options]) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    acc[key as keyof T] = useSanitizedInput(initialValues[key as keyof T] || '', options as UseSanitizedInputOptions);
    return acc;
  }, {} as Record<keyof T, UseSanitizedInputResult>);

  const values = Object.entries(inputs).reduce((acc, [key, input]) => {
    acc[key as keyof T] = input.value;
    return acc;
  }, {} as Record<keyof T, string>);

  const sanitizedValues = Object.entries(inputs).reduce((acc, [key, input]) => {
    acc[key as keyof T] = input.sanitizedValue;
    return acc;
  }, {} as Record<keyof T, string>);

  const errors = Object.entries(inputs).reduce((acc, [key, input]) => {
    acc[key as keyof T] = input.error;
    return acc;
  }, {} as Record<keyof T, string | null>);

  const isValid = Object.values(inputs).every(input => input.isValid);
  const isDirty = Object.values(inputs).some(input => input.isDirty);

  const handleChange = useCallback((field: keyof T, value: string) => {
    inputs[field].handleChange(value);
  }, [inputs]);

  const handleBlur = useCallback((field: keyof T) => {
    inputs[field].handleBlur();
  }, [inputs]);

  const validate = useCallback(() => {
    return Object.values(inputs).every(input => input.validate());
  }, [inputs]);

  const reset = useCallback(() => {
    Object.values(inputs).forEach(input => input.reset());
  }, [inputs]);

  return {
    values,
    sanitizedValues,
    errors,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    validate,
    reset,
  };
}

export default useSanitizedInput;
