'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface DropdownMenuProps {
  trigger: ReactNode
  items: DropdownItem[]
  align?: 'left' | 'right'
}

interface DropdownItem {
  label: string
  onClick: () => void
  variant?: 'default' | 'destructive'
  icon?: ReactNode
  disabled?: boolean
}

interface MenuPosition {
  top: number
  left?: number
  right?: number
}

export function DropdownMenu({ trigger, items, align = 'right' }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef<HTMLSpanElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const focusTrigger = useCallback(() => {
    const triggerEl = triggerRef.current?.querySelector<HTMLElement>('button, [tabindex="0"]')
    triggerEl?.focus()
  }, [])

  const closeMenu = useCallback(
    (refocusTrigger = true) => {
      setIsOpen(false)
      setActiveIndex(-1)
      if (refocusTrigger) focusTrigger()
    },
    [focusTrigger]
  )

  const focusItem = (index: number) => {
    setActiveIndex(index)
    itemRefs.current[index]?.focus()
  }

  const updatePosition = () => {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const MENU_OFFSET = 6
    setPosition({
      top: Math.min(rect.bottom + MENU_OFFSET, window.innerHeight - 8),
      ...(align === 'right'
        ? { right: Math.max(window.innerWidth - rect.right, 8) }
        : { left: Math.max(rect.left, 8) }),
    })
  }

  // Open toggle: any click/keyboard-activated click on the trigger bubbles here.
  const handleTriggerClick = () => {
    if (!isOpen) updatePosition()
    setIsOpen(!isOpen)
    if (isOpen) setActiveIndex(-1)
  }

  // Move focus into the menu once it has rendered (APG menu button).
  useEffect(() => {
    if (!isOpen) return
    const firstEnabled = items.findIndex((item) => !item.disabled)
    if (firstEnabled >= 0) focusItem(firstEnabled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // Expose menu-button state on the actual focusable trigger element.
  useEffect(() => {
    const triggerEl = triggerRef.current?.querySelector<HTMLElement>('button, [role="button"]')
    if (triggerEl) {
      triggerEl.setAttribute('aria-haspopup', 'menu')
      triggerEl.setAttribute('aria-expanded', String(isOpen))
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }

    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        e.stopPropagation()
        closeMenu()
      }
    }

    function handleViewportChange() {
      setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      // Repositioning on scroll is handled by closing: simplest stable behavior.
      window.addEventListener('resize', handleViewportChange)
      window.addEventListener('scroll', handleViewportChange, true)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [isOpen, closeMenu])

  const enabledIndexes = items
    .map((item, index) => (item.disabled ? -1 : index))
    .filter((index) => index >= 0)

  const handleMenuKeyDown = (e: ReactKeyboardEvent) => {
    if (enabledIndexes.length === 0) return
    const activePos = enabledIndexes.indexOf(activeIndex)
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        focusItem(
          activePos < 0 ? enabledIndexes[0] : enabledIndexes[(activePos + 1) % enabledIndexes.length]
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        focusItem(
          activePos < 0
            ? enabledIndexes[enabledIndexes.length - 1]
            : enabledIndexes[(activePos - 1 + enabledIndexes.length) % enabledIndexes.length]
        )
        break
      case 'Home':
        e.preventDefault()
        focusItem(enabledIndexes[0])
        break
      case 'End':
        e.preventDefault()
        focusItem(enabledIndexes[enabledIndexes.length - 1])
        break
      case 'Tab':
        e.preventDefault()
        closeMenu()
        break
    }
  }

  const handleItemClick = (onClick: () => void) => {
    onClick()
    closeMenu()
  }

  const menuContent = isOpen && position ? (
    <div
      ref={menuRef}
      style={{ top: position.top, left: position.left, right: position.right }}
      className="fixed z-50 min-w-[176px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg animate-fade-in dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40"
      role="menu"
      aria-orientation="vertical"
      onKeyDown={handleMenuKeyDown}
    >
      {items.map((item, index) => (
        <button
          key={index}
          ref={(el) => {
            itemRefs.current[index] = el
          }}
          type="button"
          onClick={() => handleItemClick(item.onClick)}
          disabled={item.disabled}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
            item.variant === 'destructive'
              ? 'text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:focus:bg-red-950/40'
              : 'text-gray-700 hover:bg-gray-50 focus:bg-gray-50 focus:text-gray-900 dark:text-gray-200 dark:hover:bg-slate-800 dark:focus:bg-slate-800 dark:focus:text-gray-100'
          } ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} focus:outline-none`}
          role="menuitem"
          tabIndex={-1}
        >
          {item.icon && <span className="flex-shrink-0 w-4 h-4" aria-hidden="true">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <>
      <span ref={triggerRef} onClick={handleTriggerClick} className="inline-flex">
        {trigger}
      </span>
      {typeof window !== 'undefined' && createPortal(menuContent, document.body)}
    </>
  )
}
