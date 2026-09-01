'use client';

import Image from 'next/image';
import { SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Calculator, CircleHelp, Crown, Database, ExternalLink, Gauge, KeyRound, Layers3, LogIn, LogOut, Search, ShieldCheck, SlidersHorizontal, Sparkles, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PartyBoard } from '@/components/party-board';
import type { AuthResponse, AuthUser } from '@/lib/auth';
import { BOSS_TABLE_VERSION, calculateBosses, calculateEngineSummary, CharacterProfile, ENGINE_VERSION, formatRate, REFERENCE_HEXA, REFERENCE_PROFILE } from '@/lib/model';

type Filter = 'range' | 'all' | 'solo';
type Sort = 'site' | 'rate' | 'difficulty';
type NoticeKind = 'info' | 'success' | 'error';
type View = 'parties' | 'calculator';
type AuthMode = 'login' | 'register';

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'range', label: '내 기준' },
  { value: 'all', label: '전체' },
  { value: 'solo', label: '솔플권' },
];

const statItems = (profile: CharacterProfile) => [
  ['직업 / 레벨', `${profile.characterClass} · Lv.${profile.level}`],
  ['아케인 / 어센틱', `${profile.arcaneForce.toLocaleString()} / ${profile.authenticForce.toLocaleString()}`],
  ['방어율 무시', `${profile.ignoreDefense.toFixed(4)}%`],
  ['데미지 / 보스', `${profile.damage.toFixed(0)}% / ${profile.bossDamage.toFixed(0)}%`],
  ['크확 / 크뎀', `${profile.criticalRate.toFixed(1)}% / ${profile.criticalDamage.toFixed(2)}%`],
  ['HEXA 코어', profile.hexaCoreCount == null ? '조회 전' : `${profile.hexaCoreCount}개 · 총 Lv.${profile.hexaCoreLevelTotal ?? 0}`],
];

function formatDamage(value: number) {
  return `${(value / 100_000_000).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}억`;
}

function selectedPresets(profile: CharacterProfile) {
  const selection = profile.bestCondition?.selection;
  if (!selection) return '현재 적용 프리셋';
  const labels = [
    ['장비', selection.item],
    ['어빌', selection.ability],
    ['하이퍼', selection.hyperStat],
    ['링크', selection.linkSkill],
    ['유니온', selection.union],
  ];
  return labels.filter((item) => item[1] != null).map(([label, value]) => `${label} ${value}`).join(' · ');
}

function statusClass(key: string) {
  if (key === 'impossible') return 'bg-red-50 text-red-700 ring-red-200';
  if (key === 'party-min') return 'bg-violet-50 text-violet-700 ring-violet-200';
  if (key === 'party') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (key === 'solo-min') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}

