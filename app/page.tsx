'use client';

import Image from 'next/image';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { Calculator, CircleHelp, Database, ExternalLink, KeyRound, Search, ShieldCheck, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { calculateBosses, CharacterProfile, formatRate, REFERENCE_HEXA, REFERENCE_PROFILE } from '@/lib/model';

type Filter = 'all' | 'challenge' | 'solo';
type Sort = 'site' | 'rate' | 'difficulty';
type NoticeKind = 'info' | 'success' | 'error';

const filters: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'challenge', label: '도전권' },
  { value: 'solo', label: '솔플권' },
];

const statItems = (profile: CharacterProfile) => [
  ['직업 / 레벨', `${profile.characterClass} · Lv.${profile.level}`],
  ['아케인 / 어센틱', `${profile.arcaneForce.toLocaleString()} / ${profile.authenticForce.toLocaleString()}`],
  ['방어율 무시', `${profile.ignoreDefense.toFixed(4)}%`],
  ['보스 데미지', `${profile.bossDamage.toFixed(0)}%`],
  ['크리티컬 데미지', `${profile.criticalDamage.toFixed(2)}%`],
];

function statusClass(key: string) {
  if (key === 'impossible') return 'bg-red-50 text-red-700 ring-red-200';
  if (key === 'party-min') return 'bg-violet-50 text-violet-700 ring-violet-200';
  if (key === 'party') return 'bg-blue-50 text-blue-700 ring-blue-200';
  if (key === 'solo-min') return 'bg-amber-50 text-amber-700 ring-amber-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
}

