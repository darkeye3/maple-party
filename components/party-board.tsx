'use client';

import Image from 'next/image';
import { SyntheticEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, ChevronDown, CircleUserRound, Coins, Copy, Crown, LayoutGrid, LinkIcon, LogIn, LogOut, Plus, RefreshCw, ShieldCheck, Swords, Target, Trash2, UserRoundCheck, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toggle } from '@/components/ui/toggle';
import type { AuthUser } from '@/lib/auth';
import type { RegisteredCharacter, RegisteredCharactersResponse } from '@/lib/characters';
import type { BossResult, CharacterProfile } from '@/lib/model';
import type { CombatRole, PartyActionResponse, PartyPost, RewardPreset } from '@/lib/parties';
import { cn } from '@/lib/utils';

const DEPARTING_SOON_MS = 3 * 60 * 60_000;
const USE_BOSS_SELECTOR_ICONS = true;
const CROP_FALLBACK_BOSS_SELECTION_ICONS = true;
const BOSS_SELECTION_IMAGE_BY_NAME: Record<string, string> = {
  '유피테르': '/boss-selector-icons/jupiter.png',
  '카링': '/boss-selector-icons/kaling.png',
  '감시자 칼로스': '/boss-selector-icons/kalos.png',
  '벨로나': '/boss-selector-icons/bellona.png',
  '림보': '/boss-selector-icons/limbo.png',
  '흉성': '/boss-selector-icons/malefic-star.png',
  '선택받은 세렌': '/boss-selector-icons/seren.png',
  '검은 마법사': '/boss-selector-icons/black-mage.png',
  '스우': '/boss-selector-icons/lotus.png',
  '대적자': '/boss-selector-icons/first-adversary.png',
};
const difficultyStyles: Record<string, { active: string; idle: string }> = {
  익스트림: { active: 'border-[#e55c37] bg-[#e55c37] text-white', idle: 'border-[#f1b4a4] bg-[#fff3ef] text-[#c84725]' },
  데스티니: { active: 'border-[#7155c5] bg-[#7155c5] text-white', idle: 'border-[#c8bcec] bg-[#f5f2ff] text-[#5a3cad]' },
  카오스: { active: 'border-[#9850ac] bg-[#9850ac] text-white', idle: 'border-[#d7b7df] bg-[#faf2fc] text-[#7c378e]' },
  하드: { active: 'border-[#c63b67] bg-[#c63b67] text-white', idle: 'border-[#e8aabd] bg-[#fff0f5] text-[#a9254e]' },
  노멀: { active: 'border-[#36abc4] bg-[#36abc4] text-white', idle: 'border-[#9fd7e3] bg-[#edfafd] text-[#18829a]' },
  이지: { active: 'border-[#35a46d] bg-[#35a46d] text-white', idle: 'border-[#a5d9bf] bg-[#effaf4] text-[#237b50]' },
  챔피언: { active: 'border-[#d28a22] bg-[#d28a22] text-white', idle: 'border-[#ebca91] bg-[#fff8eb] text-[#a86a12]' },
};
const partyDifficultyOrder = ['익스트림', '데스티니', '카오스', '하드', '노멀', '이지', '챔피언'];

function partyDifficultyRank(difficulty: string) {
  const index = partyDifficultyOrder.indexOf(difficulty);
  return index === -1 ? partyDifficultyOrder.length : index;
}

function comparePartyDifficulty(a: BossResult, b: BossResult) {
  const byPersonalRate = a.rate - b.rate;
  if (Math.abs(byPersonalRate) > 0.001) return byPersonalRate;
  return partyDifficultyRank(a.difficulty) - partyDifficultyRank(b.difficulty);
}

const rewardOptions: { value: RewardPreset; title: string; description: string }[] = [
  { value: 'equal_all', title: '공평 분배', description: '전원 물욕템 참여 · 결정석 1/N' },
  { value: 'main_loot_equal_crystal', title: '보조격수 동행', description: '물욕템 메인만 · 결정석 전원 1/N' },
  { value: 'main_loot_adjusted_crystal', title: '보조격수 정산', description: '물욕템 메인만 · 보조 결정석 일부 정산' },
];

function bossSelectionAsset(name: string, fallbackImage?: string) {
  const selectorImage = BOSS_SELECTION_IMAGE_BY_NAME[name];
  if (USE_BOSS_SELECTOR_ICONS && selectorImage) return { src: selectorImage, cropFallback: false };
  return { src: fallbackImage, cropFallback: CROP_FALLBACK_BOSS_SELECTION_ICONS };
}

