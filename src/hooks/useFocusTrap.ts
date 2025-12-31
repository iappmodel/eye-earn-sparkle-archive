import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for trapping focus within a container element
 * Implements WCAG 2.4.3 Focus Order for modal dialogs
 */
export function useFocusTrap(isActive: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    
    const focusableSelectors = [
      'button:not([disabled]):not([aria-hidden="true"])',
      'a[href]:not([aria-hidden="true"])',
      'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
      'select:not([disabled]):not([aria-hidden="true"])',
      'textarea:not([disabled]):not([aria-hidden="true"])',
      '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])',
      '[contenteditable="true"]:not([aria-hidden="true"])',
    ].join(', ');
    
    return Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => {
      // Check visibility
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift + Tab
      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isActive, getFocusableElements]
  );

  // Handle Escape key to close modals
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive || event.key !== 'Escape') return;
      // Dispatch custom event for parent components to handle
      containerRef.current?.dispatchEvent(
        new CustomEvent('focustrap:escape', { bubbles: true })
      );
    },
    [isActive]
  );

  useEffect(() => {
    if (!isActive) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement;

    // Focus the first focusable element or the container
    const focusableElements = getFocusableElements();
    if (focusableElements.length > 0) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        focusableElements[0].focus();
      });
    } else if (containerRef.current) {
      containerRef.current.focus();
    }

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);

      // Restore focus to the previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, handleKeyDown, handleEscape, getFocusableElements]);

  return { containerRef, getFocusableElements };
}

/**
 * Hook for managing focus on route changes
 */
export function useFocusOnMount(shouldFocus: boolean = true) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (shouldFocus && ref.current) {
      // Announce to screen readers
      ref.current.setAttribute('tabindex', '-1');
      ref.current.focus({ preventScroll: true });
    }
  }, [shouldFocus]);

  return ref;
}