export default function Home() {
  const [nickname, setNickname] = useState(REFERENCE_PROFILE.nickname);
  const [hexaInput, setHexaInput] = useState(String(REFERENCE_HEXA));
  const [profile, setProfile] = useState<CharacterProfile>(REFERENCE_PROFILE);
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('site');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('팸귄 비숍의 83,583 스크린샷을 기준점으로 계산했습니다.');
  const [noticeKind, setNoticeKind] = useState<NoticeKind>('info');
  const [apiDialogOpen, setApiDialogOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    const storedKey = sessionStorage.getItem('nexon-open-api-key');
    if (storedKey) queueMicrotask(() => setApiKey(storedKey));
  }, []);

  const hexa = Math.max(0, Number(hexaInput.replace(/,/g, '')) || 0);
  const exactAnchor = hexa === REFERENCE_HEXA && profile.nickname === REFERENCE_PROFILE.nickname;
  const results = useMemo(() => {
    const calculated = calculateBosses(hexa, profile);
    const filtered = calculated.filter((boss) => {
      if (filter === 'challenge') return boss.rate < 110;
      if (filter === 'solo') return boss.rate >= 90;
      return true;
    });
    if (sort === 'difficulty') return [...filtered].sort((a, b) => b.cardStat - a.cardStat);
    if (sort === 'rate') return [...filtered].sort((a, b) => a.rate - b.rate);
    return filtered;
  }, [filter, hexa, profile, sort]);

  async function loadCharacter(key = apiKey) {
    if (!nickname.trim()) {
      setNoticeKind('error');
      return setNotice('닉네임을 입력해 주세요.');
    }
    if (!hexa) {
      setNoticeKind('error');
      return setNotice('헥사환산 값을 입력해 주세요.');
    }
    setLoading(true);
    try {
      const response = await fetch(`/api/character?nickname=${encodeURIComponent(nickname.trim())}`, {
        headers: key ? { 'x-nexon-api-key': key } : {},
      });
      const data = await response.json() as CharacterProfile & { error?: string; code?: string };
      if (data.code === 'API_KEY_REQUIRED') setApiDialogOpen(true);
      if (!response.ok) throw new Error(data.error ?? '캐릭터 정보를 불러오지 못했습니다.');
      setProfile(data as CharacterProfile);
      setNoticeKind('success');
      setNotice(data.source === 'nexon'
        ? `${data.characterClass === '비숍' ? '넥슨 Open API 정보로 계산했습니다.' : '현재 계산 곡선은 비숍 전용이므로 이 직업의 결과는 참고치입니다.'}`
        : '저장된 기준 스냅샷으로 계산했습니다.');
    } catch (error) {
      setNoticeKind('error');
      setNotice(error instanceof Error ? error.message : '조회 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadCharacter();
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

  return (
    <Tooltip>
      <div className="min-h-screen bg-[#f5f6f8] text-[#171a21]">
        <header className="border-b border-[#dfe2e8] bg-white">
          <div className="mx-auto flex h-15 max-w-[1540px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid size-8 place-items-center rounded-md bg-[#eb5b35] text-white"><Calculator className="size-4.5" /></span>
              <div>
                <p className="text-[15px] font-bold leading-tight">보스컷 랩</p>
                <p className="text-[11px] text-[#747b88]">비숍 헥사환산 배율 계산기</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setApiDialogOpen(true)} className={`h-8 rounded-md px-2.5 text-xs ${apiKey ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#dfe2e8] text-[#535b68]'}`}>
                <KeyRound className="size-3.5" /> {apiKey ? 'API 연결됨' : 'API 연결'}
              </Button>
              <Badge variant="outline" className="h-8 max-w-44 gap-1.5 truncate rounded-md border-[#dfe2e8] bg-[#fafbfc] px-2.5 text-[#535b68]">
                <Database className="size-3.5 shrink-0" /> <span className="truncate">{profile.nickname} · {profile.source === 'nexon' ? '공식 API' : '기준값'}</span>
              </Badge>
            </div>
          </div>
        </header>

        <main>
          <section className="border-b border-[#dfe2e8] bg-white">
            <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold">닉네임과 헥사환산으로 보스 효율컷 계산</h1>
                  <p className="mt-1 text-sm text-[#687080]">공식 캐릭터 정보와 비숍 기준 실전딜 곡선을 함께 적용합니다.</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#687080]">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  {exactAnchor ? '83,583 기준값과 일치' : '기준점 외 구간은 추정치'}
                  <TooltipTrigger className="ml-0.5 grid size-6 place-items-center rounded-md hover:bg-[#f1f3f5]" aria-label="계산 기준 설명">
                    <CircleHelp className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">Maplescouter 내부의 직업별 보정값은 공개되지 않아, 확보한 비숍 기준점과 스플라인을 사용합니다.</TooltipContent>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
                <label className="relative" htmlFor="character-name">
                  <span className="sr-only">캐릭터 닉네임</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a919d]" />
                  <Input id="character-name" value={nickname} onChange={(event) => setNickname(event.target.value)} className="h-11 rounded-md border-[#ccd1d9] pl-9" placeholder="캐릭터 닉네임" />
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
              <p className={`mt-2 min-h-7 rounded-md px-2.5 py-1.5 text-xs font-medium ${noticeKind === 'error' ? 'border border-red-200 bg-red-50 text-red-700' : noticeKind === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-[#687080]'}`} aria-live="polite">{notice}</p>
            </div>
          </section>

          <section className="border-b border-[#dfe2e8] bg-[#fbfbfc]">
            <div className="mx-auto grid max-w-[1540px] grid-cols-2 divide-x divide-y divide-[#e3e6eb] px-4 sm:grid-cols-5 sm:px-6">
              {statItems(profile).map(([label, value]) => (
                <div key={label} className="px-3 py-3.5 first:pl-0 sm:px-5">
                  <p className="text-[11px] font-medium text-[#7a818d]">{label}</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-[#282d36]">{value}</p>
                </div>
              ))}
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
                      <div className="grid size-[76px] shrink-0 place-items-center rounded-md border border-[#d8dce2] bg-[#252a32] px-2 text-center text-xs font-bold text-white">벨로나</div>
                    )}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="truncate text-[11px] font-bold uppercase text-[#d85432]">{boss.difficulty}</p>
                      <h2 className="mt-0.5 min-h-10 text-sm font-bold leading-5">{boss.name}</h2>
                      <p className="text-[11px] text-[#7b828d]">Lv.{boss.level} · 최대 {boss.partyLimit}인</p>
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
    </Tooltip>
  );
}