export default function Home() {
  const [view, setView] = useState<View>('parties');
  const [nickname, setNickname] = useState(REFERENCE_PROFILE.nickname);
  const [hexaInput, setHexaInput] = useState(String(REFERENCE_HEXA));
  const [profile, setProfile] = useState<CharacterProfile>(REFERENCE_PROFILE);
  const [filter, setFilter] = useState<Filter>('range');
  const [sort, setSort] = useState<Sort>('site');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(`${BOSS_TABLE_VERSION.replace('MapleScouter KMS ', '')} 보스컷 표와 실제 스플라인 배율식을 적용했습니다.`);
  const [noticeKind, setNoticeKind] = useState<NoticeKind>('info');
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authLoginName, setAuthLoginName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [engineDialogOpen, setEngineDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const requestSequence = useRef(0);
  const requestController = useRef<AbortController | null>(null);

  useEffect(() => {
    const storedKey = sessionStorage.getItem('nexon-open-api-key');
    if (storedKey) queueMicrotask(() => setApiKey(storedKey));
    const controller = new AbortController();
    fetch('/api/auth', { cache: 'no-store', credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as AuthResponse;
        if (!response.ok) throw new Error(data.error ?? '로그인 상태를 확인하지 못했습니다.');
        setAuthUser(data.user ?? null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setAuthNotice(error instanceof Error ? error.message : '로그인 상태를 확인하지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setAuthLoading(false);
      });
    return () => {
      controller.abort();
      requestController.current?.abort();
    };
  }, []);

  const hexa = Math.max(0, Number(hexaInput.replace(/,/g, '')) || 0);
  const exactAnchor = hexa === REFERENCE_HEXA && profile.source === 'reference';
  const profileMatchesNickname = nickname.trim() === profile.nickname;
  const engine = useMemo(() => calculateEngineSummary(hexa, profile), [hexa, profile]);
  const allBossResults = useMemo(() => calculateBosses(hexa, profile), [hexa, profile]);
  const results = useMemo(() => {
    const filtered = allBossResults.filter((boss) => {
      if (filter === 'range') {
        const minimumRate = boss.partyBoss ? 85 / boss.partyLimit : 15;
        return boss.rate >= minimumRate && boss.rate <= 1000;
      }
      if (filter === 'solo') return boss.rate >= 90;
      return true;
    });
    if (sort === 'difficulty') return [...filtered].sort((a, b) => b.cardStat - a.cardStat);
    if (sort === 'rate') return [...filtered].sort((a, b) => a.rate - b.rate);
    return filtered;
  }, [allBossResults, filter, sort]);

  async function loadCharacter(key = apiKey) {
    if (!nickname.trim()) {
      setNoticeKind('error');
      return setNotice('닉네임을 입력해 주세요.');
    }
    if (!hexa) {
      setNoticeKind('error');
      return setNotice('헥사환산 값을 입력해 주세요.');
    }
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/character?nickname=${encodeURIComponent(nickname.trim())}&refresh=1`, {
        headers: key ? { 'x-nexon-api-key': key } : {},
        signal: controller.signal,
      });
      const data = await response.json() as CharacterProfile & { error?: string; code?: string };
      if (sequence !== requestSequence.current) return;
      if (data.code === 'API_KEY_REQUIRED') setApiDialogOpen(true);
      if (!response.ok) throw new Error(data.error ?? '캐릭터 정보를 불러오지 못했습니다.');
      if (data.partialData) throw new Error('공식 API 일부 응답이 지연되었습니다. 잠시 후 다시 계산해 주세요.');
      setProfile(data as CharacterProfile);
      setNoticeKind('success');
      const maxSymbols = Object.values(data.calculationProfile?.symbolLevels ?? {}).filter((level) => level === 11).length;
      setNotice(data.source === 'nexon'
        ? `${data.characterClass === '비숍' ? `공식 API 프리셋 ${data.bestCondition?.sourceCount ?? 0}종, HEXA 코어 ${data.hexaCoreCount ?? 0}개, 최고레벨 지역 심볼 ${maxSymbols}개를 적용했습니다.` : '현재 계산 곡선은 비숍 전용이므로 이 직업의 결과는 참고치입니다.'}${data.dataDate ? ` 기준일 ${data.dataDate.slice(0, 10)}` : ''}`
        : '저장된 기준 스냅샷으로 계산했습니다.');
    } catch (error) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setNoticeKind('error');
      setNotice(error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCharacter();
  }

  function handleNicknameChange(value: string) {
    setNickname(value);
    if (value.trim() !== profile.nickname) {
      setNoticeKind('info');
      setNotice(`현재 결과는 ${profile.nickname} 기준입니다. 계산하기를 눌러 새 캐릭터 정보를 불러오세요.`);
    }
  }

  async function handleApiKeySave(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedKey = apiKey.trim();
    setApiKey(trimmedKey);
    if (trimmedKey) sessionStorage.setItem('nexon-open-api-key', trimmedKey);
    else sessionStorage.removeItem('nexon-open-api-key');
    setApiDialogOpen(false);
    if (trimmedKey) await loadCharacter(trimmedKey);
    else {
      setNoticeKind('info');
      setNotice('NEXON Open API 연결을 해제했습니다.');
    }
  }

  function openAuthDialog(mode: AuthMode, message = '') {
    setAuthMode(mode);
    setAuthPassword('');
    setAuthNotice(message);
    setAuthDialogOpen(true);
  }

  async function handleAuthSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthSubmitting(true);
    setAuthNotice('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          loginName: authLoginName,
          displayName: authLoginName,
          password: authPassword,
        }),
      });
      const data = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(data.error ?? '로그인 요청을 처리하지 못했습니다.');
      setAuthUser(data.user ?? null);
      setAuthDialogOpen(false);
      setAuthPassword('');
      setNoticeKind('success');
      setNotice(`${data.user?.displayName ?? authLoginName} 계정으로 로그인했습니다.`);
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : '로그인 요청을 처리하지 못했습니다.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    setAuthSubmitting(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      const data = await response.json() as AuthResponse;
      if (!response.ok) throw new Error(data.error ?? '로그아웃하지 못했습니다.');
      setAuthUser(null);
      setNoticeKind('info');
      setNotice('로그아웃했습니다.');
    } catch (error) {
      setNoticeKind('error');
      setNotice(error instanceof Error ? error.message : '로그아웃하지 못했습니다.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  return (
    <Tooltip>
      <div className="min-h-screen bg-[#f5f6f8] text-[#171a21]">
        <header className="border-b border-[#dfe2e8] bg-white">
          <div className="mx-auto flex h-15 max-w-[1540px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-md bg-[#eb5b35] text-white"><Calculator className="size-4.5" /></span>
              <div>
                <p className="text-[15px] font-bold leading-tight">MapleParty</p>
                <p className="text-[11px] text-[#747b88]">배율 기반 보스 파티 모집</p>
              </div>
            </div>
            <nav className="hidden items-center gap-1 rounded-md bg-[#f1f3f5] p-1 sm:flex" aria-label="주요 화면">
              <Button type="button" variant="ghost" size="sm" onClick={() => setView('parties')} className={`h-7 rounded-sm px-3 text-xs ${view === 'parties' ? 'bg-white font-bold shadow-sm hover:bg-white' : 'text-[#687080]'}`}>파티 모집</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setView('calculator')} className={`h-7 rounded-sm px-3 text-xs ${view === 'calculator' ? 'bg-white font-bold shadow-sm hover:bg-white' : 'text-[#687080]'}`}>보스 배율</Button>
            </nav>
            <div className="flex items-center gap-2">
              {authUser ? (
                <>
                  <Badge variant="outline" className="h-8 max-w-40 gap-1.5 truncate rounded-md border-[#dfe2e8] bg-[#fafbfc] px-2.5 text-[#535b68]">
                    <UserRound className="size-3.5 shrink-0" /> <span className="truncate">{authUser.displayName}</span>
                  </Badge>
                  <Button type="button" variant="outline" size="sm" disabled={authSubmitting} onClick={() => void handleLogout()} className="h-8 rounded-md border-[#dfe2e8] px-2.5 text-xs text-[#535b68]">
                    <LogOut className="size-3.5" /> 로그아웃
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm" disabled={authLoading} onClick={() => openAuthDialog('login')} className="h-8 rounded-md border-[#dfe2e8] px-2.5 text-xs text-[#535b68]">
                  <LogIn className="size-3.5" /> {authLoading ? '확인 중' : '로그인'}
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={() => setEngineDialogOpen(true)} className="h-8 rounded-md border-[#dfe2e8] px-2.5 text-xs text-[#535b68]">
                <Activity className="size-3.5" /> 계산식
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setApiDialogOpen(true)} className={`h-8 rounded-md px-2.5 text-xs ${apiKey ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#dfe2e8] text-[#535b68]'}`}>
                <KeyRound className="size-3.5" /> {apiKey ? 'API 연결됨' : 'API 연결'}
              </Button>
              <Badge variant="outline" className="h-8 max-w-44 gap-1.5 truncate rounded-md border-[#dfe2e8] bg-[#fafbfc] px-2.5 text-[#535b68]">
                <Database className="size-3.5 shrink-0" /> <span className="truncate">{profile.nickname} · {profile.source === 'nexon' ? '공식 API' : '기준값'}</span>
              </Badge>
            </div>
          </div>
        </header>

        <nav className="flex border-b border-[#dfe2e8] bg-white p-1 sm:hidden" aria-label="주요 화면">
          <Button type="button" variant="ghost" size="sm" onClick={() => setView('parties')} className={`h-8 flex-1 rounded-sm text-xs ${view === 'parties' ? 'bg-[#20242c] font-bold text-white hover:bg-[#20242c] hover:text-white' : 'text-[#687080]'}`}>파티 모집</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setView('calculator')} className={`h-8 flex-1 rounded-sm text-xs ${view === 'calculator' ? 'bg-[#20242c] font-bold text-white hover:bg-[#20242c] hover:text-white' : 'text-[#687080]'}`}>보스 배율</Button>
        </nav>

        <main>
          {view === 'parties' ? (
            <PartyBoard
              profile={profile}
              nickname={nickname}
              hexaInput={hexaInput}
              hexaStat={hexa}
              profileMatchesNickname={profileMatchesNickname}
              characterLoading={loading}
              bossResults={allBossResults}
              apiKey={apiKey}
              authUser={authUser}
              onNicknameChange={handleNicknameChange}
              onHexaChange={setHexaInput}
              onLookup={() => loadCharacter()}
              onOpenCalculator={() => setView('calculator')}
              onRequireAuth={(message) => openAuthDialog('login', message)}
            />
          ) : (
          <>
          <section className="border-b border-[#dfe2e8] bg-white">
            <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold">닉네임과 헥사환산으로 보스 효율컷 계산</h1>
                  <p className="mt-1 text-sm text-[#687080]">공식 캐릭터 정보와 300·380 방어율 독립 실전딜 곡선을 함께 적용합니다.</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#687080]">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  {exactAnchor ? '83,583 피해량 기준 검증' : ENGINE_VERSION}
                  <TooltipTrigger className="ml-0.5 grid size-6 place-items-center rounded-md hover:bg-[#f1f3f5]" aria-label="계산 기준 설명">
                    <CircleHelp className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">보스별 컷을 300·380 스플라인 피해량으로 변환한 뒤 레벨·포스, 카링 피해량과 난이도 계수를 순서대로 적용합니다.</TooltipContent>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
                <label className="relative" htmlFor="character-name">
                  <span className="sr-only">캐릭터 닉네임</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a919d]" />
                  <Input id="character-name" value={nickname} onChange={(event) => handleNicknameChange(event.target.value)} className="h-11 rounded-md border-[#ccd1d9] pl-9" placeholder="캐릭터 닉네임" />
                </label>
                <label className="relative" htmlFor="hexa-stat">
                  <span className="sr-only">헥사환산</span>
                  <Sparkles className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a919d]" />
                  <Input id="hexa-stat" inputMode="numeric" value={hexaInput ? Number(hexaInput.replace(/,/g, '')).toLocaleString() : ''} onChange={(event) => setHexaInput(event.target.value.replace(/[^0-9]/g, ''))} className="h-11 rounded-md border-[#ccd1d9] pl-9 tabular-nums" placeholder="헥사환산" />
                </label>
                <Button type="submit" disabled={loading} className="h-11 rounded-md bg-[#eb5b35] px-6 font-semibold hover:bg-[#d94d2a]">
                  <Calculator className="size-4" /> {loading ? '조회 중' : '계산하기'}
                </Button>
              </form>
              <p className={`mt-2 min-h-7 rounded-md px-2.5 py-1.5 text-xs font-medium ${noticeKind === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : noticeKind === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : !profileMatchesNickname ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'text-[#687080]'}`} aria-live="polite">{notice}</p>
            </div>
          </section>

          <section className="border-b border-[#dfe2e8] bg-[#fbfbfc]">
            <div className="mx-auto grid max-w-[1540px] grid-cols-2 divide-x divide-y divide-[#e3e6eb] px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
              {statItems(profile).map(([label, value]) => (
                <div key={label} className="px-3 py-3.5 first:pl-0 sm:px-5">
                  <p className="text-[11px] font-medium text-[#7a818d]">{label}</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-[#282d36]">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-[#dfe2e8] bg-white">
            <div className="mx-auto flex max-w-[1540px] flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 lg:w-[38%]">
                <div className="flex items-center gap-2">
                  <Crown className="size-4 text-[#eb5b35]" />
                  <p className="text-xs font-bold text-[#3a404a]">{profile.bestCondition?.applied ? '프리셋 분석 완료' : '현재 컨디션'}</p>
                  {profile.bestCondition?.applied && (
                    <Badge variant="outline" className="rounded-sm border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">
                      {profile.bestCondition.sourceCount}종 확인
                    </Badge>
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-[#687080]">{selectedPresets(profile)}</p>
              </div>
              <div className="grid flex-1 grid-cols-2 divide-x divide-y divide-[#e3e6eb] border-y border-[#e3e6eb] sm:grid-cols-5 sm:divide-y-0 lg:border-y-0">
                {[
                  ['300 피해량', formatDamage(engine.calculatedHexaDamage300), Math.round(engine.calculatedHexaDamage300).toLocaleString()],
                  ['380 피해량', formatDamage(engine.calculatedHexaDamage380), Math.round(engine.calculatedHexaDamage380).toLocaleString()],
                  ['카링 피해량', formatDamage(engine.calculatedHexaDamageKaling), Math.round(engine.calculatedHexaDamageKaling).toLocaleString()],
                  ['300 표시 헥환', engine.boss300HexaStat.toLocaleString(), ''],
                  ['380 표시 헥환', engine.boss380HexaStat.toLocaleString(), ''],
                ].map(([label, value, exact]) => (
                  <div key={label} className="min-w-0 px-3 py-2.5 first:pl-0 sm:py-1" title={exact || undefined}>
                    <p className="flex items-center gap-1 truncate text-[10px] font-medium text-[#7a818d]"><Gauge className="size-3 shrink-0" />{label}</p>
                    <p className="mt-1 truncate text-sm font-bold tabular-nums text-[#282d36]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-md border border-[#d7dbe2] bg-white p-1">
                {filters.map((item) => (
                  <Button key={item.value} type="button" variant="ghost" size="sm" onClick={() => setFilter(item.value)} className={`h-8 rounded-sm px-3 text-xs ${filter === item.value ? 'bg-[#20242c] text-white hover:bg-[#20242c] hover:text-white' : 'text-[#626a77]'}`}>
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#737b87]">{results.length}개 보스</span>
                <SlidersHorizontal className="size-4 text-[#737b87]" />
                <NativeSelect value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-9 w-32 rounded-md border-[#d7dbe2] bg-white text-xs">
                  <NativeSelectOption value="site">기준 화면 순</NativeSelectOption>
                  <NativeSelectOption value="rate">배율 낮은 순</NativeSelectOption>
                  <NativeSelectOption value="difficulty">요구 헥환 순</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <div className="boss-grid">
              {results.map((boss) => (
                <article key={boss.id} className="boss-card">
                  <div className="flex items-start gap-3">
                    {boss.image ? (
                      <Image src={boss.image} alt={`${boss.difficulty} ${boss.name}`} width={76} height={76} className="size-[76px] shrink-0 rounded-md border border-[#d8dce2] object-cover" />
                    ) : (
                      <div className="grid size-[76px] shrink-0 place-items-center rounded-md border border-[#d8dce2] bg-[#252a32] px-2 text-center text-xs font-bold text-white">{boss.name}</div>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-[11px] font-bold uppercase text-[#d85432]">{boss.difficulty}</p>
                      <h2 className="mt-0.5 min-h-10 text-sm font-bold leading-5">{boss.name}</h2>
                      <p className="text-[11px] text-[#7b828d]">Lv.{boss.level} · 최대 {boss.partyLimit}인</p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-[#9096a0]">레벨 ×{boss.levelMultiplier.toFixed(2)} · 포스 ×{boss.forceMultiplier.toFixed(2)}{boss.symbolMultiplier !== 1 ? ` · 심볼 ×${boss.symbolMultiplier.toFixed(3)}` : ''}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-[#e5e7eb] pt-3">
                    <div>
                      <span className={`inline-flex rounded-sm px-1.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusClass(boss.status.key)}`}>{boss.status.label}</span>
                      <p className="mt-2 text-xs text-[#717986]">표시 헥환 <strong className="ml-1 text-[#313640] tabular-nums">{boss.cardStat.toLocaleString()}</strong></p>
                    </div>
                    <strong className={`text-lg tabular-nums ${boss.rate >= 100 ? 'text-[#175fd2]' : boss.rate < 30 ? 'text-[#d83c2f]' : 'text-[#171a21]'}`}>{boss.partyBoss ? `[파티] ${Math.round(boss.rate)}%` : formatRate(boss.rate)}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
          </>
          )}
        </main>
      </div>
      <Dialog open={apiDialogOpen} onOpenChange={setApiDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="size-4 text-[#eb5b35]" /> NEXON Open API 연결</DialogTitle>
            <DialogDescription>키는 현재 브라우저 탭에만 보관되며 캐릭터 조회 요청에만 사용됩니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleApiKeySave} className="space-y-4">
            <label htmlFor="nexon-api-key" className="block text-xs font-semibold text-[#535b68]">메이플스토리 API 키</label>
            <Input id="nexon-api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} className="h-10 rounded-md border-[#ccd1d9] font-mono" placeholder="NEXON Open API 키" />
            <a href="https://openapi.nexon.com/game/maplestory/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#175fd2] hover:underline">
              공식 API 키 발급 <ExternalLink className="size-3" />
            </a>
            <DialogFooter className="mt-1 rounded-b-lg">
              <Button type="button" variant="outline" onClick={() => { setApiKey(''); sessionStorage.removeItem('nexon-open-api-key'); setApiDialogOpen(false); setNoticeKind('info'); setNotice('NEXON Open API 연결을 해제했습니다.'); }} className="rounded-md">연결 해제</Button>
              <Button type="submit" className="rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]">저장 후 조회</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={authDialogOpen} onOpenChange={setAuthDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserRound className="size-4 text-[#eb5b35]" /> MapleParty 로그인</DialogTitle>
            <DialogDescription>파티 생성, 가입, 탈퇴 기록을 계정에 연결합니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="grid grid-cols-2 rounded-md border border-[#d7dbe2] bg-[#f1f3f5] p-1">
              <button type="button" onClick={() => { setAuthMode('login'); setAuthNotice(''); }} className={`h-8 rounded-sm text-xs font-bold ${authMode === 'login' ? 'bg-white text-[#20242c] shadow-sm' : 'text-[#687080]'}`}>로그인</button>
              <button type="button" onClick={() => { setAuthMode('register'); setAuthNotice(''); }} className={`h-8 rounded-sm text-xs font-bold ${authMode === 'register' ? 'bg-white text-[#20242c] shadow-sm' : 'text-[#687080]'}`}>회원가입</button>
            </div>
            <label htmlFor="auth-login-name" className="block space-y-1.5 text-xs font-semibold text-[#535b68]">
              아이디
              <Input id="auth-login-name" value={authLoginName} onChange={(event) => setAuthLoginName(event.target.value)} autoComplete="username" className="h-10 rounded-md border-[#ccd1d9]" placeholder="2~20자" />
            </label>
            <label htmlFor="auth-password" className="block space-y-1.5 text-xs font-semibold text-[#535b68]">
              비밀번호
              <Input id="auth-password" type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} className="h-10 rounded-md border-[#ccd1d9]" placeholder="6자 이상" />
            </label>
            <p className={`min-h-8 rounded-md px-3 py-2 text-xs ${authNotice ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'bg-[#fafbfc] text-[#737b87]'}`} aria-live="polite">
              {authNotice || (authMode === 'login' ? '가입한 아이디로 파티 행동을 이어갈 수 있습니다.' : '캐릭터 닉네임과 달라도 되지만, 나중에 소유 인증과 연결할 예정입니다.')}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAuthDialogOpen(false)} className="rounded-md">취소</Button>
              <Button type="submit" disabled={authSubmitting} className="rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]">
                {authSubmitting ? '처리 중' : authMode === 'login' ? '로그인' : '가입하기'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={engineDialogOpen} onOpenChange={setEngineDialogOpen}>
        <DialogContent className="rounded-lg sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers3 className="size-4 text-[#eb5b35]" /> 현대 계산 엔진</DialogTitle>
            <DialogDescription>{engine.breakdown.version} · 비숍 전용</DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-[#e4e7ec] border-y border-[#e4e7ec] text-sm">
            {[
              ['보스 보정표', BOSS_TABLE_VERSION, '보스컷 · 난이도 계수 · 파티 전용 컷'],
              ['캐릭터 곡선', `300 ${engine.breakdown.curveExponent300.toFixed(6)} · 380 ${engine.breakdown.curveExponent380.toFixed(6)}`, '입력 헥환 기준점에 고정한 캐릭터별 곡률'],
              ['지역 심볼', `최고 레벨 ${engine.breakdown.maxAuthenticSymbols}개`, '보스 지역과 연결된 어센틱심볼 Lv.11 보정'],
              ['300 독립 스플라인', formatDamage(engine.breakdown.rawCurveDamage300), `HEXA 보정 ×${engine.breakdown.hexaCorrection300.toFixed(6)}`],
              ['380 독립 스플라인', formatDamage(engine.breakdown.rawCurveDamage380), `HEXA 보정 ×${engine.breakdown.hexaCorrection380.toFixed(6)}`],
              ['프리셋 중복 방지', `×${engine.breakdown.presetOffenseMultiplier.toFixed(6)}`, '입력 헥환에 포함된 프리셋 전투력을 다시 곱하지 않음'],
              ['방무 상수', `${engine.breakdown.defenseConstant300.toFixed(6)} / ${engine.breakdown.defenseConstant380.toFixed(6)}`, '여러 방무 줄을 곱연산으로 합성'],
              ['카링 실전 보정', `×${engine.breakdown.kalingMultiplier.toFixed(6)}`, '380 피해량 기준'],
              ['직업 상수', `무기 ${engine.breakdown.weaponConstant.toFixed(2)} · 숙련 ${Math.round(engine.breakdown.proficiency * 100)}%`, `최종뎀 ${engine.breakdown.classFinalDamage.toFixed(4)}% · 속성내성 무시 ${engine.breakdown.ignoreElementalResistance}%`],
            ].map(([label, value, detail]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[130px_1fr] sm:gap-4">
                <p className="text-xs font-semibold text-[#737b87]">{label}</p>
                <div className="min-w-0">
                  <p className="font-bold tabular-nums text-[#292e37]">{value}</p>
                  <p className="mt-0.5 text-xs text-[#7a818d]">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setEngineDialogOpen(false)} className="rounded-md bg-[#20242c] hover:bg-[#15181e]">확인</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tooltip>
  );
}
