import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Palette as Colors } from '@/constants/Colors';
import { TRADE_CATALOG, type TradeCatalogId } from '@/constants/tradeCatalog';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const FONT_MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

type TradeRow = {
  id: string;
  room_id: string;
  room_name: string;
  trade_id: string;
  display_name: string;
  scheduled_date: string | null;
  duration?: string | null;
  day_notes?: string | null;
  days?: number | null;
  sort_order?: number | null;
  completion_percent?: number | string | null;
};

type ProjectRow = {
  id: string;
  client_name?: string | null;
  address?: string | null;
  start_date?: string | null;
};

type WeekBucket = {
  weekIndex: number;
  trades: TradeRow[];
  weekStart: Date;
  weekEnd: Date;
};

function parseParam(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0] ?? '';
  return '';
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Parse YYYY-MM-DD as local midnight (avoids UTC off-by-one). */
function parseLocalDate(iso: string): Date {
  const part = iso.split('T')[0];
  const [y, m, d] = part.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(d: Date | string): string {
  const dt = typeof d === 'string' ? parseLocalDate(d.split('T')[0]) : d;
  try {
    return dt.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatWeekRange(ws: Date, we: Date): string {
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const a = ws.toLocaleDateString('en-CA', o);
  const b = we.toLocaleDateString('en-CA', o);
  return `${a}–${b}`;
}

function tradeLabel(t: TradeRow): string {
  return TRADE_CATALOG[t.trade_id as TradeCatalogId]?.label ?? t.display_name ?? t.trade_id;
}

function tradeColor(id: string): string {
  return TRADE_CATALOG[id as TradeCatalogId]?.color ?? '#888888';
}

function tradeDurationDays(t: TradeRow): number {
  const daysCol = t.days;
  if (daysCol !== undefined && daysCol !== null && Number(daysCol) > 0) return Number(daysCol);
  const dur = t.duration;
  if (typeof dur === 'string' && dur.trim()) {
    const n = parseInt(dur, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return 1;
}

function completionPct(t: TradeRow): number {
  const n = Number(t.completion_percent);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function tradeDateRange(t: TradeRow, projectStart: Date): string {
  const fall = startOfDay(projectStart);
  if (!t.scheduled_date) return formatDate(fall);
  const start = startOfDay(parseLocalDate(t.scheduled_date));
  const end = addDays(start, tradeDurationDays(t) - 1);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function groupByWeek(trades: TradeRow[], startDate: Date): WeekBucket[] {
  const start0 = startOfDay(startDate);
  const map = new Map<number, TradeRow[]>();

  for (const trade of trades) {
    const d = trade.scheduled_date ? startOfDay(parseLocalDate(trade.scheduled_date)) : start0;
    let diffMs = d.getTime() - start0.getTime();
    if (diffMs < 0) diffMs = 0;
    const weekNum = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    if (!map.has(weekNum)) map.set(weekNum, []);
    map.get(weekNum)!.push(trade);
  }

  const sortedWeeks = [...map.keys()].sort((a, b) => a - b);
  return sortedWeeks.map((wi) => {
    const weekStart = addDays(start0, wi * 7);
    const weekEnd = addDays(weekStart, 6);
    const list = (map.get(wi) ?? []).sort((a, b) => {
      const da = a.scheduled_date ? parseLocalDate(a.scheduled_date).getTime() : 0;
      const db = b.scheduled_date ? parseLocalDate(b.scheduled_date).getTime() : 0;
      if (da !== db) return da - db;
      return (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    });
    return { weekIndex: wi, trades: list, weekStart, weekEnd };
  });
}

function getTradesForDay(trades: TradeRow[], date: Date): TradeRow[] {
  const check = startOfDay(date);
  return trades.filter((trade) => {
    if (!trade.scheduled_date) return false;
    const start = startOfDay(parseLocalDate(trade.scheduled_date));
    const end = addDays(start, tradeDurationDays(trade) - 1);
    return check.getTime() >= start.getTime() && check.getTime() <= end.getTime();
  });
}

function getUnscheduledTrades(trades: TradeRow[]): TradeRow[] {
  return trades.filter((t) => !t.scheduled_date);
}

/** Screen 12 — Schedule timeline + interactive calendar (`12_schedule.md`). */
export default function ProjectScheduleScreen() {
  const insets = useSafeAreaInsets();
  const rawId = useLocalSearchParams<{ id: string }>();
  const projectId = parseParam(rawId.id);

  const [activeView, setActiveView] = useState<'timeline' | 'calendar'>('timeline');
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [startDate, setStartDate] = useState(() => startOfDay(new Date()));
  const [visibleMonth, setVisibleMonth] = useState(() => startOfDay(new Date()));
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDaySheet, setShowDaySheet] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (!projectId) {
      setLoading(false);
      setError('Missing project.');
      return;
    }
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError('Supabase is not configured.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    const projRes = await supabase.from('projects').select('*').eq('id', projectId).single();

    if (projRes.error || !projRes.data) {
      setError(projRes.error?.message ?? 'Project not found.');
      setLoading(false);
      return;
    }

    const roomsRes = await supabase
      .from('project_rooms')
      .select(
        `
        id,
        name,
        sort_order,
        project_room_trades (
          id,
          trade_id,
          display_name,
          scheduled_date,
          duration,
          day_notes,
          days,
          sort_order,
          completion_percent
        )
      `,
      )
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (roomsRes.error) {
      const msg = roomsRes.error.message || '';
      if (/completion_percent/i.test(msg) && /column/i.test(msg)) {
        setError('Apply migration 011_schedule_completion_percent.sql in Supabase for schedule progress.');
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    const flat: TradeRow[] = [];
    const rooms = roomsRes.data ?? [];
    for (const r of rooms) {
      const list = (r.project_room_trades ?? []) as Omit<TradeRow, 'room_name' | 'room_id'>[];
      list.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
      for (const t of list) {
        flat.push({
          ...t,
          room_id: r.id,
          room_name: r.name,
        });
      }
    }

    const p = projRes.data as ProjectRow;
    setProject(p);
    setTrades(flat);

    if (p.start_date) {
      setStartDate(startOfDay(parseLocalDate(p.start_date)));
      setVisibleMonth(startOfDay(parseLocalDate(p.start_date)));
    }

    setLoading(false);
  }, [projectId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const weeks = useMemo(() => groupByWeek(trades, startDate), [trades, startDate]);

  const totalDays = useMemo(
    () => trades.reduce((sum, t) => sum + tradeDurationDays(t), 0),
    [trades],
  );

  const breadcrumb = [project?.client_name, project?.address].filter(Boolean).join(' · ') || 'Project';

  const handleShare = async () => {
    const client = project?.client_name || 'Client';
    const lines = trades.map(
      (t) => `${tradeLabel(t)}: ${tradeDateRange(t, startDate)}${t.day_notes ? ` — ${t.day_notes}` : ''}`,
    );
    const scheduleText = lines.length ? lines.join('\n') : 'No trades scheduled yet.';
    try {
      await Share.share({
        title: `Project Schedule — ${client}`,
        message: `${client}\n\n${scheduleText}`,
      });
    } catch {
      /* cancelled */
    }
  };

  const persistStartDate = async (d: Date) => {
    const normalized = startOfDay(d);
    setStartDate(normalized);
    if (!projectId) return;
    const str = toDateStr(normalized);
    const { error: e } = await supabase.from('projects').update({ start_date: str }).eq('id', projectId);
    if (e) Alert.alert('Could not save start date', e.message);
    else setProject((prev) => (prev ? { ...prev, start_date: str } : prev));
  };

  const onStartDatePickerChange = (_event: unknown, date?: Date) => {
    if (Platform.OS === 'android') setShowStartPicker(false);
    if (date) void persistStartDate(date);
  };

  const updateNoteLocal = (tradeId: string, text: string) => {
    setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, day_notes: text } : t)));
  };

  const saveNote = async (tradeId: string, note: string) => {
    const { error: e } = await supabase.from('project_room_trades').update({ day_notes: note }).eq('id', tradeId);
    if (e) Alert.alert('Could not save note', e.message);
    setEditingNoteId(null);
  };

  const assignTradeToDay = async (tradeId: string, date: Date) => {
    const dateStr = toDateStr(startOfDay(date));
    const { error: e } = await supabase
      .from('project_room_trades')
      .update({ scheduled_date: dateStr })
      .eq('id', tradeId);
    if (e) {
      Alert.alert('Could not schedule trade', e.message);
      return;
    }
    setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, scheduled_date: dateStr } : t)));
    setShowDaySheet(false);
  };

  const removeTradeFromDay = async (tradeId: string) => {
    const { error: e } = await supabase.from('project_room_trades').update({ scheduled_date: null }).eq('id', tradeId);
    if (e) {
      Alert.alert('Could not clear date', e.message);
      return;
    }
    setTrades((prev) => prev.map((t) => (t.id === tradeId ? { ...t, scheduled_date: null } : t)));
  };

  const calendarYear = visibleMonth.getFullYear();
  const calendarMonth = visibleMonth.getMonth();
  const dim = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const today = startOfDay(new Date());

  const gridCells: ({ day: number } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) gridCells.push(null);
  for (let d = 1; d <= dim; d++) gridCells.push({ day: d });
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  const monthTitle = visibleMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

  const openDaySheet = (dayNum: number) => {
    const d = new Date(calendarYear, calendarMonth, dayNum);
    setSelectedDay(d);
    setShowDaySheet(true);
  };

  const sheetTrades = selectedDay ? getTradesForDay(trades, selectedDay) : [];
  const sheetUnscheduled = selectedDay ? getUnscheduledTrades(trades) : [];

  if (!projectId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.err}>Invalid project.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.iconSquare} onPress={() => router.back()} accessibilityRole="button">
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.breadcrumb} numberOfLines={2}>
              {breadcrumb.toUpperCase()}
            </Text>
            <Text style={styles.title}>Schedule</Text>
          </View>
          <TouchableOpacity style={styles.iconSquare} onPress={() => void handleShare()} accessibilityRole="button">
            <MaterialCommunityIcons name="share-variant" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabs}>
          {(['timeline', 'calendar'] as const).map((view) => {
            const active = activeView === view;
            return (
              <TouchableOpacity
                key={view}
                style={styles.tabTouchable}
                onPress={() => setActiveView(view)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}>
                <View style={[styles.tabInner, active ? styles.tabActive : styles.tabInactive]}>
                  <Text style={[styles.tabTxt, active ? styles.tabTxtActive : styles.tabTxtInactive]}>
                    {view === 'timeline' ? 'Timeline' : 'Calendar'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.loader}>
          <Text style={styles.err}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryTxt}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : activeView === 'timeline' ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollIn, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.metaCard}>
            <View style={styles.metaHalf}>
              <Text style={styles.sectionLabel}>START DATE</Text>
              <TouchableOpacity
                onPress={() => setShowStartPicker(true)}
                accessibilityRole="button"
                style={styles.metaInputOuter}>
                <Text style={styles.metaInputTxt}>{formatDate(startDate)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.metaHalf}>
              <Text style={styles.sectionLabel}>EST. DURATION</Text>
              <View style={styles.metaInputOuter}>
                <Text style={styles.durationTxt}>{totalDays} days</Text>
              </View>
            </View>
          </View>

          {showStartPicker ? (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onStartDatePickerChange}
            />
          ) : null}
          {Platform.OS === 'ios' && showStartPicker ? (
            <TouchableOpacity style={styles.pickerDone} onPress={() => setShowStartPicker(false)}>
              <Text style={styles.pickerDoneTxt}>Done</Text>
            </TouchableOpacity>
          ) : null}

          {weeks.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTxt}>No trades in this project yet.</Text>
            </View>
          ) : (
            weeks.map((week) => (
              <View key={week.weekIndex} style={styles.weekCard}>
                <View style={styles.weekHead}>
                  <Text style={styles.weekTitle}>
                    Week {week.weekIndex + 1} — {formatWeekRange(week.weekStart, week.weekEnd)}
                  </Text>
                  <Text style={styles.weekCount}>{week.trades.length} trades</Text>
                </View>
                {week.trades.map((trade, i) => {
                  const isLast = i === week.trades.length - 1;
                  const isEditing = editingNoteId === trade.id;
                  const pct = completionPct(trade);
                  const note = trade.day_notes?.trim() ?? '';

                  return (
                    <View
                      key={trade.id}
                      style={[styles.tradeRow, !isLast ? styles.tradeRowBorder : null]}>
                      <View style={styles.tradeTop}>
                        <View style={[styles.dot8, { backgroundColor: tradeColor(trade.trade_id) }]} />
                        <Text style={styles.tradeName} numberOfLines={2}>
                          {tradeLabel(trade)}
                        </Text>
                        <Text style={styles.tradeRange}>{tradeDateRange(trade, startDate)}</Text>
                        <TouchableOpacity
                          style={styles.pencilHit}
                          onPress={() => setEditingNoteId(trade.id)}
                          accessibilityRole="button"
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <View style={styles.pencilBox}>
                            <MaterialCommunityIcons name="pencil" size={14} color="#888888" />
                          </View>
                        </TouchableOpacity>
                      </View>

                      {isEditing ? (
                        <TextInput
                          value={trade.day_notes ?? ''}
                          onChangeText={(text) => updateNoteLocal(trade.id, text)}
                          onBlur={() => {
                            const current = trades.find((x) => x.id === trade.id)?.day_notes ?? '';
                            void saveNote(trade.id, current);
                          }}
                          autoFocus
                          multiline
                          placeholder="Add day notes..."
                          placeholderTextColor="#aaaaaa"
                          style={styles.noteInput}
                        />
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => setEditingNoteId(trade.id)}
                          style={styles.noteTouchable}>
                          <View
                            style={[
                              styles.noteBox,
                              note ? styles.noteSolid : styles.noteDashed,
                            ]}>
                            <Text style={[styles.noteTxt, note ? styles.noteFilled : styles.notePlaceholder]}>
                              {note || 'Add day notes...'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${pct}%`,
                              backgroundColor: tradeColor(trade.trade_id),
                            },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            ))
          )}

          <TouchableOpacity style={styles.shareScheduleOuter} onPress={() => void handleShare()} accessibilityRole="button">
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.shareScheduleGrad}>
              <MaterialCommunityIcons name="share-variant" size={20} color={Colors.textWhite} />
              <Text style={styles.shareScheduleTxt}>Share Schedule with Client</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollIn, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.calNav}>
            <TouchableOpacity
              style={styles.calNavBtn}
              onPress={() => setVisibleMonth(new Date(calendarYear, calendarMonth - 1, 1))}
              accessibilityRole="button">
              <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.calMonthTitle}>{monthTitle}</Text>
            <TouchableOpacity
              style={styles.calNavBtn}
              onPress={() => setVisibleMonth(new Date(calendarYear, calendarMonth + 1, 1))}
              accessibilityRole="button">
              <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
              <Text key={`${d}-${idx}`} style={styles.weekdayLbl}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {gridCells.map((cell, idx) => {
              if (!cell) {
                return <View key={`e-${idx}`} style={styles.calCell} />;
              }
              const { day } = cell;
              const cellDate = startOfDay(new Date(calendarYear, calendarMonth, day));
              const dayTrades = getTradesForDay(trades, cellDate);
              const isToday = cellDate.getTime() === today.getTime();
              const weekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;

              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  style={styles.calCell}
                  onPress={() => openDaySheet(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`${monthTitle} day ${day}`}>
                  <View
                    style={[
                      styles.calCellInner,
                      dayTrades.length > 0 ? styles.calCellInnerBusy : null,
                    ]}>
                    {isToday ? (
                      <View style={styles.todayCircle}>
                        <Text style={styles.todayNum}>{day}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.calDayNum, weekend ? styles.calWeekend : null]}>{day}</Text>
                    )}
                    <View style={styles.dotsRow}>
                      {dayTrades.slice(0, 3).map((t) => (
                        <View
                          key={t.id}
                          style={[styles.dot4, { backgroundColor: tradeColor(t.trade_id) }]}
                        />
                      ))}
                      {dayTrades.length > 3 ? (
                        <Text style={styles.dotMore}>+{dayTrades.length - 3}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal visible={showDaySheet} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetBackdropTap}
            activeOpacity={1}
            onPress={() => setShowDaySheet(false)}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
          <View style={[styles.sheetPanel, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedDay ? formatDate(selectedDay) : ''}</Text>
              <TouchableOpacity
                style={styles.sheetClose}
                onPress={() => setShowDaySheet(false)}
                accessibilityRole="button">
                <MaterialCommunityIcons name="close" size={20} color="#888888" />
              </TouchableOpacity>
            </View>

            {sheetTrades.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>SCHEDULED</Text>
                {sheetTrades.map((trade) => (
                  <View key={trade.id} style={styles.sheetRow}>
                    <View style={[styles.dot8, { backgroundColor: tradeColor(trade.trade_id) }]} />
                    <View style={styles.sheetMid}>
                      <Text style={styles.sheetTradeName}>{tradeLabel(trade)}</Text>
                      <Text style={styles.sheetNote}>{trade.day_notes?.trim() || 'No notes'}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => void removeTradeFromDay(trade.id)}
                      accessibilityRole="button">
                      <MaterialCommunityIcons name="close" size={16} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            ) : null}

            {sheetUnscheduled.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, styles.sheetAddLabel]}>ADD TRADE</Text>
                {sheetUnscheduled.map((trade) => (
                  <TouchableOpacity
                    key={trade.id}
                    style={styles.sheetRowAdd}
                    onPress={() => selectedDay && void assignTradeToDay(trade.id, selectedDay)}
                    accessibilityRole="button">
                    <View style={[styles.dot8, { backgroundColor: tradeColor(trade.trade_id) }]} />
                    <Text style={styles.sheetAddName}>{tradeLabel(trade)}</Text>
                    <View style={styles.addCircle}>
                      <MaterialCommunityIcons name="plus" size={16} color={Colors.success} />
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            ) : null}

            {sheetTrades.length === 0 && sheetUnscheduled.length === 0 ? (
              <Text style={styles.sheetEmpty}>All trades are scheduled</Text>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.screenBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { paddingHorizontal: 16, paddingBottom: 0 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  headerCenter: { flex: 1, minWidth: 0 },
  iconSquare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumb: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  tabs: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tabTouchable: { flex: 1 },
  tabInner: {
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  tabActive: { backgroundColor: '#111111' },
  tabInactive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  tabTxt: { fontSize: 11, fontWeight: '600' },
  tabTxtActive: { color: Colors.textWhite },
  tabTxtInactive: { color: 'rgba(255,255,255,0.6)' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  err: { fontSize: 14, color: Colors.error, textAlign: 'center', marginBottom: 12 },
  retry: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 100,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryTxt: { color: Colors.textWhite, fontWeight: '600' },

  scroll: { flex: 1 },
  scrollIn: { paddingHorizontal: 14, paddingTop: 14, gap: 10 },

  metaCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    gap: 8,
  },
  metaHalf: { flex: 1 },
  sectionLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 6,
  },
  metaInputOuter: {
    backgroundColor: Colors.textWhite,
    borderWidth: 0.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  metaInputTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontFamily: FONT_MONO,
  },
  durationTxt: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    fontFamily: FONT_MONO,
  },
  pickerDone: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16 },
  pickerDoneTxt: { color: Colors.primary, fontWeight: '600', fontSize: 15 },

  emptyCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptyTxt: { fontSize: 14, color: Colors.textSecondary },

  weekCard: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    overflow: 'hidden',
  },
  weekHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
  },
  weekTitle: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, flex: 1, paddingRight: 8 },
  weekCount: { fontSize: 11, fontWeight: '500', color: Colors.primary },

  tradeRow: { paddingVertical: 10, paddingHorizontal: 14 },
  tradeRowBorder: { borderBottomWidth: 0.5, borderBottomColor: '#ececec' },
  tradeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  dot8: { width: 8, height: 8, borderRadius: 4 },
  tradeName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    minWidth: 0,
  },
  tradeRange: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: FONT_MONO,
    marginRight: 4,
    maxWidth: 120,
  },
  pencilHit: { justifyContent: 'center', alignItems: 'center', minWidth: 44, minHeight: 44 },
  pencilBox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: Colors.textWhite,
    borderWidth: 0.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTouchable: { marginLeft: 18, marginBottom: 6 },
  noteBox: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: Colors.textWhite,
  },
  noteSolid: { borderWidth: 0.5, borderColor: Colors.border },
  noteDashed: { borderWidth: 0.5, borderColor: '#cccccc', borderStyle: 'dashed' },
  noteTxt: { fontSize: 12, lineHeight: 17 },
  noteFilled: { color: '#555555' },
  notePlaceholder: { color: '#aaaaaa' },
  noteInput: {
    marginLeft: 18,
    marginBottom: 6,
    backgroundColor: Colors.textWhite,
    borderWidth: 0.5,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#555555',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  progressTrack: {
    marginLeft: 18,
    height: 4,
    backgroundColor: '#e8e8ec',
    borderRadius: 100,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 100 },

  shareScheduleOuter: { borderRadius: 100, overflow: 'hidden', marginTop: 4 },
  shareScheduleGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    minHeight: 48,
  },
  shareScheduleTxt: { fontSize: 14, fontWeight: '600', color: Colors.textWhite },

  calNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calNavBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.cardBg,
  },
  calMonthTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },

  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLbl: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calCellInner: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellInnerBusy: { backgroundColor: Colors.cardBg },
  calDayNum: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  calWeekend: { color: '#cccccc' },
  todayCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayNum: { fontSize: 14, fontWeight: '700', color: Colors.textWhite },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
    minHeight: 8,
  },
  dot4: { width: 4, height: 4, borderRadius: 2 },
  dotMore: { fontSize: 8, color: Colors.textSecondary, marginLeft: 2 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheetBackdropTap: { flex: 1 },
  sheetPanel: {
    backgroundColor: Colors.textWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '72%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  sheetMid: { flex: 1, minWidth: 0 },
  sheetTradeName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  sheetNote: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAddLabel: { marginTop: 14 },
  sheetRowAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    minHeight: 44,
  },
  sheetAddName: { flex: 1, fontSize: 13, color: Colors.textPrimary },
  addCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0faf2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEmpty: {
    fontSize: 13,
    color: '#aaaaaa',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
