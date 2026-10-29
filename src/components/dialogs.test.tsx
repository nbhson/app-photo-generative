// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Modal } from './Overlays';
import { ConfirmDialog } from './ConfirmDialog';

// Pure dialog components — không cần mock canvas/Konva.
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('ConfirmDialog', () => {
  const base = {
    open: true,
    title: 'Start a new project?',
    message: 'Unsaved changes will be lost.',
    confirmLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog {...base} open={false} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders title, message and both actions', () => {
    render(<ConfirmDialog {...base} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Start a new project?')).toBeTruthy();
    expect(screen.getByText('Unsaved changes will be lost.')).toBeTruthy();
    expect(screen.getByText('Discard changes')).toBeTruthy();
    expect(screen.getByText('Keep editing')).toBeTruthy();
  });

  it('confirm button is danger-styled (red) and auto-focused', () => {
    render(<ConfirmDialog {...base} />);
    const confirm = screen.getByText('Discard changes');
    expect(confirm.className).toContain('bg-red-600');
    expect(document.activeElement).toBe(confirm);
  });

  it('calls onConfirm / onCancel from the respective buttons', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);
    screen.getByText('Discard changes').click();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    screen.getByText('Keep editing').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape triggers onCancel (via Modal shell)', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onCancel={onCancel} />);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('backdrop click triggers onCancel; clicks inside do not', () => {
    const onCancel = vi.fn();
    const { container } = render(<ConfirmDialog {...base} onCancel={onCancel} />);
    const backdrop = container.querySelector('[role="dialog"]')!;
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    screen.getByText('Unsaved changes will be lost.').click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('Modal shell', () => {
  it('exposes dialog semantics with aria-modal', () => {
    render(<Modal width="w-40" onClose={vi.fn()}><p>body</p></Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('focuses the [data-autofocus] element on mount when present', () => {
    render(
      <Modal width="w-40" onClose={vi.fn()}>
        <button>first</button>
        <button data-autofocus>primary</button>
      </Modal>,
    );
    expect(document.activeElement?.textContent).toBe('primary');
  });

  it('focuses the dialog container when no autofocus target exists', () => {
    render(<Modal width="w-40" onClose={vi.fn()}><p>plain</p></Modal>);
    const box = screen.getByRole('dialog').firstElementChild as HTMLElement;
    expect(box.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(box);
  });

  it('Tab wraps focus inside the dialog (focus trap)', () => {
    render(
      <Modal width="w-40" onClose={vi.fn()}>
        <button>one</button>
        <button>two</button>
      </Modal>,
    );
    const [first, last] = screen.getAllByRole('button');
    (last as HTMLElement).focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first); // wrapped forward to first
    (first as HTMLElement).focus();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(last); // shift+tab wraps back to last
  });

  it('calls onClose on Escape and on backdrop click', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal width="w-40" onClose={onClose}><p>x</p></Modal>);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    (container.firstElementChild as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
