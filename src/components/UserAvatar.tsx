import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarService } from '@/services/avatarService';

interface UserAvatarProps {
  name?: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-12 w-12 text-base',
};

const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  className = '',
  fallbackClassName = 'bg-[#F69F19]/20 text-[#2C2D2F]',
  size = 'md',
}) => {
  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    : '?';

  const hasValidAvatar = AvatarService.isValidAvatarUrl(avatarUrl);

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {hasValidAvatar && <AvatarImage src={avatarUrl!} alt={name} />}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
