import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://boss-cut-lab.godnox3.chatgpt.site'),
  title: '보스컷 랩 | 비숍 현대 헥사환산 계산기',
  description: '공식 캐릭터 정보와 300·380 방어율 독립 곡선으로 메이플스토리 비숍의 보스별 효율컷을 계산합니다.',
  openGraph: {
    title: '보스컷 랩 | 비숍 현대 헥사환산 계산기',
    description: '공식 캐릭터 정보와 300·380 방어율 독립 곡선으로 메이플스토리 비숍의 보스별 효율컷을 계산합니다.',
    type: 'website',
    images: [{ url: '/og.png', alt: '보스컷 랩 비숍 헥사환산 계산기' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '보스컷 랩 | 비숍 현대 헥사환산 계산기',
    description: '공식 캐릭터 정보와 300·380 방어율 독립 곡선으로 메이플스토리 비숍의 보스별 효율컷을 계산합니다.',
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
