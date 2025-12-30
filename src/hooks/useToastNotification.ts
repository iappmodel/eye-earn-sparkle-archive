import { toast as sonnerToast } from 'sonner';
import { useHapticFeedback } from './useHapticFeedback';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  haptic?: boolean;
}

export const useToastNotification = () => {
  const { light, medium, success: hapticSuccess, error: hapticError } = useHapticFeedback();

  const showToast = (type: ToastType, message: string, options?: ToastOptions) => {
    const { description, duration = 4000, action, haptic = true } = options || {};

    // Trigger haptic feedback
    if (haptic) {
      switch (type) {
        case 'success':
          hapticSuccess();
          break;
        case 'error':
          hapticError();
          break;
        case 'warning':
          medium();
          break;
        default:
          light();
      }
    }

    const toastOptions: any = {
      description,
      duration: type === 'loading' ? Infinity : duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
    };

    switch (type) {
      case 'success':
        return sonnerToast.success(message, toastOptions);
      case 'error':
        return sonnerToast.error(message, toastOptions);
      case 'warning':
        return sonnerToast.warning(message, toastOptions);
      case 'info':
        return sonnerToast.info(message, toastOptions);
      case 'loading':
        return sonnerToast.loading(message, toastOptions);
      default:
        return sonnerToast(message, toastOptions);
    }
  };

  return {
    success: (message: string, options?: ToastOptions) => showToast('success', message, options),
    error: (message: string, options?: ToastOptions) => showToast('error', message, options),
    warning: (message: string, options?: ToastOptions) => showToast('warning', message, options),
    info: (message: string, options?: ToastOptions) => showToast('info', message, options),
    loading: (message: string, options?: ToastOptions) => showToast('loading', message, options),
    dismiss: sonnerToast.dismiss,
    promise: <T,>(
      promise: Promise<T>,
      messages: { loading: string; success: string; error: string }
    ) => {
      return sonnerToast.promise(promise, {
        loading: messages.loading,
        success: messages.success,
        error: messages.error,
      });
    },
  };
};

export default useToastNotification;
