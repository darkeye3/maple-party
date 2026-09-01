'use client';

import Image from 'next/image';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronDown, CircleUserRound, LayoutGrid, Plus, RefreshCw, ShieldCheck, UserRoundCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toggle } from '@/components/ui/toggle';
import type { BossResult, CharacterProfile } from '@/lib/model';
import type { PartyActionResponse, PartyPost } from '@/lib/parties';

const DEPARTING_SOON_MS = 3 * 60 * 60_000;
const difficultyStyles: Record<string, { active: string; idle: string }> = {
  익스트림: { active: 'border-[#e55c37] bg-[#e55c37] text-white', idle: 'border-[#f1b4a4] bg-[#fff3ef] text-[#c84725]' },
  데스티니: { active: 'border-[#7155c5] bg-[#7155c5] text-white', idle: 'border-[#c8bcec] bg-[#f5f2ff] text-[#5a3cad]' },
  카오스: { active: 'border-[#9850ac] bg-[#9850ac] text-white', idle: 'border-[#d7b7df] bg-[#faf2fc] text-[#7c378e]' },
  하드: { active: 'border-[#c63b67] bg-[#c63b67] text-white', idle: 'border-[#e8aabd] bg-[#fff0f5] text-[#a9254e]' },
  노멀: { active: 'border-[#36abc4] bg-[#36abc4] text-white', idle: 'border-[#9fd7e3] bg-[#edfafd] text-[#18829a]' },
  이지: { active: 'border-[#35a46d] bg-[#35a46d] text-white', idle: 'border-[#a5d9bf] bg-[#effaf4] text-[#237b50]' },
  챔피언: { active: 'border-[#d28a22] bg-[#d28a22] text-white', idle: 'border-[#ebca91] bg-[#fff8eb] text-[#a86a12]' },
};

type PartyBoardProps = {
  profile: CharacterProfile;
  nickname: string;
  hexaInput: string;
  hexaStat: number;
  profileMatchesNickname: boolean;
  characterLoading: boolean;
  bossResults: BossResult[];
  apiKey: string;
  onNicknameChange: (value: string) => void;
  onHexaChange: (value: string) => void;
  onLookup: () => Promise<void>;
  onOpenCalculator: () => void;
};

