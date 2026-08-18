import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useOfficialPhoto } from '@/contexts/OfficialPhotosContext';
import { officialPhotoSrc } from '@/services/officialPhotosService';
import { AvatarService } from '@/services/avatarService';

interface UserAvatarProps {
  name?: string;
  userId?: string | null;
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
  userId,
  avatarUrl,
  className = '',
  fallbackClassName = 'bg-[#F69F19]/20 text-[#2C2D2F]',
  size = 'md',
}) => {
  const official = useOfficialPhoto(userId);
  const officialSrc = officialPhotoSrc(official);
  const fallbackSrc = AvatarService.isValidAvatarUrl(avatarUrl) ? avatarUrl! : undefined;
  const src = officialSrc ?? fallbackSrc;

  const initials = name
    ? name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?'
    : '?';

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {src && <AvatarImage src={src} alt={name} className="object-cover object-center" />}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
};

export default UserAvatar;
