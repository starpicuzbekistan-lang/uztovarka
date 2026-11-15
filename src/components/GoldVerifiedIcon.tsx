import { BadgeCheck } from 'lucide-react';
/** Kichik oltin tasdiqlash belgisi. Faqat Gold Verified shartlari bajarilganda chiqariladi. */
export default function GoldVerifiedIcon({ size = 18 }: { size?: number }) {
  return <BadgeCheck aria-label="Gold Verified" role="img" size={size} strokeWidth={2.7}
    className="inline-block shrink-0 text-amber-600" fill="#F5BA20" stroke="#FFFFFF" />;
}