function BossSelectionImage({ src, alt, className, eager = false, cropFallback = false }: { src: string; alt: string; className?: string; eager?: boolean; cropFallback?: boolean }) {
  return (
    <span className={cn('relative block shrink-0', className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="72px"
        loading={eager ? 'eager' : 'lazy'}
        className={cn(
          cropFallback ? 'origin-top scale-[1.56] object-cover' : 'object-contain drop-shadow-[0_1px_1px_rgba(15,18,24,0.35)]',
        )}
      />
    </span>
  );
}

type PartyBoardProps = {
  profile: CharacterProfile;
  nickname: string;
  hexaInput: string;
  hexaStat: number;
  profileMatchesNickname: boolean;
  characterLoading: boolean;
  bossResults: BossResult[];
  apiKey: string;
  authUser: AuthUser | null;
  onNicknameChange: (value: string) => void;
  onHexaChange: (value: string) => void;
  onLookup: () => Promise<void>;
  onUseRegisteredCharacter: (character: RegisteredCharacter) => Promise<void>;
  onOpenCalculator: () => void;
  onRequireAuth: (message: string) => void;
};

function localDateTimeFromDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function roundedLocalDateTime(offsetMs: number, direction: 'ceil' | 'floor') {
  const unit = 10 * 60_000;
  const value = Date.now() + offsetMs;
  return localDateTimeFromDate(new Date((direction === 'ceil' ? Math.ceil(value / unit) : Math.floor(value / unit)) * unit));
}

function localDateTimeValue(offsetHours = 2) {
  return roundedLocalDateTime(offsetHours * 60 * 60_000, 'ceil');
}

function createDepartureBounds() {
  return {
    min: roundedLocalDateTime(10 * 60_000, 'ceil'),
    max: roundedLocalDateTime(30 * 24 * 60 * 60_000, 'floor'),
  };
}

function hourLabel(hour: number) {
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour % 12 || 12;
  return `${period} ${displayHour}시`;
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

function isRoleContract(party: PartyPost) {
  return party.formatVersion === 'role_contract_v2';
}

function roleLabel(role: CombatRole) {
  return role === 'main_dealer' ? '메인격수' : '보조격수';
}

function roleCapacity(party: PartyPost, role: CombatRole) {
  return role === 'main_dealer' ? party.mainCapacity ?? 0 : party.secondaryCapacity ?? 0;
}

function roleMinimumRate(party: PartyPost, role: CombatRole) {
  return role === 'main_dealer' ? party.mainMinimumRate ?? 0 : party.secondaryMinimumRate ?? 0;
}

function roleMemberCount(party: PartyPost, role: CombatRole) {
  return party.members.filter((member) => member.combatRole === role).length;
}

function roleHasSeat(party: PartyPost, role: CombatRole) {
  return party.status === 'open' && roleMemberCount(party, role) < roleCapacity(party, role);
}

function availableRoleForRate(party: PartyPost, rate: number | undefined) {
  if (!isRoleContract(party)) return party.status === 'open' && party.members.length < party.capacity && (rate ?? 0) >= party.minimumRate;
  return (['main_dealer', 'secondary_dealer'] as CombatRole[]).some((role) => (
    roleHasSeat(party, role) && (rate ?? 0) >= roleMinimumRate(party, role)
  ));
}

function rewardLabel(party: PartyPost) {
  if (party.rewardPreset === 'equal_all') return '물욕 전원 · 결정석 1/N';
  if (party.rewardPreset === 'main_loot_adjusted_crystal') return `물욕 메인 · 보조 ${party.secondaryCrystalShare ?? 0}%`;
  return '물욕 메인 · 결정석 1/N';
}

function memberRewardSummary(party: PartyPost, role: CombatRole) {
  if (party.rewardPreset === 'equal_all') return '물욕템 분배에 참여하고 결정석은 전원 1/N으로 정산합니다.';
  if (role === 'main_dealer') return '물욕템 분배에 참여하고 결정석은 1/N으로 정산합니다.';
  if (party.rewardPreset === 'main_loot_adjusted_crystal') {
    const share = party.secondaryCrystalShare ?? 0;
    return `물욕템 분배에는 참여하지 않으며, 결정석 1/N 몫의 ${share}%를 받고 ${100 - share}%를 정산합니다.`;
  }
  return '물욕템 분배에는 참여하지 않으며, 결정석은 1/N으로 정산합니다.';
}

async function fetchPartyList(signal?: AbortSignal) {
  const response = await fetch('/api/parties', { cache: 'no-store', credentials: 'same-origin', signal });
  const data = await response.json() as { parties?: PartyPost[]; error?: string };
  if (!response.ok) throw new Error(data.error ?? '파티 목록을 불러오지 못했습니다.');
  return data.parties ?? [];
}

async function fetchRegisteredCharacters(signal?: AbortSignal) {
  const response = await fetch('/api/my-characters', { cache: 'no-store', credentials: 'same-origin', signal });
  const data = await response.json() as RegisteredCharactersResponse;
  if (!response.ok) throw new Error(data.error ?? '내 캐릭터를 불러오지 못했습니다.');
  return data.characters ?? [];
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
  authUser,
  onNicknameChange,
  onHexaChange,
  onLookup,
  onUseRegisteredCharacter,
  onOpenCalculator,
  onRequireAuth,
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
  const directPartyCodeRef = useRef<string | null>(null);
  const [registeredCharacters, setRegisteredCharacters] = useState<RegisteredCharacter[]>([]);
  const [charactersLoading, setCharactersLoading] = useState(false);
  const [charactersSubmitting, setCharactersSubmitting] = useState(false);
  const [bossName, setBossName] = useState(bossNames[0] ?? '');
  const difficultyOptions = useMemo(() => (
    partyBosses
      .filter((boss) => boss.name === bossName)
      .sort(comparePartyDifficulty)
  ), [bossName, partyBosses]);
  const [bossId, setBossId] = useState(difficultyOptions[0]?.id ?? '');
  const selectedBoss = partyBosses.find((boss) => boss.id === bossId) ?? difficultyOptions[0];
  const selectedBossSelectionAsset = bossSelectionAsset(selectedBoss?.name ?? bossName, selectedBoss?.image);
  const [capacity, setCapacity] = useState('6');
  const [requiredPartyRate, setRequiredPartyRate] = useState('130');
  const [secondaryEnabled, setSecondaryEnabled] = useState(false);
  const [mainCapacity, setMainCapacity] = useState('2');
  const [mainMinimumRate, setMainMinimumRate] = useState('40');
  const [secondaryMinimumRate, setSecondaryMinimumRate] = useState('15');
  const [leaderCombatRole, setLeaderCombatRole] = useState<CombatRole>('main_dealer');
  const [rewardPreset, setRewardPreset] = useState<RewardPreset>('main_loot_equal_crystal');
  const [secondaryCrystalShare, setSecondaryCrystalShare] = useState('70');
  const [selectedJoinRole, setSelectedJoinRole] = useState<CombatRole>('main_dealer');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [departureBounds, setDepartureBounds] = useState(createDepartureBounds);
  const [departureAt, setDepartureAt] = useState(localDateTimeValue());
  const selectedCapacity = Math.min(Math.max(Number(capacity) || 2, 2), selectedBoss?.partyLimit ?? 2);
  const selectedMainCapacity = secondaryEnabled
    ? Math.min(Math.max(Number(mainCapacity) || 1, 1), Math.max(1, selectedCapacity - 1))
    : selectedCapacity;
  const selectedSecondaryCapacity = secondaryEnabled ? selectedCapacity - selectedMainCapacity : 0;
  const effectiveLeaderCombatRole = selectedSecondaryCapacity > 0 ? leaderCombatRole : 'main_dealer';
  const effectiveRewardPreset: RewardPreset = secondaryEnabled ? rewardPreset : 'equal_all';
  const effectiveSecondaryMinimumRate = secondaryEnabled ? Number(secondaryMinimumRate) : 0;
  const effectiveSecondaryCrystalShare = secondaryEnabled && effectiveRewardPreset === 'main_loot_adjusted_crystal'
    ? Number(secondaryCrystalShare)
    : 100;
  const createBossOptions = useMemo(() => bossNames.map((name) => {
    const options = partyBosses.filter((boss) => boss.name === name);
    const image = options.find((boss) => boss.image)?.image;
    const asset = bossSelectionAsset(name, image);
    return { name, image: asset.src, cropFallback: asset.cropFallback };
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
    if (!authUser) {
      setRegisteredCharacters([]);
      return;
    }
    const controller = new AbortController();
    setCharactersLoading(true);
    fetchRegisteredCharacters(controller.signal)
      .then((items) => setRegisteredCharacters(items))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : '내 캐릭터를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCharactersLoading(false);
      });
    return () => controller.abort();
  }, [authUser]);

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
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error ?? '캐릭터 이미지를 동기화하지 못했습니다.');
      })
      .then(() => setParties((current) => current.map((party) => ({
        ...party,
        members: party.members.map((member) => member.nickname === profile.nickname
          ? { ...member, characterImage: profile.image }
          : member),
      }))))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : '캐릭터 이미지를 동기화하지 못했습니다.');
      });
    return () => controller.abort();
  }, [profile.image, profile.nickname, profileMatchesNickname]);

  function changeBossName(value: string) {
    setBossName(value);
    const firstDifficulty = partyBosses
      .filter((boss) => boss.name === value)
      .sort(comparePartyDifficulty)[0];
    setBossId(firstDifficulty?.id ?? '');
    setBossPickerOpen(false);
  }

  function updateDeparturePart(part: 'date' | 'hour' | 'minute', value: string) {
    const [currentDate, currentTime = '00:00'] = departureAt.split('T');
    const [currentHour = '00', currentMinute = '00'] = currentTime.split(':');
    const next = `${part === 'date' ? value : currentDate}T${part === 'hour' ? value : currentHour}:${part === 'minute' ? value : currentMinute}`;
    setDepartureAt(next < departureBounds.min ? departureBounds.min : next > departureBounds.max ? departureBounds.max : next);
  }

  const myRates = useMemo(() => new Map(partyBosses.map((boss) => [boss.id, boss.rate])), [partyBosses]);
  const bossFilterOptions = useMemo(() => {
    const options = new Map<string, { name: string; image?: string; cropFallback: boolean; count: number }>();

    for (const party of parties) {
      const current = options.get(party.bossName);
      const matchedBoss = partyBosses.find((boss) => boss.id === party.bossId);
      const image = matchedBoss?.image ?? partyBosses.find((boss) => boss.name === party.bossName && boss.image)?.image;
      const asset = bossSelectionAsset(party.bossName, image);

      options.set(party.bossName, {
        name: party.bossName,
        image: current?.image ?? asset.src,
        cropFallback: current?.cropFallback ?? asset.cropFallback,
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
      const hasSeat = isRoleContract(party)
        ? roleHasSeat(party, 'main_dealer') || roleHasSeat(party, 'secondary_dealer')
        : party.status === 'open' && party.members.length < party.capacity;
      const departureTime = new Date(party.departureAt).getTime();
      const canJoinParty = Boolean(authUser)
        && profileMatchesNickname
        && hasSeat
        && !party.members.some((member) => member.nickname === nicknameValue)
        && availableRoleForRate(party, myRates.get(party.bossId));

      if (bossFilter !== 'all' && party.bossName !== bossFilter) return false;
      if (activeDifficultyFilter !== 'all' && party.difficulty !== activeDifficultyFilter) return false;
      if (eligibleOnly && !canJoinParty) return false;
      if (openOnly && !hasSeat) return false;
      if (departingSoonOnly && (!Number.isFinite(departureTime) || departureTime < departingSoonReference || departureTime > departingSoonLimit)) return false;
      return true;
    });
  }, [activeDifficultyFilter, authUser, bossFilter, departingSoonOnly, departingSoonReference, eligibleOnly, myRates, nickname, openOnly, parties, profileMatchesNickname]);

  function selectBossFilter(value: string) {
    setBossFilter(value);
    setDifficultyFilter('all');
  }

  async function postPartyAction(payload: Record<string, unknown>) {
    const response = await fetch('/api/parties', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-nexon-api-key': apiKey } : {}),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json() as PartyActionResponse;
    if (!response.ok) throw new Error(data.error ?? '파티 요청을 처리하지 못했습니다.');
    return data;
  }

  async function postAction(payload: Record<string, unknown>) {
    const data = await postPartyAction(payload);
    if (!data.party) throw new Error(data.error ?? '파티 요청을 처리하지 못했습니다.');
    return data.party;
  }

  async function createParty(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser) return onRequireAuth('파티 모집은 로그인 후 만들 수 있습니다.');
    if (!selectedBoss) return setNotice('보스와 난이도를 선택해 주세요.');
    setSubmitting(true);
    setNotice('');
    try {
      const party = await postAction({
        action: 'create',
        formatVersion: 'role_contract_v2',
        bossId: selectedBoss.id,
        capacity: selectedCapacity,
        requiredPartyRate: Number(requiredPartyRate),
        mainCapacity: selectedMainCapacity,
        mainMinimumRate: Number(mainMinimumRate),
        secondaryMinimumRate: effectiveSecondaryMinimumRate,
        leaderCombatRole: effectiveLeaderCombatRole,
        rewardPreset: effectiveRewardPreset,
        secondaryCrystalShare: effectiveSecondaryCrystalShare,
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
    if (!authUser) return onRequireAuth('파티 가입은 로그인 후 이용할 수 있습니다.');
    setSubmitting(true);
    setNotice('');
    try {
      const party = await postAction({
        action: 'join',
        partyId: selectedParty.id,
        nickname: nickname.trim(),
        hexaStat,
        combatRole: isRoleContract(selectedParty) ? selectedJoinRole : undefined,
        termsVersion: selectedParty.termsVersion,
        termsAccepted: isRoleContract(selectedParty) ? termsAccepted : undefined,
      });
      setParties((current) => current.map((item) => item.id === party.id ? party : item));
      setSelectedParty(party);
      setTermsAccepted(false);
      setNotice(`${party.difficulty} ${party.bossName} 파티에 가입했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '파티에 가입하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function leaveParty() {
    if (!selectedParty) return;
    if (!authUser) return onRequireAuth('파티 탈퇴는 로그인 후 이용할 수 있습니다.');
    if (!window.confirm(`${selectedParty.difficulty} ${selectedParty.bossName} 파티에서 탈퇴할까요?`)) return;
    setSubmitting(true);
    setNotice('');
    try {
      const data = await postPartyAction({
        action: 'leave',
        partyId: selectedParty.id,
        nickname: nickname.trim(),
        hexaStat,
      });
      if (!data.party) throw new Error(data.error ?? '파티 탈퇴 결과를 확인하지 못했습니다.');
      const updatedParty = data.party;
      setParties((current) => current.map((item) => item.id === updatedParty.id ? updatedParty : item));
      setSelectedParty(updatedParty);
      setNotice(`${updatedParty.difficulty} ${updatedParty.bossName} 파티에서 탈퇴했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '파티에서 탈퇴하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteParty() {
    if (!selectedParty) return;
    if (!authUser) return onRequireAuth('모집 삭제는 로그인 후 이용할 수 있습니다.');
    if (!window.confirm(`${selectedParty.difficulty} ${selectedParty.bossName} 모집 글을 삭제할까요?`)) return;
    setSubmitting(true);
    setNotice('');
    try {
      const data = await postPartyAction({
        action: 'delete',
        partyId: selectedParty.id,
        nickname: nickname.trim(),
        hexaStat,
      });
      setParties((current) => data.parties ?? current.filter((item) => item.id !== selectedParty.id));
      setSelectedParty(null);
      setDetailOpen(false);
      setNotice(`${selectedParty.difficulty} ${selectedParty.bossName} 모집 글을 삭제했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '모집 글을 삭제하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  function openCreate() {
    if (!authUser) {
      onRequireAuth('파티 모집은 로그인 후 만들 수 있습니다.');
      return;
    }
    if (!profileMatchesNickname) {
      setNotice('파티를 만들기 전에 현재 닉네임의 배율을 갱신해 주세요.');
      return;
    }
    if (profile.characterClass !== '비숍') {
      setNotice('현재 파티 배율 검증은 비숍만 지원합니다.');
      return;
    }
    const bounds = createDepartureBounds();
    const suggested = localDateTimeValue();
    setDepartureBounds(bounds);
    setDepartureAt(suggested < bounds.min ? bounds.min : suggested > bounds.max ? bounds.max : suggested);
    setSecondaryEnabled(false);
    setLeaderCombatRole('main_dealer');
    setBossPickerOpen(false);
    setNotice('');
    setCreateOpen(true);
  }

  async function saveCurrentCharacter() {
    if (!authUser) return onRequireAuth('캐릭터 등록은 로그인 후 이용할 수 있습니다.');
    if (!profileMatchesNickname) {
      setNotice('현재 닉네임을 먼저 조회한 뒤 캐릭터를 등록해 주세요.');
      return;
    }
    if (!hexaStat) {
      setNotice('헥사환산을 입력한 뒤 캐릭터를 등록해 주세요.');
      return;
    }
    setCharactersSubmitting(true);
    setNotice('');
    try {
      const response = await fetch('/api/my-characters', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          nickname: profile.nickname,
          hexaStat,
          characterClass: profile.characterClass,
          characterLevel: profile.level,
          characterImage: profile.image,
          arcaneForce: profile.arcaneForce,
          authenticForce: profile.authenticForce,
        }),
      });
      const data = await response.json() as RegisteredCharactersResponse;
      if (!response.ok) throw new Error(data.error ?? '캐릭터를 등록하지 못했습니다.');
      setRegisteredCharacters(data.characters ?? []);
      setNotice(`${profile.nickname} 캐릭터를 내 계정에 등록했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '캐릭터를 등록하지 못했습니다.');
    } finally {
      setCharactersSubmitting(false);
    }
  }

  async function deleteRegisteredCharacter(character: RegisteredCharacter) {
    if (!window.confirm(`${character.nickname} 캐릭터 등록을 삭제할까요?`)) return;
    setCharactersSubmitting(true);
    setNotice('');
    try {
      const response = await fetch('/api/my-characters', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', characterId: character.id }),
      });
      const data = await response.json() as RegisteredCharactersResponse;
      if (!response.ok) throw new Error(data.error ?? '캐릭터 등록을 삭제하지 못했습니다.');
      setRegisteredCharacters(data.characters ?? []);
      setNotice(`${character.nickname} 캐릭터 등록을 삭제했습니다.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '캐릭터 등록을 삭제하지 못했습니다.');
    } finally {
      setCharactersSubmitting(false);
    }
  }

  function setPartyAddress(party?: PartyPost) {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (party?.shareCode) url.searchParams.set('party', party.shareCode);
    else url.searchParams.delete('party');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function partyShareUrl(party: PartyPost) {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('party', party.shareCode);
    return url.toString();
  }

  async function copyPartyLink(party: PartyPost) {
    const url = partyShareUrl(party);
    try {
      await navigator.clipboard.writeText(url);
      setNotice(`${party.difficulty} ${party.bossName} 초대 링크를 복사했습니다.`);
    } catch {
      window.prompt('초대 링크를 복사해 주세요.', url);
    }
  }

  function openDetail(party: PartyPost, updateAddress = true) {
    setSelectedParty(party);
    const myRate = myRates.get(party.bossId);
    const preferredRole = isRoleContract(party)
      ? (['main_dealer', 'secondary_dealer'] as CombatRole[]).find((role) => (
          roleHasSeat(party, role) && (myRate ?? 0) >= roleMinimumRate(party, role)
        )) ?? (roleHasSeat(party, 'main_dealer') ? 'main_dealer' : 'secondary_dealer')
      : 'main_dealer';
    setSelectedJoinRole(preferredRole);
    setTermsAccepted(false);
    setNotice('');
    if (updateAddress) setPartyAddress(party);
    setDetailOpen(true);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const code = new URL(window.location.href).searchParams.get('party')?.trim();
    if (!code || listLoading || directPartyCodeRef.current === code) return;
    const linkedParty = parties.find((party) => party.shareCode === code || party.id === code);
    if (linkedParty) {
      directPartyCodeRef.current = code;
      openDetail(linkedParty, false);
      return;
    }
    directPartyCodeRef.current = code;
    setNotice('공유 링크의 파티를 찾지 못했습니다. 모집이 종료되었을 수 있습니다.');
    setPartyAddress();
  }, [listLoading, parties]);

  function closeDetail(open: boolean) {
    setDetailOpen(open);
    if (!open) {
      setSelectedParty(null);
      directPartyCodeRef.current = null;
      setPartyAddress();
    }
  }

  const selectedMyRate = selectedParty ? myRates.get(selectedParty.bossId) : undefined;
  const selectedMember = selectedParty?.members.find((member) => member.isCurrentUser)
    ?? selectedParty?.members.find((member) => member.nickname === nickname.trim());
  const alreadyJoined = Boolean(selectedMember);
  const canDeleteParty = Boolean(authUser && selectedParty && selectedMember?.role === 'leader' && selectedMember.isCurrentUser);
  const canLeaveParty = Boolean(authUser && selectedParty && selectedMember?.role === 'member' && selectedMember.isCurrentUser);
  const selectedRoleMinimum = selectedParty && isRoleContract(selectedParty)
    ? roleMinimumRate(selectedParty, selectedJoinRole)
    : selectedParty?.minimumRate ?? 0;
  const selectedRoleHasSeat = selectedParty && isRoleContract(selectedParty)
    ? roleHasSeat(selectedParty, selectedJoinRole)
    : Boolean(selectedParty && selectedParty.status === 'open' && selectedParty.members.length < selectedParty.capacity);
  const joinConditionsMet = Boolean(
    selectedParty
    && selectedParty.status === 'open'
    && selectedParty.members.length < selectedParty.capacity
    && selectedRoleHasSeat
    && !alreadyJoined
    && profileMatchesNickname
    && (selectedMyRate ?? 0) >= selectedRoleMinimum
    && (!isRoleContract(selectedParty) || termsAccepted),
  );
  const canJoin = Boolean(joinConditionsMet && authUser);
  const canLoginThenJoin = Boolean(joinConditionsMet && !authUser);

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
            <div className="flex items-center gap-2">
              <span className="hidden rounded-sm bg-white/70 px-2 py-1 font-semibold sm:inline">{authUser ? `${authUser.displayName} 로그인` : '로그인 필요'}</span>
              <Button type="button" variant="ghost" size="sm" onClick={onOpenCalculator} className="h-6 px-2 text-xs">전체 배율 보기</Button>
            </div>
          </div>
          {authUser && (
            <section className="mt-3 rounded-md border border-[#dfe2e8] bg-white px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-bold text-[#343a44]">내 캐릭터</h2>
                  <p className="mt-0.5 text-[11px] text-[#858c97]">조회한 닉네임과 헥환을 계정에 저장해 파티 신청 때 다시 불러옵니다.</p>
                </div>
                <Button type="button" variant="outline" size="sm" disabled={charactersSubmitting || characterLoading || !profileMatchesNickname} onClick={() => void saveCurrentCharacter()} className="h-8 rounded-md border-[#ccd1d9] text-xs">
                  <Plus className="size-3.5" />{charactersSubmitting ? '저장 중' : '현재 캐릭터 등록'}
                </Button>
              </div>
              {charactersLoading ? (
                <p className="mt-2 rounded-md bg-[#fafbfc] px-3 py-2 text-xs text-[#737b87]">내 캐릭터를 불러오는 중입니다.</p>
              ) : registeredCharacters.length ? (
                <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
                  {registeredCharacters.map((character) => {
                    const selected = profileMatchesNickname && character.nickname === profile.nickname && character.hexaStat === hexaStat;
                    return (
                      <article key={character.id} className={`relative flex min-w-[210px] items-center gap-2 rounded-md border bg-[#fafbfc] p-2 ${selected ? 'border-[#eb5b35] ring-2 ring-[#eb5b35]/15' : 'border-[#dfe2e8]'}`}>
                        <button type="button" onClick={() => void onUseRegisteredCharacter(character)} className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#eb5b35]/30">
                          <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#d8dce2] bg-[#f3f5f7]">
                            {character.characterImage ? <Image unoptimized src={character.characterImage} alt="" width={96} height={96} className="size-20 max-w-none object-contain" /> : <CircleUserRound className="size-6 text-[#8a919d]" />}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate text-xs text-[#20242c]">{character.nickname}</strong>
                            <span className="mt-0.5 block truncate text-[11px] text-[#737b87]">{character.characterClass} · Lv.{character.characterLevel}</span>
                            <span className="mt-0.5 block text-[11px] font-bold tabular-nums text-[#1f5ed5]">헥환 {character.hexaStat.toLocaleString()}</span>
                          </span>
                        </button>
                        <Button type="button" variant="ghost" size="sm" disabled={charactersSubmitting} aria-label={`${character.nickname} 등록 삭제`} onClick={() => void deleteRegisteredCharacter(character)} className="absolute right-1 top-1 size-6 rounded-full p-0 text-[#858c97] hover:bg-white hover:text-[#c74928]"><X className="size-3.5" /></Button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 rounded-md bg-[#fafbfc] px-3 py-2 text-xs text-[#737b87]">아직 등록된 캐릭터가 없습니다. 닉네임을 조회한 뒤 현재 캐릭터 등록을 눌러 주세요.</p>
              )}
            </section>
          )}
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
                      ? <BossSelectionImage src={boss.image} alt={boss.name} cropFallback={boss.cropFallback} className="size-[52px]" />
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
              const eligible = profileMatchesNickname && availableRoleForRate(party, myRate);
              const roleContract = isRoleContract(party);
              const targetRate = party.requiredPartyRate ?? 0;
              const readiness = targetRate > 0 ? Math.min(999, party.totalRate / targetRate * 100) : 0;
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
                    <div><p className="text-[10px] text-[#818894]">{roleContract ? '목표 배율' : '최소 배율'}</p><p className="mt-0.5 text-sm font-bold tabular-nums">{rateLabel(roleContract ? targetRate : party.minimumRate)}</p></div>
                    <div><p className="text-[10px] text-[#818894]">파티 배율</p><p className="mt-0.5 text-sm font-bold tabular-nums text-[#1f5ed5]">{rateLabel(party.totalRate)}</p>{roleContract && <p className="mt-0.5 text-[9px] text-[#818894]">준비도 {readiness.toFixed(0)}%</p>}</div>
                    <div><p className="text-[10px] text-[#818894]">현재 인원</p><p className="mt-0.5 text-sm font-bold tabular-nums">{party.members.length}/{party.capacity}</p></div>
                    <div><p className="text-[10px] text-[#818894]">내 배율</p><p className={`mt-0.5 text-sm font-bold tabular-nums ${eligible ? 'text-emerald-700' : 'text-[#687080]'}`}>{profileMatchesNickname && myRate != null ? rateLabel(myRate) : '-'}</p></div>
                  </div>
                  {roleContract && <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <Badge variant="outline" className="rounded-sm border-[#f0c78c] bg-[#fff8eb] text-[#9a650f]">메인 {roleMemberCount(party, 'main_dealer')}/{party.mainCapacity} · {rateLabel(party.mainMinimumRate ?? 0)}+</Badge>
                    {(party.secondaryCapacity ?? 0) > 0 && <Badge variant="outline" className="rounded-sm border-[#a9c7ed] bg-[#f1f6ff] text-[#285da7]">보조 {roleMemberCount(party, 'secondary_dealer')}/{party.secondaryCapacity} · {rateLabel(party.secondaryMinimumRate ?? 0)}+</Badge>}
                    <Badge variant="outline" className="rounded-sm border-[#d7dbe2] bg-[#f8f9fa] text-[#59616e]">{rewardLabel(party)}</Badge>
                  </div>}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs text-[#737b87]">파티장 <strong className="text-[#454c57]">{party.leaderNickname}</strong></p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button type="button" variant="ghost" size="sm" onClick={() => void copyPartyLink(party)} className="h-8 rounded-md px-2 text-xs text-[#687080]"><Copy className="size-3.5" />링크</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openDetail(party)} className="h-8 rounded-md border-[#ccd1d9] text-xs"><Users className="size-3.5" />상세 보기</Button>
                    </div>
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
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg sm:max-w-xl">
          <DialogHeader><DialogTitle>파티 만들기</DialogTitle><DialogDescription>역할별 배율과 보상 조건을 정하면 가입 시 서버에서 그대로 확인합니다.</DialogDescription></DialogHeader>
          <form onSubmit={createParty} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p id="party-boss-label" className="text-xs font-semibold text-[#535b68]">보스</p>
                <Popover open={bossPickerOpen} onOpenChange={setBossPickerOpen}>
                  <PopoverTrigger
                    aria-labelledby="party-boss-label"
                    className="flex h-[72px] w-full items-center gap-3 rounded-md border border-[#ccd1d9] bg-white px-3 text-left outline-none transition-colors hover:border-[#9fa6b1] focus-visible:ring-2 focus-visible:ring-[#eb5b35]/30"
                  >
                    {selectedBossSelectionAsset.src
                      ? <BossSelectionImage src={selectedBossSelectionAsset.src} alt="" eager cropFallback={selectedBossSelectionAsset.cropFallback} className="size-[54px]" />
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
                                ? <BossSelectionImage src={boss.image} alt="" eager cropFallback={boss.cropFallback} className="size-[58px]" />
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

            <section className="space-y-2 border-t border-[#e3e6eb] pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="flex items-center gap-1.5 text-xs font-bold text-[#343a44]"><Target className="size-3.5 text-[#eb5b35]" />20분 목표</h3><p className="mt-0.5 text-[11px] text-[#858c97]">파티원이 합산해서 넘겨야 할 목표 배율을 직접 입력합니다.</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label htmlFor="party-capacity" className="space-y-1.5 text-xs font-semibold text-[#535b68]">총 인원<NativeSelect id="party-capacity" value={String(selectedCapacity)} onChange={(event) => setCapacity(event.target.value)} className="h-10 rounded-md border-[#ccd1d9] bg-white">{Array.from({ length: Math.max(0, (selectedBoss?.partyLimit ?? 2) - 1) }, (_, index) => index + 2).map((count) => <NativeSelectOption key={count} value={String(count)}>{count}명</NativeSelectOption>)}</NativeSelect></label>
                <label htmlFor="party-target-rate" className="space-y-1.5 text-xs font-semibold text-[#535b68]">목표 파티 배율<Input id="party-target-rate" type="number" min="1" max="1000" step="1" value={requiredPartyRate} onChange={(event) => setRequiredPartyRate(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /></label>
              </div>
            </section>

            <section className="space-y-3 border-t border-[#e3e6eb] pt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="flex items-center gap-1.5 text-xs font-bold text-[#343a44]"><Swords className="size-3.5 text-[#eb5b35]" />역할별 자리</h3><p className="mt-0.5 text-[11px] text-[#858c97]">{secondaryEnabled ? '메인격수 수를 정하면 남은 자리는 보조격수가 됩니다.' : '전원 메인격수 기준으로 모집합니다.'}</p></div>
                <Toggle
                  pressed={secondaryEnabled}
                  onPressedChange={(pressed) => {
                    setSecondaryEnabled(pressed);
                    if (!pressed) setLeaderCombatRole('main_dealer');
                  }}
                  variant="outline"
                  size="sm"
                  className={`h-8 rounded-md px-3 text-xs font-bold ${secondaryEnabled ? 'border-[#4d83c6] bg-[#f1f6ff] text-[#285da7]' : 'border-[#d7dbe2] bg-white text-[#626a77]'}`}
                >
                  <ShieldCheck className="size-3.5" />보조격수 모집
                </Toggle>
              </div>
              <div className={`grid gap-3 ${secondaryEnabled ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                {secondaryEnabled ? (
                  <label htmlFor="party-main-capacity" className="space-y-1.5 text-xs font-semibold text-[#535b68]">메인격수<NativeSelect id="party-main-capacity" value={String(selectedMainCapacity)} onChange={(event) => setMainCapacity(event.target.value)} className="h-10 rounded-md border-[#ccd1d9] bg-white">{Array.from({ length: Math.max(1, selectedCapacity - 1) }, (_, index) => index + 1).map((count) => <NativeSelectOption key={count} value={String(count)}>{count}명</NativeSelectOption>)}</NativeSelect></label>
                ) : (
                  <div className="rounded-md border border-[#dfe2e8] bg-[#fafbfc] px-3 py-2">
                    <span className="block text-xs font-semibold text-[#535b68]">메인격수</span>
                    <strong className="mt-1 block text-sm text-[#151922]">{selectedMainCapacity}명</strong>
                  </div>
                )}
                <label htmlFor="party-main-minimum" className="space-y-1.5 text-xs font-semibold text-[#535b68]">메인 최소 배율<Input id="party-main-minimum" type="number" min="1" max="1000" step="0.1" value={mainMinimumRate} onChange={(event) => setMainMinimumRate(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /></label>
                {secondaryEnabled && <label htmlFor="party-secondary-minimum" className="space-y-1.5 text-xs font-semibold text-[#535b68]">보조 {selectedSecondaryCapacity}명 · 최소<Input id="party-secondary-minimum" type="number" min="1" max="1000" step="0.1" value={secondaryMinimumRate} onChange={(event) => setSecondaryMinimumRate(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /></label>}
              </div>
              {secondaryEnabled && <fieldset className="space-y-1.5"><legend className="text-xs font-semibold text-[#535b68]">파티장 역할</legend><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={effectiveLeaderCombatRole === 'main_dealer'} onClick={() => setLeaderCombatRole('main_dealer')} className={`flex h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-bold ${effectiveLeaderCombatRole === 'main_dealer' ? 'border-[#d28a22] bg-[#fff8eb] text-[#98620f]' : 'border-[#d7dbe2] text-[#626a77]'}`}><Crown className="size-3.5" />메인격수</button><button type="button" aria-pressed={effectiveLeaderCombatRole === 'secondary_dealer'} onClick={() => setLeaderCombatRole('secondary_dealer')} className={`flex h-10 items-center justify-center gap-1.5 rounded-md border text-xs font-bold ${effectiveLeaderCombatRole === 'secondary_dealer' ? 'border-[#4d83c6] bg-[#f1f6ff] text-[#285da7]' : 'border-[#d7dbe2] text-[#626a77]'}`}><ShieldCheck className="size-3.5" />보조격수</button></div></fieldset>}
            </section>

            <section className="space-y-2 border-t border-[#e3e6eb] pt-4">
              <div><h3 className="flex items-center gap-1.5 text-xs font-bold text-[#343a44]"><Coins className="size-3.5 text-[#eb5b35]" />보상 약정</h3><p className="mt-0.5 text-[11px] text-[#858c97]">첫 파티원이 가입하면 이 조건은 잠깁니다.</p></div>
              {secondaryEnabled ? (
                <>
                  <div className="grid gap-2">{rewardOptions.map((option) => <button key={option.value} type="button" aria-pressed={rewardPreset === option.value} onClick={() => setRewardPreset(option.value)} className={`flex min-h-12 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left ${rewardPreset === option.value ? 'border-[#eb5b35] bg-[#fff5f1]' : 'border-[#dfe2e8] bg-white hover:border-[#bec4ce]'}`}><span><strong className={`block text-xs ${rewardPreset === option.value ? 'text-[#c74928]' : 'text-[#454c57]'}`}>{option.title}</strong><span className="mt-0.5 block text-[11px] text-[#7a818d]">{option.description}</span></span>{rewardPreset === option.value && <Check className="size-4 shrink-0 text-[#eb5b35]" />}</button>)}</div>
                  {rewardPreset === 'main_loot_adjusted_crystal' && <label htmlFor="party-secondary-share" className="block space-y-1.5 text-xs font-semibold text-[#535b68]">보조격수 결정석 수령 비율<Input id="party-secondary-share" type="number" min="0" max="100" step="1" value={secondaryCrystalShare} onChange={(event) => setSecondaryCrystalShare(event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /><span className="block font-normal text-[#858c97]">{Number(secondaryCrystalShare) || 0}% 수령 · {Math.max(0, 100 - (Number(secondaryCrystalShare) || 0))}% 정산</span></label>}
                </>
              ) : (
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-md border border-[#eb5b35] bg-[#fff5f1] px-3 py-2 text-left">
                  <span><strong className="block text-xs text-[#c74928]">공평 분배</strong><span className="mt-0.5 block text-[11px] text-[#7a818d]">전원 물욕템 참여 · 결정석 1/N</span></span><Check className="size-4 shrink-0 text-[#eb5b35]" />
                </div>
              )}
            </section>
            <section className="space-y-2 border-t border-[#e3e6eb] pt-4">
              <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-1.5 text-xs font-bold text-[#343a44]"><CalendarClock className="size-3.5 text-[#eb5b35]" />출발 시간</h3><p className="text-[10px] text-[#858c97]">{departureBounds.min.slice(0, 10)} ~ {departureBounds.max.slice(0, 10)}</p></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_112px_86px]">
                <label htmlFor="party-departure-date" className="col-span-2 space-y-1.5 text-xs font-semibold text-[#535b68] sm:col-span-1">날짜<Input id="party-departure-date" type="date" min={departureBounds.min.slice(0, 10)} max={departureBounds.max.slice(0, 10)} value={departureAt.slice(0, 10)} onChange={(event) => updateDeparturePart('date', event.target.value)} className="h-10 rounded-md border-[#ccd1d9]" /></label>
                <label htmlFor="party-departure-hour" className="space-y-1.5 text-xs font-semibold text-[#535b68]">시간<NativeSelect id="party-departure-hour" value={departureAt.slice(11, 13)} onChange={(event) => updateDeparturePart('hour', event.target.value)} className="h-10 rounded-md border-[#ccd1d9] bg-white">{Array.from({ length: 24 }, (_, hour) => <NativeSelectOption key={hour} value={String(hour).padStart(2, '0')}>{hourLabel(hour)}</NativeSelectOption>)}</NativeSelect></label>
                <label htmlFor="party-departure-minute" className="space-y-1.5 text-xs font-semibold text-[#535b68]">분<NativeSelect id="party-departure-minute" value={departureAt.slice(14, 16)} onChange={(event) => updateDeparturePart('minute', event.target.value)} className="h-10 rounded-md border-[#ccd1d9] bg-white">{Array.from({ length: 6 }, (_, index) => String(index * 10).padStart(2, '0')).map((minute) => <NativeSelectOption key={minute} value={minute}>{minute}분</NativeSelectOption>)}</NativeSelect></label>
              </div>
            </section>
            <div className="rounded-md border border-[#dfe2e8] bg-[#fafbfc] px-3 py-2 text-xs leading-5 text-[#687080]">파티장 {nickname || '-'} · {roleLabel(effectiveLeaderCombatRole)} · 헥환 {hexaStat.toLocaleString()}<br />현재 {selectedBoss ? rateLabel(selectedBoss.rate) : '-'} · 목표 {rateLabel(Number(requiredPartyRate) || 0)} · {secondaryEnabled ? `메인 ${selectedMainCapacity}명 / 보조 ${selectedSecondaryCapacity}명` : `메인 ${selectedMainCapacity}명`}</div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-md">취소</Button><Button type="submit" disabled={submitting} className="rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]">{submitting ? '검증 중' : '모집 시작'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={closeDetail}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg sm:max-w-[780px]">
          {selectedParty && <>
            <DialogHeader><DialogTitle>{selectedParty.difficulty} {selectedParty.bossName}</DialogTitle><DialogDescription>{departureLabel(selectedParty.departureAt)} 출발 · {isRoleContract(selectedParty) ? `목표 ${rateLabel(selectedParty.requiredPartyRate ?? 0)}` : `최소 ${rateLabel(selectedParty.minimumRate)}`}</DialogDescription></DialogHeader>
            <div className="flex min-w-0 items-center gap-2 rounded-md border border-[#dfe2e8] bg-[#fafbfc] px-3 py-2">
              <LinkIcon className="size-4 shrink-0 text-[#7a818d]" />
              <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#59616e]">{partyShareUrl(selectedParty)}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void copyPartyLink(selectedParty)} className="h-8 shrink-0 rounded-md border-[#ccd1d9] text-xs"><Copy className="size-3.5" />복사</Button>
            </div>
            <div className="grid grid-cols-4 divide-x divide-[#e3e6eb] border-y border-[#e3e6eb] py-3 text-center">
              <div><p className="text-[10px] text-[#818894]">현재 인원</p><p className="mt-0.5 text-sm font-bold">{selectedParty.members.length}/{selectedParty.capacity}</p></div>
              <div><p className="text-[10px] text-[#818894]">파티 배율</p><p className="mt-0.5 text-sm font-bold text-[#1f5ed5]">{rateLabel(selectedParty.totalRate)}</p></div>
              <div><p className="text-[10px] text-[#818894]">{isRoleContract(selectedParty) ? '목표 배율' : '내 배율'}</p><p className="mt-0.5 text-sm font-bold">{isRoleContract(selectedParty) ? rateLabel(selectedParty.requiredPartyRate ?? 0) : selectedMyRate == null ? '-' : rateLabel(selectedMyRate)}</p></div>
              <div><p className="text-[10px] text-[#818894]">{isRoleContract(selectedParty) ? '준비도' : '남은 자리'}</p><p className="mt-0.5 text-sm font-bold">{isRoleContract(selectedParty) ? `${Math.min(999, selectedParty.totalRate / (selectedParty.requiredPartyRate || 1) * 100).toFixed(0)}%` : `${Math.max(0, selectedParty.capacity - selectedParty.members.length)}명`}</p></div>
            </div>
            {isRoleContract(selectedParty) && <section className="space-y-2">
              <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-[#535b68]">가입 역할</p><p className="text-[11px] text-[#818894]">내 배율 {selectedMyRate == null ? '-' : rateLabel(selectedMyRate)}</p></div>
              <div className="grid grid-cols-2 gap-2">
                {(['main_dealer', 'secondary_dealer'] as CombatRole[]).filter((role) => roleCapacity(selectedParty, role) > 0).map((role) => {
                  const selected = selectedJoinRole === role;
                  const hasSeat = roleHasSeat(selectedParty, role);
                  const qualified = (selectedMyRate ?? 0) >= roleMinimumRate(selectedParty, role);
                  return <button key={role} type="button" disabled={alreadyJoined || !hasSeat} aria-pressed={selected} onClick={() => { setSelectedJoinRole(role); setTermsAccepted(false); }} className={`min-h-[62px] rounded-md border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-45 ${selected ? role === 'main_dealer' ? 'border-[#d28a22] bg-[#fff8eb]' : 'border-[#4d83c6] bg-[#f1f6ff]' : 'border-[#dfe2e8] bg-white'}`}>
                    <span className="flex items-center justify-between gap-2"><strong className="text-xs">{roleLabel(role)}</strong><span className="text-[10px] text-[#7a818d]">{roleMemberCount(selectedParty, role)}/{roleCapacity(selectedParty, role)}</span></span>
                    <span className={`mt-1 block text-[11px] ${qualified ? 'text-emerald-700' : 'text-[#7a818d]'}`}>최소 {rateLabel(roleMinimumRate(selectedParty, role))}{!hasSeat ? ' · 마감' : qualified ? ' · 가입 가능' : ''}</span>
                  </button>;
                })}
              </div>
            </section>}
            <div>
              <p className="mb-2 text-xs font-semibold text-[#535b68]">참가자</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {selectedParty.members.map((member) => {
                  const characterImage = member.nickname === profile.nickname ? profile.image ?? member.characterImage : member.characterImage;
                  return <article key={member.id} className="min-w-0 rounded-md border border-[#dfe2e8] bg-white px-2.5 pb-2.5 pt-3 text-center">
                    <div className="relative mx-auto size-28 overflow-hidden rounded-full border border-[#d8dce2] bg-[#f3f5f7]">
                      {characterImage ? <Image unoptimized loading="eager" src={characterImage} alt={`${member.nickname} 캐릭터`} width={220} height={220} className="absolute left-1/2 top-1/2 size-[220px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain" /> : <div className="grid size-full place-items-center text-[#8a919d]"><CircleUserRound className="size-8" /></div>}
                    </div>
                    <div className="pt-2.5">
                      <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
                        <h3 className="max-w-full truncate text-sm font-bold">{member.nickname}</h3>
                        {member.role === 'leader' && <Badge variant="outline" className="shrink-0 rounded-sm border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700">파티장</Badge>}
                        {member.combatRole && <Badge variant="outline" className={`shrink-0 rounded-sm px-1.5 text-[10px] ${member.combatRole === 'main_dealer' ? 'border-[#f0c78c] bg-[#fff8eb] text-[#9a650f]' : 'border-[#a9c7ed] bg-[#f1f6ff] text-[#285da7]'}`}>{roleLabel(member.combatRole)}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-[#747b88]">{member.characterClass} · Lv.{member.characterLevel}</p>
                      <div className="mt-2 space-y-1 border-t border-[#eceef1] pt-2 text-[11px]">
                        <div className="flex items-center justify-between gap-3"><span className="text-[#818894]">헥환</span><strong className="tabular-nums">{member.hexaStat.toLocaleString()}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-[#818894]">보스 배율</span><strong className="tabular-nums text-[#1f5ed5]">{rateLabel(member.verifiedRate)}</strong></div>
                      </div>
                    </div>
                  </article>;
                })}
              </div>
            </div>
            {isRoleContract(selectedParty) && <section className="border-y border-[#e3e6eb] py-3">
              <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-xs font-bold text-[#343a44]"><Coins className="size-3.5 text-[#eb5b35]" />보상 약정</p><Badge variant="outline" className="rounded-sm border-[#d7dbe2] bg-[#f8f9fa] text-[10px] text-[#59616e]">버전 {selectedParty.termsVersion}{selectedParty.termsLockedAt ? ' · 잠김' : ''}</Badge></div>
              <p className="mt-2 text-xs leading-5 text-[#59616e]">{memberRewardSummary(selectedParty, selectedJoinRole)}</p>
              {!alreadyJoined && <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md bg-[#f7f8fa] px-3 py-2.5 text-xs leading-5 text-[#454c57]"><Checkbox checked={termsAccepted} onCheckedChange={setTermsAccepted} className="mt-0.5 data-checked:border-[#eb5b35] data-checked:bg-[#eb5b35]" /><span>위 {roleLabel(selectedJoinRole)} 조건과 보상 약정을 확인했으며 동의합니다.</span></label>}
            </section>}
            <div className={`rounded-md border px-3 py-2 text-xs ${canJoin ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-[#dfe2e8] bg-[#fafbfc] text-[#687080]'}`}>
              {alreadyJoined ? '이미 이 파티에 참가 중입니다.' : !profileMatchesNickname ? '현재 닉네임을 먼저 조회해 주세요.' : selectedParty.status === 'full' ? '모집이 완료된 파티입니다.' : !selectedRoleHasSeat ? '선택한 역할의 모집이 완료되었습니다.' : (selectedMyRate ?? 0) < selectedRoleMinimum ? `내 배율이 선택한 역할의 최소 조건보다 ${rateLabel(Math.max(0, selectedRoleMinimum - (selectedMyRate ?? 0)))} 부족합니다.` : isRoleContract(selectedParty) && !termsAccepted ? '보상 약정을 확인하고 동의해 주세요.' : !authUser ? '로그인 후 가입할 수 있습니다.' : canJoin ? <span className="flex items-center gap-1.5"><UserRoundCheck className="size-4" />가입 조건을 충족합니다.</span> : '가입 조건을 다시 확인해 주세요.'}
            </div>
            <DialogFooter className="items-stretch sm:items-center sm:justify-between">
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {canDeleteParty && <Button type="button" variant="destructive" disabled={submitting} onClick={() => void deleteParty()} className="rounded-md"><Trash2 className="size-4" />{submitting ? '삭제 중' : '모집 삭제'}</Button>}
                {canLeaveParty && <Button type="button" variant="outline" disabled={submitting} onClick={() => void leaveParty()} className="rounded-md border-[#f0b8aa] text-[#c74928] hover:bg-[#fff1ec]"><LogOut className="size-4" />{submitting ? '탈퇴 중' : '파티 탈퇴'}</Button>}
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => closeDetail(false)} className="rounded-md">닫기</Button>
                {!alreadyJoined && <Button type="button" disabled={(!canJoin && !canLoginThenJoin) || submitting} onClick={() => void joinParty()} className="rounded-md bg-[#eb5b35] hover:bg-[#d94d2a]">{canLoginThenJoin ? <LogIn className="size-4" /> : <Check className="size-4" />}{submitting ? '검증 중' : canLoginThenJoin ? '로그인하고 가입' : isRoleContract(selectedParty) ? `${roleLabel(selectedJoinRole)}로 가입` : '가입하기'}</Button>}
              </div>
            </DialogFooter>
          </>}
        </DialogContent>
      </Dialog>
    </>
  );
}
