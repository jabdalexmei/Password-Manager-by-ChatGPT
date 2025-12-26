import React from 'react';

type DialogProps = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
};

type DialogSlotProps = React.HTMLAttributes<HTMLDivElement>;

type DialogTitleProps = React.HTMLAttributes<HTMLHeadingElement>;

const mergeClasses = (base: string, extra?: string) => (extra ? `${base} ${extra}` : base);

export function Dialog({ open, children }: DialogProps) {
  if (!open) return null;
  return <div className="dialog-backdrop">{children}</div>;
}

export function DialogContent({ className, ...props }: DialogSlotProps) {
  return <div className={mergeClasses('dialog', className)} role="dialog" aria-modal="true" {...props} />;
}

export function DialogHeader({ className, ...props }: DialogSlotProps) {
  return <div className={mergeClasses('dialog-header', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: DialogTitleProps) {
  return <h2 className={mergeClasses('dialog-title', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: DialogSlotProps) {
  return <div className={mergeClasses('dialog-footer', className)} {...props} />;
}
