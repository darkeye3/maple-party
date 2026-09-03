import type { Metadata } from 'next';
import { ArrowLeft, BrainCircuit, CheckCircle2, Database, FileCode2, Gauge, GitBranch, Layers3, PlayCircle, ShieldCheck, Sparkles, TestTubeDiagonal, UsersRound, Workflow } from 'lucide-react';

export const metadata: Metadata = {
  title: 'MapleParty 게임 프로그래머 포트폴리오',
  description: '메이플스토리 보스 배율 계산과 파티 매칭을 구현한 게임 시스템 포트폴리오 케이스 스터디입니다.',
  openGraph: {
    title: 'MapleParty 게임 프로그래머 포트폴리오',
    description: '스프레드시트 역분석, 전투 배율 모델링, 공식 API 연동, 파티 매칭 검증을 하나의 서비스로 구현한 사례입니다.',
    images: [{ url: '/og.png', alt: 'MapleParty 포트폴리오' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MapleParty 게임 프로그래머 포트폴리오',
    description: '게임 데이터 모델링과 파티 매칭 시스템 구현 케이스 스터디.',
    images: ['/og.png'],
  },
};

const stats = [
  { value: '33', label: '분석 시트', detail: '환산식 원본 구조 분해' },
  { value: '14,476', label: '수식 셀', detail: '계산 의존성 추적' },
  { value: '810', label: '프리셋 조합', detail: '최고 실전딜 조건 탐색' },
  { value: '31', label: '보스 정의', detail: '난이도와 포스 보정 반영' },
] as const;

const bossImages = [
  { src: '/boss-selector-icons/kalos.png', alt: '감시자 칼로스' },
  { src: '/boss-selector-icons/kaling.png', alt: '카링' },
  { src: '/boss-selector-icons/seren.png', alt: '선택받은 세렌' },
  { src: '/boss-selector-icons/black-mage.png', alt: '검은 마법사' },
  { src: '/boss-selector-icons/jupiter.png', alt: '유피테르' },
] as const;

const problemFrames = [
  {
    icon: BrainCircuit,
    title: '암묵적 계산식을 시스템으로 번역',
    body: '공개 API가 아닌 스프레드시트와 실제 결과 화면을 근거로 보스컷, 방어율, 헥사환산, 카링 보정의 관계를 분리했습니다.',
  },
  {
    icon: Gauge,
    title: '전투력 수치를 플레이 의사결정으로 변환',
    body: '단순 딜량 표시가 아니라 불가능, 파티컷, 솔플컷처럼 유저가 바로 행동할 수 있는 상태값으로 결과를 가공했습니다.',
  },
  {
    icon: UsersRound,
    title: '파티 모집의 검증 흐름 설계',
    body: '파티장과 참가자의 닉네임, 헥사환산, 보스 배율, 역할 조건, 보상 약정을 서버에서 다시 검증하도록 구성했습니다.',
  },
] as const;

const implementation = [
  {
    icon: Layers3,
    title: 'Bishop Character Curve 2026.08 v4',
    body: '300/380 방어율 스플라인을 분리하고 캐릭터 스탯, 방무, 크확, 크뎀, HEXA 성장 상태를 곡률 보정으로 반영했습니다.',
  },
  {
    icon: Workflow,
    title: 'Preset Search Pipeline',
    body: '장비, 어빌리티, 하이퍼스탯, 링크, 유니온 프리셋을 최대 810개 조합으로 비교해 중복 계산 없이 최고 조건을 선택합니다.',
  },
  {
    icon: Database,
    title: 'D1 Party State',
    body: '파티, 멤버, 유저, 세션, 등록 캐릭터를 SQLite 스키마로 분리하고 모집 마감, 중복 가입, 출발 시간 제약을 서버에서 처리합니다.',
  },
  {
    icon: ShieldCheck,
    title: 'Verification First UX',
    body: 'NEXON Open API로 캐릭터 정보를 조회하고, API 키는 브라우저 세션에만 보관하는 방식으로 사용자 부담과 위험을 줄였습니다.',
  },
] as const;

const pipeline = [
  '원본 환산기 수식 분석',
  '공식 캐릭터 데이터 조회',
  '프리셋별 전투력 비교',
  '보스별 레벨/포스 보정',
  '파티 역할과 보상 약정 검증',
] as const;

const evidence = [
  {
    path: 'lib/model.ts',
    title: '전투 배율 계산 엔진',
    body: '스플라인 보간, 역보간, 방어율 상수, 카링 보정, 보스별 컷 판정을 하나의 순수 계산 모듈로 분리했습니다.',
  },
  {
    path: 'lib/server/party-service.ts',
    title: '파티 도메인 서비스',
    body: '생성, 가입, 탈퇴, 삭제, 약정 잠금, 정원 마감 처리를 도메인 규칙 중심으로 모았습니다.',
  },
  {
    path: 'db/schema.ts',
    title: '파티와 계정 상태 스키마',
    body: '공유 코드, 역할별 정원, 약정 버전, 사용자별 캐릭터 등록을 저장할 수 있도록 테이블과 인덱스를 설계했습니다.',
  },
  {
    path: 'work/formula_analysis.md',
    title: '스프레드시트 역분석 리포트',
    body: '108,732개 비어 있지 않은 셀과 3,061개 정규화 수식 패턴을 분석해 구현할 핵심 계산 범위를 좁혔습니다.',
  },
] as const;

const interviewStories = [
  '복잡한 팬메이드 계산기를 그대로 베끼지 않고, 실제 서비스에서 유지 가능한 계산 경계로 재구성했습니다.',
  '입력 헥사환산에 이미 반영된 프리셋 효과를 다시 곱하지 않도록 중복 계산 문제를 찾아 모델에 반영했습니다.',
  '보스 배율이라는 숫자를 파티장과 참가자의 의사결정, 역할 조건, 보상 동의 플로우로 연결했습니다.',
  '비숍 기준 추정 모델이라는 한계를 숨기지 않고 엔진 설명 화면과 다음 검증 과제로 노출했습니다.',
] as const;

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-bold uppercase text-[#d85432]">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-normal text-[#171a21] sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#5f6875] sm:text-base">{body}</p>
    </div>
  );
}

export default function PortfolioPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] text-[#171a21]">
      <header className="border-b border-[#dfe2e8] bg-white">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between px-4 sm:px-6">
          <a href="/" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#dfe2e8] bg-white px-2.5 text-xs font-semibold text-[#535b68] transition-colors hover:bg-[#f5f6f8]">
            <ArrowLeft className="size-3.5" />
            앱으로
          </a>
          <span className="text-xs font-bold text-[#687080]">Game Programmer Portfolio</span>
        </div>
      </header>

      <section className="border-b border-[#dfe2e8] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:py-14">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[#ffd0bf] bg-[#fff3ee] px-2.5 py-1 text-xs font-bold text-[#c74928]">
              <Sparkles className="size-3.5" />
              게임 시스템 / 데이터 모델링 / 웹 서비스
            </span>
            <span className="text-xs font-semibold text-[#7a818d]">MapleStory boss-party utility</span>
          </div>
          <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-normal text-[#171a21] sm:text-5xl lg:text-6xl">
            MapleParty
          </h1>
          <p className="mt-4 max-w-4xl text-lg font-semibold leading-8 text-[#343a44] sm:text-xl">
            메이플스토리 보스 배율 계산과 파티 모집 검증을 하나로 묶은 게임 프로그래머 포트폴리오 프로젝트입니다.
          </p>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-[#687080]">
            스프레드시트 기반 환산식을 역분석하고, 공식 캐릭터 API와 전투 보정 모델을 결합해 유저가 실제로 파티를 만들고 참가할 수 있는 서비스 흐름까지 구현했습니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a href="/" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#20242c] px-4 text-sm font-bold text-white transition-colors hover:bg-[#15181e]">
              <PlayCircle className="size-4" />
              라이브 앱 보기
            </a>
            <a href="#evidence" className="inline-flex h-10 items-center gap-2 rounded-md border border-[#ccd1d9] bg-white px-4 text-sm font-bold text-[#3f4652] transition-colors hover:bg-[#f4f6f8]">
              <FileCode2 className="size-4" />
              구현 근거 보기
            </a>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="min-h-28 rounded-lg border border-[#dfe2e8] bg-[#fafbfc] p-4">
                <strong className="block text-2xl font-black tabular-nums text-[#171a21]">{item.value}</strong>
                <span className="mt-1 block text-sm font-bold text-[#454c57]">{item.label}</span>
                <span className="mt-1 block text-xs leading-5 text-[#7a818d]">{item.detail}</span>
              </div>
            ))}
          </div>

          <div className="mt-8 flex min-h-24 flex-wrap items-center gap-3 rounded-lg border border-[#dfe2e8] bg-[#f7f8fa] px-4 py-4">
            {bossImages.map((image) => (
              <span key={image.alt} className="grid size-16 place-items-center rounded-md border border-[#d8dce2] bg-white">
                <img src={image.src} alt={image.alt} className="max-h-12 max-w-12 object-contain drop-shadow-sm" />
              </span>
            ))}
            <div className="min-w-64 flex-1">
              <p className="text-xs font-bold uppercase text-[#d85432]">Portfolio Signal</p>
              <p className="mt-1 text-sm font-semibold leading-6 text-[#454c57]">
                게임 도메인 지식, 수치 모델링, 상태 검증, 실사용 UX를 한 프로젝트 안에서 끝까지 연결했습니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfe2e8]">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:py-12">
          <SectionHeading
            eyebrow="Problem"
            title="숫자를 그대로 보여주는 계산기가 아니라, 플레이 결정을 도와주는 시스템"
            body="보스컷 계산은 데이터 출처, 직업별 보정, 레벨과 포스 차이, 파티 인원 규칙이 서로 얽혀 있습니다. 이 프로젝트는 그 얽힘을 서버와 클라이언트가 함께 검증할 수 있는 규칙으로 정리했습니다."
          />
          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {problemFrames.map((item) => (
              <article key={item.title} className="rounded-lg border border-[#dfe2e8] bg-white p-5">
                <item.icon className="size-5 text-[#eb5b35]" />
                <h3 className="mt-4 text-base font-bold text-[#242932]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#687080]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfe2e8] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:py-12">
          <SectionHeading
            eyebrow="Implementation"
            title="계산 엔진, 공식 API, 파티 도메인을 분리한 구현"
            body="핵심 로직은 순수 계산 모듈에, 파티 규칙은 서버 서비스에, 사용자의 의사결정은 화면 상태로 분리했습니다. 덕분에 계산 모델을 바꿔도 파티 검증 흐름 전체를 다시 작성하지 않아도 됩니다."
          />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {implementation.map((item) => (
              <article key={item.title} className="rounded-lg border border-[#dfe2e8] bg-[#fbfbfc] p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-md bg-[#20242c] text-white">
                    <item.icon className="size-4" />
                  </span>
                  <h3 className="text-base font-bold text-[#242932]">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#687080]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfe2e8]">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:py-12">
          <SectionHeading
            eyebrow="Pipeline"
            title="전투 데이터가 파티 행동이 되기까지"
            body="포트폴리오에서 강조할 흐름은 계산 자체보다, 계산 결과가 실제 사용자의 선택으로 이어지는 구조입니다."
          />
          <ol className="mt-7 grid gap-3 lg:grid-cols-5">
            {pipeline.map((item, index) => (
              <li key={item} className="min-h-32 rounded-lg border border-[#dfe2e8] bg-white p-4">
                <span className="grid size-7 place-items-center rounded-md bg-[#fff3ee] text-xs font-black tabular-nums text-[#c74928]">{index + 1}</span>
                <p className="mt-4 text-sm font-bold leading-6 text-[#343a44]">{item}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="evidence" className="border-b border-[#dfe2e8] bg-white">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:py-12">
          <SectionHeading
            eyebrow="Evidence"
            title="코드와 산출물로 말할 수 있는 구현 근거"
            body="면접이나 포트폴리오 설명에서는 아래 네 가지를 열어두면, 단순 클론 프로젝트가 아니라 복잡한 게임 규칙을 제품으로 옮긴 사례라는 점이 잘 드러납니다."
          />
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {evidence.map((item) => (
              <article key={item.path} className="rounded-lg border border-[#dfe2e8] bg-[#fbfbfc] p-5">
                <div className="flex items-center gap-2">
                  <FileCode2 className="size-4 text-[#175fd2]" />
                  <code className="rounded-sm bg-white px-1.5 py-1 text-xs font-bold text-[#343a44] ring-1 ring-[#e3e6eb]">{item.path}</code>
                </div>
                <h3 className="mt-4 text-base font-bold text-[#242932]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#687080]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#dfe2e8]">
        <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:py-12">
          <SectionHeading
            eyebrow="Validation"
            title="정확도와 서비스 규칙을 분리해서 검증"
            body="현재 계산 엔진은 비숍 기준 추정 모델입니다. 그래서 포트폴리오에서는 모델의 근거와 한계를 함께 말하고, 검증 가능한 범위를 명확히 잡는 태도를 보여주는 것이 좋습니다."
          />
          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {[
              ['기준 표본 재현', '83,583 헥사환산 기준 실제 화면의 보스 배율을 재현하도록 보스별 고정점을 맞췄습니다.'],
              ['수식 추적 리포트', '시트별 수식 수, 오류 패턴, 교차 참조를 분석해 구현 위험을 먼저 좁혔습니다.'],
              ['도메인 제약 처리', '정원, 역할, 최소 배율, 약정 버전, 출발 시간, 중복 가입을 서버에서 다시 확인합니다.'],
            ].map(([title, body]) => (
              <article key={title} className="rounded-lg border border-[#dfe2e8] bg-white p-5">
                <TestTubeDiagonal className="size-5 text-[#175fd2]" />
                <h3 className="mt-4 text-base font-bold text-[#242932]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#687080]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#20242c]">
        <div className="mx-auto max-w-[1180px] px-4 py-10 text-white sm:px-6 lg:py-12">
          <p className="text-xs font-bold uppercase text-[#ffb49e]">Interview Stories</p>
          <h2 className="mt-2 max-w-3xl text-2xl font-bold tracking-normal sm:text-3xl">면접에서 바로 말할 수 있는 포인트</h2>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {interviewStories.map((story) => (
              <article key={story} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                <CheckCircle2 className="size-5 text-[#6ee7b7]" />
                <p className="mt-3 text-sm font-semibold leading-6 text-[#f7f8fa]">{story}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-white">
              <GitBranch className="size-3.5" />
              TypeScript
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-white">React</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-white">Cloudflare D1</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-white">NEXON Open API</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-white">Combat Modeling</span>
          </div>
        </div>
      </section>
    </main>
  );
}
