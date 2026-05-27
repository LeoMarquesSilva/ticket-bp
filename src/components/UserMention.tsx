import React from 'react';
import UserAvatar from '@/components/UserAvatar';
import { cn } from '@/lib/utils';

interface UserMentionProps {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string;
  size?: 'sm' | 'md';
  className?: string;
  nameClassName?: string;
}

const UserMention: React.FC<UserMentionProps> = ({
  name,
  avatarUrl,
  subtitle,
  size = 'sm',
  className,
  nameClassName,
}) => (
  <span className={cn('inline-flex items-center gap-2 min-w-0', className)}>
    <UserAvatar name={name} avatarUrl={avatarUrl} size={size} className="shrink-0" />
    <span className="min-w-0 flex flex-col">
      <span className={cn('truncate text-sm leading-tight', nameClassName)}>{name}</span>
      {subtitle ? <span className="truncate text-xs text-slate-500">{subtitle}</span> : null}
    </span>
  </span>
);

export default UserMention;
