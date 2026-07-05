import { useEffect, useRef } from 'react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  confirmLoading = false,
}) {
  const onConfirmRef = useRef(onConfirm);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onConfirmRef.current = onConfirm;
    onCancelRef.current = onCancel;
  }, [onConfirm, onCancel]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(e) {
      if (e.key === 'Enter' && !confirmLoading) {
        e.preventDefault();
        onConfirmRef.current?.();
      }
      if (e.key === 'Escape' && !confirmLoading) {
        e.preventDefault();
        onCancelRef.current?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmLoading]);

  if (!open) return null;

  const variantStyles = {
    danger: {
      button: 'bg-red-600 hover:bg-red-700 text-white',
      icon: '⚠️',
    },
    warning: {
      button: 'bg-amber-600 hover:bg-amber-700 text-white',
      icon: '⚠️',
    },
    info: {
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      icon: 'ℹ️',
    },
  };

  const styles = variantStyles[variant] || variantStyles.danger;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50"
        onClick={confirmLoading ? undefined : onCancel}
      />
      <div className="relative bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 text-3xl">{styles.icon}</div>
          <div className="flex-1">
            {title && (
              <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
            )}
            <p className="text-sm text-slate-600 whitespace-pre-line">{message}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={confirmLoading}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmLoading}
            className={`px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-80 disabled:cursor-not-allowed ${styles.button}`}
          >
            {confirmLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                {confirmText}…
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
