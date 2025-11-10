// Serviço de toast simples usando o estado global ou contexto React

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

let toastCallbacks = {
  success: (message: string, action?: ToastAction) => console.log('Success:', message),
  error: (message: string, action?: ToastAction) => console.error('Error:', message),
  info: (message: string, action?: ToastAction) => console.info('Info:', message),
  warning: (message: string, action?: ToastAction) => console.warn('Warning:', message),
  dismiss: () => {}
};

export const registerToastHandlers = (handlers: {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string, action?: ToastAction) => void;
  info: (message: string, action?: ToastAction) => void;
  warning: (message: string, action?: ToastAction) => void;
  dismiss: () => void;
}) => {
  toastCallbacks = handlers;
};

export const toast = {
  success: (message: string, action?: ToastAction) => toastCallbacks.success(message, action),
  error: (message: string, action?: ToastAction) => toastCallbacks.error(message, action),
  info: (message: string, action?: ToastAction) => toastCallbacks.info(message, action),
  warning: (message: string, action?: ToastAction) => toastCallbacks.warning(message, action),
  dismiss: () => toastCallbacks.dismiss()
};