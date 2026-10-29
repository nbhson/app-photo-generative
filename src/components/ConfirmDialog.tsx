import { Modal } from './Overlays';
import { Icon } from './icons';

/**
 * In-app replacement cho window.confirm — dùng chung Modal shell
 * (Escape + backdrop click + focus trap). Confirm button danger-styled;
 * đánh dấu `data-autofocus` để Modal focus vào mặc định.
 */
export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: {
  open: boolean; title: string; message: string;
  confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal width="w-[min(400px,94vw)]" labelledBy="confirm-title" onClose={onCancel}>
      <div className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 grid place-items-center shrink-0" aria-hidden="true">
            <Icon name="alert" size={16} className="text-red-300" />
          </div>
          <div>
            <h2 id="confirm-title" className="font-semibold text-[14px]">{title}</h2>
            <p className="text-[13px] text-white/55 mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onConfirm} data-autofocus
            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
            {confirmLabel}
          </button>
          <button onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
            {cancelLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
