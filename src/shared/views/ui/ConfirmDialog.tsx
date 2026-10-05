'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'primary'
  children?: ReactNode
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'destructive',
  children,
}: ConfirmDialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
      // Focus the cancel button by default (safer)
      setTimeout(() => {
        const cancelBtn = contentRef.current?.querySelector<HTMLButtonElement>('[data-cancel]')
        cancelBtn?.focus()
      }, 0)

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          onClose()
        }
        if (e.key === 'Tab') {
          // Trap focus within the dialog
          const focusableElements = contentRef.current?.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
          if (focusableElements && focusableElements.length > 0) {
            const firstElement = focusableElements[0]
            const lastElement = focusableElements[focusableElements.length - 1]
            if (e.shiftKey && document.activeElement === firstElement) {
              e.preventDefault()
              lastElement.focus()
            } else if (!e.shiftKey && document.activeElement === lastElement) {
              e.preventDefault()
              firstElement.focus()
            }
          }
        }
      }
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = ''
        previousActiveElement.current?.focus()
      }
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const confirmButtonClass = variant === 'destructive' ? 'ui-btn-danger' : 'ui-btn-primary'

  const dialogContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in dark:bg-black/60"
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      <div
        ref={contentRef}
        className="ui-modal max-w-md animate-slide-up"
      >
        <h2 id="confirm-dialog-title" className="ui-title text-lg">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="ui-muted mt-2 text-sm">
          {description}
        </p>
        {children}
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            data-cancel
            onClick={onClose}
            className="ui-btn ui-btn-secondary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`ui-btn ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof window === 'undefined') return null
  return createPortal(dialogContent, document.body)
}