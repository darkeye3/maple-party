import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '보스컷 랩 | 비숍 헥사환산 배율 계산기',
  description: '닉네임과 헥사환산으로 메이플스토리 비숍의 보스별 효율컷을 계산합니다.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
