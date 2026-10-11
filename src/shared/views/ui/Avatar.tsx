'use client'

import { FC } from 'react'

const AVATAR_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-amber-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-orange-500',
  'bg-teal-500',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface AvatarProps {
  name: string | null | undefined
  email: string
  /** Optional image (data-URL or remote URL). Falls back to initials when absent. */
  src?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
}

export const Avatar: FC<AvatarProps> = ({ name, email, src, size = 'md', className = '' }) => {
  const displayName = name?.trim() || email

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are small data-URLs; next/image adds no value here
      <img
        src={src}
        alt={displayName}
        className={`inline-flex shrink-0 rounded-full object-cover ${sizeClasses[size]} ${className}`}
      />
    )
  }

  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colorIndex = hashString(email) % AVATAR_COLORS.length
  const bgColor = AVATAR_COLORS[colorIndex]

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full font-medium text-white ${sizeClasses[size]} ${bgColor} ${className}`}
      aria-label={displayName}
    >
      {initials}
    </div>
  )
}