function localDateTimeValue(offsetHours = 2) {
  const date = new Date(Date.now() + offsetHours * 60 * 60_000);
  date.setMinutes(Math.ceil(date.getMinutes() / 10) * 10, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function departureLabel(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function rateLabel(value: number) {
  return value >= 100 ? `${value.toFixed(1)}%` : `${value.toFixed(2)}%`;
}

async function fetchPartyList(signal?: AbortSignal) {
  const response = await fetch('/api/parties', { cache: 'no-store', signal });
  const data = await response.json() as { parties?: PartyPost[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? '파티 목록을 불러오지 못했습니다.');
  return data.parties ?? [];
}

export function PartyBoard({
  profile,
  nickname,
  hexaInput,
  hexaStat,
  profileMatchesNickname,
  characterLoading,
  bossResults,
  apiKey,
  onNicknameChange,
  onHexaChange,
  onLookup,
  onOpenCalculator,
}: PartyBoardProps) {
  const partyBosses = useMemo(() => bossResults.filter((boss) => boss.partyLimit > 1), [bossResults]);
  const bossNames = useMemo(() => [...new Set(partyBosses.map((boss) => boss.name))], [partyBosses]);
  const [parties, setParties] = useState<PartyPost[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [bossFilter, setBossFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [departingSoonOnly, setDepartingSoonOnly] = useState(false);
  const [departingSoonReference, setDepartingSoonReference] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [bossPickerOpen, setBossPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<PartyPost | null>(null);
  const [bossName, setBossName] = useState(bossNames[0] ?? '');
  const difficultyOptions = partyBosses.filter((boss) => boss.name === bossName);
  const [bossId, setBossId] = useState(difficultyOptions[0]?.id ?? '');
  const selectedBoss = partyBosses.find((boss) => boss.id === bossId) ?? difficultyOptions[0];
  const [capacity, setCapacity] = useState('6');
  const [minimumRate, setMinimumRate] = useState('50');
  const [departureAt, setDepartureAt] = useState(localDateTimeValue());
  const selectedCapacity = Math.min(Math.max(Number(capacity) || 2, 2), selectedBoss?.partyLimit ?? 2);
  const createBossOptions = useMemo(() => bossNames.map((name) => {
    const options = partyBosses.filter((boss) => boss.name === name);
    const image = options.find((boss) => boss.image)?.image;
    return { name, image };
  }), [bossNames, partyBosses]);

  async function refreshParties() {
    setListLoading(true);
    if (departingSoonOnly) setDepartingSoonReference(Date.now());
    try {
      setParties(await fetchPartyList());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '파티 목록을 불러오지 못했습니다.');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    fetchPartyList(controller.signal)
      .then((items) => setParties(items))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : '파티 목록을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setListLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!profileMatchesNickname || !profile.image) return;
    const controller = new AbortController();
    fetch('/api/parties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync-profile',
        nickname: profile.nickname,
        characterImage: profile.image,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as PartyActionResponse;
        if (!response.ok) throw new Error(data.error ?? '캐릭터 이미지를 동기화하지 못했습니다.');
        return data.parties ?? [];
      })
      .then((items) => setParties(items))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : '캐릭터 이미지를 동기화하지 못했습니다.');
      });
    return () => controller.abort();
  }, [profile.image, profile.nickname, profileMatchesNickname]);

  function changeBossName(value: string) {
    setBossName(value);
    setBossId(partyBosses.find((boss) => boss.name === value)?.id ?? '');
    setBossPickerOpen(false);
  }

  const myRates = useMemo(() => new Map(partyBosses.map((boss) => [boss.id, boss.rate])), [partyBosses]);
  const bossFilterOptions = useMemo(() => {
    const options = new Map<string, { name: string; image?: string; count: number }>();

    for (const party of parties) {
      const current = options.get(party.bossName);
      const matchedBoss = partyBosses.find((boss) => boss.id === party.bossId);
      const image = matchedBoss?.image ?? partyBosses.find((boss) => boss.name === party.bossName && boss.image)?.image;

      options.set(party.bossName, {
        name: party.bossName,
        image: current?.image ?? image,
        count: (current?.count ?? 0) + 1,
      });
    }

    return [...options.values()];
  }, [parties, partyBosses]);
  const difficultyFilterOptions = useMemo(() => (
    [...new Set(parties
      .filter((party) => bossFilter === 'all' || party.bossName === bossFilter)
      .map((party) => party.difficulty))]
  ), [bossFilter, parties]);
  const activeDifficultyFilter = difficultyFilterOptions.includes(difficultyFilter) ? difficultyFilter : 'all';
  const visibleParties = useMemo(() => {
    const nicknameValue = nickname.trim();
    const departingSoonLimit = departingSoonReference + DEPARTING_SOON_MS;

    return parties.filter((party) => {
      const hasSeat = party.status === 'open' && party.members.length < party.capacity;
      const departureTime = new Date(party.departureAt).getTime();
      const canJoinParty = profileMatchesNickname
        && hasSeat
        && !party.members.some((member) => member.nickname === nicknameValue)
        && (myRates.get(party.bossId) ?? 0) >= party.minimumRate;

      if (bossFilter !== 'all' && party.bossName !== bossFilter) return false;
      if (activeDifficultyFilter !== 'all' && party.difficulty !== activeDifficultyFilter) return false;
      if (eligibleOnly && !canJoinParty) return false;
      if (openOnly && !hasSeat) return false;
      if (departingSoonOnly && (!Number.isFinite(departureTime) || departureTime < departingSoonReference || departureTime > departingSoonLimit)) return false;
      return true;
    });
  }, [activeDifficultyFilter, bossFilter, departingSoonOnly, departingSoonReference, eligibleOnly, myRates, nickname, openOnly, parties, profileMatchesNickname]);

  function selectBossFilter(value: string) {
    setBossFilter(value);
    setDifficultyFilter('all');
  }

  async function postAction(payload: Record<string, unknown>) {
    const response = await fetch('/api/parties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-nexon-api-key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as PartyActionResponse;
    if (!response.ok || !data.party) throw new Error(data.error ?? '파티 요청을 처리하지 못했습니다.');
    return data.party;
  }

  async function createParty(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBoss) return setNotice('보스와 난이도를 선택해 주세요.');
    setSubmitting(true);
    setNotice('');
    try {
      const party = await postAction({
        action: 'create',
        bossId: selectedBoss.id,
        capacity: selectedCapacity,
        minimumRate: Number(minimumRate),
        departureAt: new Date(departureAt).toISOString(),
        nickname: nickname.trim(),
        hexaStat,
      });
      setParties((current) => [party, ...current.filter((item) => item.id !== party.id)]);
      setSelectedParty(party);
      setCreateOpen(false);
      setDetailOpen(true);
      setNotice(`${party.difficulty} ${party.bossName} 파티를 만들었습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '파티를 만들지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function joinParty() {
    if (!selectedParty) return;
    setSubmitting(true);
    setNotice('');
    try {
      const party = await postAction({
        action: 'join',
        partyId: selectedParty.id,
        nickname: nickname.trim(),
        hexaStat,
      });
      setParties((current) => current.map((item) => item.id === party.id ? party : item));
      setSelectedParty(party);
      setNotice(`${party.difficulty} ${party.bossName} 파티에 가입했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '파티에 가입하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function openCreate() {
    if (!profileMatchesNickname) {
      setNotice('파티를 만들기 전에 현재 닉네임의 배율을 갱신해 주세요.');
      return;
    }
    if (profile.characterClass !== '비숍') {
      setNotice('현재 파티 배율 검증은 비숍만 지원합니다.');
      return;
    }
    setDepartureAt(localDateTimeValue());
    setBossPickerOpen(false);
    setNotice('');
    setCreateOpen(true);
  }

  function openDetail(party: PartyPost) {
    setSelectedParty(party);
    setNotice('');
    setDetailOpen(true);
  }

  const selectedMyRate = selectedParty ? myRates.get(selectedParty.bossId) : undefined;
  const alreadyJoined = selectedParty?.members.some((member) => member.nickname === nickname.trim()) ?? false;
  const canJoin = Boolean(
    selectedParty
    && selectedParty.status === 'open'
    && selectedParty.members.length < selectedParty.capacity
    && !alreadyJoined
    && profileMatchesNickname
    && (selectedMyRate ?? 0) >= selectedParty.minimumRate,
  );

  return (
    <>
      <section className="border-b border-[#dfe2e8] bg-white">
        <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">파티 모집</h1>
                <Badge variant="outline" className="rounded-sm border-emerald-200 bg-emerald-50 text-emerald-700">모집 중 {parties.filter((party) => party.status === 'open' && party.members.length < party.capacity).length}</Badge>
              </div>
              <p className="mt-1 text-sm text-[#687080]">보스 배율이 맞는 파티를 찾고 출발 시간을 예약하세요.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[170px_150px_auto_auto]">
              <Input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" placeholder="캐릭터 닉네임" aria-label="캐릭터 닉네임" />
              <Input inputMode="numeric" value={hexaInput ? Number(hexaInput).toLocaleString() : ''} onChange={(event) => onHexaChange(event.target.value.replace(/[^0-9]/g, ''))} className="h-10 rounded-md border-[#ccd1d9] tabular-nums" placeholder="헥사환산" aria-label="헥사환산" />
              <Button type="button" variant="outline" disabled={characterLoading} onClick={() => void onLookup()} className="h-10 rounded-md border-[#ccd1d9]"><RefreshCw className={`size-4 ${characterLoading ? 'animate-spin' : ''}`} />{characterLoading ? '조회 중' : '내 배율 갱신'}</Button>
              <Button type="button" onClick={openCreate} className="h-10 rounded-md bg-[#eb5b35] px-4 font-semibold hover:bg-[#d94d2a]"><Plus className="size-4" /> 파티 만들기</Button>
            </div>
          </div>
          <div className={`mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${profileMatchesNickname ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <p className="flex items-center gap-1.5"><ShieldCheck className="size-4" />{profileMatchesNickname ? `${profile.nickname} · ${profile.characterClass} Lv.${profile.level} · 헥환 ${hexaStat.toLocaleString()}` : `현재 배율은 ${profile.nickname} 기준입니다. 새 닉네임을 조회해 주세요.`}</p>
            <Button type="button" variant="ghost" size="sm" onClick={onOpenCalculator} className="h-6 px-2 text-xs">전체 배율 보기</Button>
          </div>
          {notice && <p className="mt-2 rounded-md border border-[#dfe2e8] bg-[#fafbfc] px-3 py-2 text-xs font-medium text-[#535b68]" aria-live="polite">{notice}</p>}
        </div>
      </section>

      <section className="border-b border-[#dfe2e8] bg-[#fbfbfc]">
        <div className="mx-auto max-w-[1540px] px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold text-[#343a44]">보스 선택</h2>
              <p className="mt-0.5 text-[11px] text-[#858c97]">현재 등록된 모집글 기준</p>
            </div>
            <p className="shrink-0 text-xs font-semibold tabular-nums text-[#687080]">{visibleParties.length}개 파티</p>
          </div>

          <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
            <div className="flex min-w-max gap-2">
              <button
                type="button"
                aria-pressed={bossFilter === 'all'}
                onClick={() => selectBossFilter('all')}
                className={`relative flex w-[74px] flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eb5b35]/40 ${bossFilter === 'all' ? 'border-[#eb5b35] bg-[#fff5f1] text-[#c74928]' : 'border-[#dfe2e8] bg-white text-[#626a77] hover:border-[#bec4ce]'}`}
              >
                <span className="grid size-[52px] place-items-center rounded-md bg-[#252a32] text-white"><LayoutGrid className="size-5" /></span>
                <span>전체</span>
                <span className="absolute right-1 top-1 min-w-5 rounded-full border-2 border-white bg-[#20242c] px-1 text-center text-[10px] leading-4 text-white">{parties.length}</span>
              </button>
              {bossFilterOptions.map((boss) => {
                const selected = bossFilter === boss.name;
                return (
                  <button
                    key={boss.name}
                    type="button"
                    title={boss.name}
                    aria-pressed={selected}
                    onClick={() => selectBossFilter(boss.name)}
                    className={`relative flex w-[74px] flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#eb5b35]/40 ${selected ? 'border-[#eb5b35] bg-[#fff5f1] text-[#c74928]' : 'border-[#dfe2e8] bg-white text-[#626a77] hover:border-[#bec4ce]'}`}
                  >
                    {boss.image
                      ? <Image src={boss.image} alt={boss.name} width={52} height={52} className="size-[52px] rounded-md border border-[#d7dbe2] object-cover" />
                      : <span className="grid size-[52px] place-items-center rounded-md bg-[#252a32] px-1 text-center text-[10px] font-bold text-white">{boss.name}</span>}
                    <span className="w-full truncate">{boss.name}</span>
                    <span className={`absolute right-1 top-1 min-w-5 rounded-full border-2 border-white px-1 text-center text-[10px] leading-4 text-white ${selected ? 'bg-[#eb5b35]' : 'bg-[#20242c]'}`}>{boss.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e4e9] pt-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-md border border-[#d7dbe2] bg-white p-1">
                {['all', ...difficultyFilterOptions].map((difficulty) => {
                  const selected = activeDifficultyFilter === difficulty;
                  return (
                    <Button key={difficulty} type="button" variant="ghost" size="sm" onClick={() => setDifficultyFilter(difficulty)} className={`h-7 rounded-sm px-2.5 text-xs ${selected ? 'bg-[#20242c] text-white hover:bg-[#20242c] hover:text-white' : 'text-[#626a77]'}`}>
                      {difficulty === 'all' ? '전체 난이도' : difficulty}
                    </Button>
                  );
                })}
              </div>
              <Toggle pressed={eligibleOnly} onPressedChange={setEligibleOnly} variant="outline" size="sm" className={`h-9 rounded-md px-3 text-xs ${eligibleOnly ? 'border-[#eb5b35] bg-[#fff0eb] text-[#c74928]' : 'border-[#d7dbe2] bg-white text-[#626a77]'}`}><UserRoundCheck className="size-3.5" />가입 가능</Toggle>
              <Toggle pressed={openOnly} onPressedChange={setOpenOnly} variant="outline" size="sm" className={`h-9 rounded-md px-3 text-xs ${openOnly ? 'border-[#eb5b35] bg-[#fff0eb] text-[#c74928]' : 'border-[#d7dbe2] bg-white text-[#626a77]'}`}><Users className="size-3.5" />자리 있음</Toggle>
              <Toggle pressed={departingSoonOnly} onPressedChange={(pressed) => { setDepartingSoonOnly(pressed); if (pressed) setDepartingSoonReference(Date.now()); }} variant="outline" size="sm" className={`h-9 rounded-md px-3 text-xs ${departingSoonOnly ? 'border-[#eb5b35] bg-[#fff0eb] text-[#c74928]' : 'border-[#d7dbe2] bg-white text-[#626a77]'}`}><CalendarClock className="size-3.5" />3시간 이내</Toggle>
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={listLoading} onClick={() => void refreshParties()} className="h-8 rounded-md text-xs text-[#737b87]"><RefreshCw className={`size-3.5 ${listLoading ? 'animate-spin' : ''}`} />새로고침</Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6">
        {listLoading ? (
          <div className="grid min-h-48 place-items-center border-y border-[#dfe2e8] text-sm text-[#737b87]">모집 중인 파티를 불러오는 중입니다.</div>
        ) : visibleParties.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleParties.map((party) => {
              const boss = partyBosses.find((item) => item.id === party.bossId);
              const myRate = myRates.get(party.bossId);
              const eligible = profileMatchesNickname && (myRate ?? 0) >= party.minimumRate;
              return (
                <article key={party.id} className="rounded-lg border border-[#dfe2e8] bg-white p-4">
                  <div className="flex items-start gap-3">
                    {boss?.image ? <Image src={boss.image} alt={`${party.difficulty} ${party.bossName}`} width={72} height={72} className="size-[72px] rounded-md border border-[#d8dce2] object-cover" /> : <div className="grid size-[72px] place-items-center rounded-md bg-[#252a32] text-xs font-bold text-white">{party.bossName}</div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="text-[11px] font-bold text-[#d85432]">{party.difficulty}</p><h2 className="truncate text-base font-bold">{party.bossName}</h2></div>
                        <Badge variant="outline" className={party.status === 'full' ? 'rounded-sm border-slate-200 bg-slate-50 text-slate-600' : 'rounded-sm border-emerald-200 bg-emerald-50 text-emerald-700'}>{party.status === 'full' ? '모집 완료' : '모집 중'}</Badge>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#4d5562]"><CalendarClock className="size-3.5 text-[#7a818d]" />{departureLabel(party.departureAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-4 divide-x divide-[#e3e6eb] border-y border-[#e3e6eb] py-3 text-center">
                    <div><p className="text-[10px] text-[#818894]">최소 배율</p><p className="mt-0.5 text-sm font-bold tabular-nums">{rateLabel(party.minimumRate)}</p></div>
                    <div><p className="text-[10px] text-[#818894]">파티 배율</p><p className="mt-0.5 text-sm font-bold tabular-nums text-[#1f5ed5]">{rateLabel(party.totalRate)}</p></div>
                    <div><p className="text-[10px] text-[#818894]">현재 인원</p><p className="mt-0.5 text-sm font-bold tabular-nums">{party.members.length}/{party.capacity}</p></div>
                    <div><p className="text-[10px] text-[#818894]">내 배율</p><p className={`mt-0.5 text-sm font-bold tabular-nums ${eligible ? 'text-emerald-700' : 'text-[#687080]'}`}>{profileMatchesNickname && myRate != null ? rateLabel(myRate) : '-'}</p></div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs text-[#737b87]">파티장 <strong className="text-[#454c57]">{party.leaderNickname}</strong></p>
                    <Button type="button" variant="outline" size="sm" onClick={() => openDetail(party)} className="h-8 rounded-md border-[#ccd1d9] text-xs"><Users className="size-3.5" />상세 보기</Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid min-h-64 place-items-center border-y border-[#dfe2e8] bg-white px-4 text-center">
            <div><Users className="mx-auto size-7 text-[#9299a4]" /><p className="mt-3 text-sm font-bold">조건에 맞는 파티가 없습니다.</p><p className="mt-1 text-xs text-[#737b87]">첫 모집을 만들거나 다른 조건을 확인해 보세요.</p><Button type="button" onClick={openCreate} className="mt-4 h-9 rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]"><Plus className="size-4" /> 파티 만들기</Button></div>
          </div>
        )}
      </section>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setBossPickerOpen(false); }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg sm:max-w-lg">
          <DialogHeader><DialogTitle>파티 만들기</DialogTitle><DialogDescription>파티장 배율도 같은 최소 조건으로 서버에서 다시 확인합니다.</DialogDescription></DialogHeader>
          <form onSubmit={createParty} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p id="party-boss-label" className="text-xs font-semibold text-[#535b68]">보스</p>
                <Popover open={bossPickerOpen} onOpenChange={setBossPickerOpen}>
                  <PopoverTrigger
                    aria-labelledby="party-boss-label"
                    className="flex h-[72px] w-full items-center gap-3 rounded-md border border-[#ccd1d9] bg-white px-3 text-left outline-none transition-colors hover:border-[#9fa6b1] focus-visible:ring-2 focus-visible:ring-[#eb5b35]/30"
                  >
                    {selectedBoss?.image
                      ? <Image src={selectedBoss.image} alt="" width={54} height={54} className="size-[54px] shrink-0 rounded-md border border-[#d7dbe2] object-cover" />
                      : <span className="grid size-[54px] shrink-0 place-items-center rounded-md bg-[#252a32] px-1 text-center text-[10px] font-bold text-white">{bossName}</span>}
                    <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#8a919d]">선택한 보스</span><strong className="mt-0.5 block truncate text-sm text-[#252a32]">{bossName}</strong></span>
                    <ChevronDown className={`size-4 shrink-0 text-[#747b88] transition-transform ${bossPickerOpen ? 'rotate-180' : ''}`} />
                  </PopoverTrigger>
                  <PopoverContent align="start" sideOffset={6} className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[#d7dbe2] bg-white p-3 shadow-xl">
                    <PopoverHeader className="px-1 pb-1"><PopoverTitle className="text-sm font-bold">보스 선택</PopoverTitle></PopoverHeader>
                    <ScrollArea className="h-[292px] pr-2">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {createBossOptions.map((boss) => {
                          const selected = bossName === boss.name;
                          return (
                            <button
                              key={boss.name}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => changeBossName(boss.name)}
                              className={`relative flex min-h-[92px] flex-col items-center justify-center gap-1.5 rounded-md border p-2 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#eb5b35]/30 ${selected ? 'border-[#eb5b35] bg-[#fff4ef]' : 'border-[#dfe2e8] bg-white hover:border-[#b6bcc6] hover:bg-[#fafbfc]'}`}
                            >
                              {boss.image
                                ? <Image src={boss.image} alt="" width={58} height={58} className="size-[58px] rounded-md border border-[#d7dbe2] object-cover" />
                                : <span className="grid size-[58px] place-items-center rounded-md bg-[#252a32] px-1 text-[10px] font-bold text-white">{boss.name}</span>}
                              <span className={`w-full truncate text-xs font-bold ${selected ? 'text-[#c74928]' : 'text-[#454c57]'}`}>{boss.name}</span>
                              {selected && <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-[#eb5b35] text-white"><Check className="size-3" /></span>}
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-xs font-semibold text-[#535b68]">난이도</legend>
                <div className="flex flex-wrap gap-2">
                  {difficultyOptions.map((boss) => {
                    const selected = selectedBoss?.id === boss.id;
                    const style = difficultyStyles[boss.difficulty] ?? { active: 'border-[#343a44] bg-[#343a44] text-white', idle: 'border-[#cdd1d8] bg-[#f7f8f9] text-[#535b68]' };
                    return (
                      <button
                        key={boss.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setBossId(boss.id)}
                        className={`h-9 min-w-[82px] rounded-full border px-4 text-xs font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#eb5b35]/30 ${selected ? style.active : style.idle}`}
                      >
                        {boss.difficulty}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label htmlFor="party-capacity" className="space-y-1.5 text-xs font-semibold text-[#535b68]">총 인원<NativeSelect id="party-capacity" value={String(selectedCapacity)} onChange={(event) => setCapacity(event.target.value)} className="h-10 rounded-md border-[#ccd1d9] bg-white">{Array.from({ length: Math.max(0, (selectedBoss?.partyLimit ?? 2) - 1) }, (_, index) => index + 2).map((count) => <NativeSelectOption key={count} value={String(count)}>{count}명</NativeSelectOption>)}</NativeSelect></label>
              <label htmlFor="party-minimum-rate" className="space-y-1.5 text-xs font-semibold text-[#535b68]">최소 배율<Input id="party-minimum-rate" type="number" min="1" max="1000" step="0.1" value={minimumRate} onChange={(event) => setMinimumRate(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /></label>
            </div>
            <label htmlFor="party-departure" className="block space-y-1.5 text-xs font-semibold text-[#535b68]">출발 시간<Input id="party-departure" type="datetime-local" value={departureAt} onChange={(event) => setDepartureAt(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /></label>
            <div className="rounded-md border border-[#dfe2e8] bg-[#fafbfc] px-3 py-2 text-xs text-[#687080]">파티장 {nickname || '-'} · 헥환 {hexaStat.toLocaleString()} · 선택 보스 배율 {selectedBoss ? rateLabel(selectedBoss.rate) : '-'}</div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-md">취소</Button><Button type="submit" disabled={submitting} className="rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]">{submitting ? '검증 중' : '모집 시작'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg sm:max-w-lg">
          {selectedParty && <>
            <DialogHeader><DialogTitle>{selectedParty.difficulty} {selectedParty.bossName}</DialogTitle><DialogDescription>{departureLabel(selectedParty.departureAt)} 출발 · 최소 {rateLabel(selectedParty.minimumRate)}</DialogDescription></DialogHeader>
            <div className="grid grid-cols-4 divide-x divide-[#e3e6eb] border-y border-[#e3e6eb] py-3 text-center">
              <div><p className="text-[10px] text-[#818894]">현재 인원</p><p className="mt-0.5 text-sm font-bold">{selectedParty.members.length}/{selectedParty.capacity}</p></div>
              <div><p className="text-[10px] text-[#818894]">파티 배율</p><p className="mt-0.5 text-sm font-bold text-[#1f5ed5]">{rateLabel(selectedParty.totalRate)}</p></div>
              <div><p className="text-[10px] text-[#818894]">내 배율</p><p className="mt-0.5 text-sm font-bold">{selectedMyRate == null ? '-' : rateLabel(selectedMyRate)}</p></div>
              <div><p className="text-[10px] text-[#818894]">남은 자리</p><p className="mt-0.5 text-sm font-bold">{Math.max(0, selectedParty.capacity - selectedParty.members.length)}명</p></div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-[#535b68]">참가자</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {selectedParty.members.map((member) => {
                  const characterImage = member.nickname === profile.nickname ? profile.image ?? member.characterImage : member.characterImage;
                  return <article key={member.id} className="rounded-lg border border-[#dfe2e8] bg-white px-3 pb-3.5 pt-4 text-center">
                    <div className="relative mx-auto size-40 overflow-hidden rounded-full border border-[#d8dce2] bg-[#f3f5f7]">
                      {characterImage ? <Image unoptimized src={characterImage} alt={`${member.nickname} 캐릭터`} width={300} height={300} className="absolute left-1/2 top-1/2 size-[300px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" /> : <div className="grid size-full place-items-center text-[#8a919d]"><CircleUserRound className="size-10" /></div>}
                    </div>
                    <div className="pt-3">
                      <div className="flex items-center justify-center gap-2">
                        <h3 className="min-w-0 truncate text-base font-bold">{member.nickname}</h3>
                        {member.role === 'leader' && <Badge variant="outline" className="shrink-0 rounded-sm border-amber-200 bg-amber-50 text-amber-700">파티장</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-[#747b88]">{member.characterClass} · Lv.{member.characterLevel}</p>
                      <div className="mt-3 space-y-1.5 border-t border-[#eceef1] pt-3 text-xs">
                        <div className="flex items-center justify-between gap-3"><span className="text-[#818894]">헥환</span><strong className="tabular-nums">{member.hexaStat.toLocaleString()}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-[#818894]">보스 배율</span><strong className="tabular-nums text-[#1f5ed5]">{rateLabel(member.verifiedRate)}</strong></div>
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            </div>
            <div className={`rounded-md border px-3 py-2 text-xs ${canJoin ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#dfe2e8] bg-[#fafbfc] text-[#687080]'}`}>
              {alreadyJoined ? '이미 이 파티에 참가 중입니다.' : !profileMatchesNickname ? '현재 닉네임을 먼저 조회해 주세요.' : selectedParty.status === 'full' ? '모집이 완료된 파티입니다.' : canJoin ? <span className="flex items-center gap-1.5"><UserRoundCheck className="size-4" />가입 조건을 충족합니다.</span> : `내 배율이 최소 조건보다 ${rateLabel(Math.max(0, selectedParty.minimumRate - (selectedMyRate ?? 0)))} 부족합니다.`}
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setDetailOpen(false)} className="rounded-md">닫기</Button><Button type="button" disabled={!canJoin || submitting} onClick={() => void joinParty()} className="rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]"><Check className="size-4" />{submitting ? '검증 중' : '가입하기'}</Button></DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
