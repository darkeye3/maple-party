import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://boss-cut-lab.godnox3.chatgpt.site'),
  title: 'MapleParty | 보스 배율 기반 파티 모집',
  description: '공식 캐릭터 정보로 비숍의 보스 배율을 확인하고, 최소 배율과 출발 시간이 맞는 메이플스토리 보스 파티를 모집합니다.',
  openGraph: {
    title: 'MapleParty | 보스 배율 기반 파티 모집',
    description: '내 보스 배율을 확인하고 조건이 맞는 메이플스토리 보스 파티를 만들거나 참가하세요.',
    type: 'website',
    images: [{ url: '/og.png', alt: 'MapleParty 보스 파티 모집' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MapleParty | 보스 배율 기반 파티 모집',
    description: '내 보스 배율을 확인하고 조건이 맞는 메이플스토리 보스 파티를 만들거나 참가하세요.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
