import { BookOpen, Compass, Flame, Gem, Mountain, Rocket, Star, Sun } from 'lucide-react';

export const PROFILE_AVATARS = [
  { id: 'compass', label: '探索者', Icon: Compass },
  { id: 'book', label: '学者', Icon: BookOpen },
  { id: 'flame', label: '火焰', Icon: Flame },
  { id: 'mountain', label: '山峰', Icon: Mountain },
  { id: 'star', label: '星光', Icon: Star },
  { id: 'rocket', label: '火箭', Icon: Rocket },
  { id: 'gem', label: '宝石', Icon: Gem },
  { id: 'sun', label: '太阳', Icon: Sun },
];

export function ProfileAvatar({ avatar, size = 'medium' }) {
  const selected = PROFILE_AVATARS.find((item) => item.id === avatar) ?? PROFILE_AVATARS[0];
  const Icon = selected.Icon;
  return (
    <span className={`profile-avatar profile-avatar-${selected.id} profile-avatar-${size}`} aria-hidden="true">
      <Icon />
    </span>
  );
}
