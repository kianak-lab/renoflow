import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
  trade_id: string;
  sort_order?: number | null;
  display_name?: string | null;
  trade_name?: string | null;
  labour_charge?: number | string | null;
  labour_total?: number | string | null;
  materials_total?: number | string | null;
};

type RoomRow = {
  id: string;
  name: string;
  sort_order?: number | null;
  project_room_trades?: TradeRow[] | null;
};

type InvoiceRow = {
  id: string;
  project_id?: string | null;
  quote_id?: string | null;
  invoice_number?: string | null;
  client_name?: string | null;
  client_address?: string | null;
  subtotal?: number | string | null;
  tax_rate?: number | string | null;
  tax_amount?: number | string | null;
  total_amount?: number | string | null;
  amount_paid?: number | string | null;
  deposit_amount?: number | string | null;
  paid?: boolean | null;
  created_at?: string | null;
  created_date?: string | null;
  due_date?: string | null;
};

type ProjectRow = {
  id: string;
  name?: string | null;
  client_name?: string | null;
  address?: string | null;
};

type ProfileRow = {
  company_name?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_logo_url?: string | null;
  default_tax_percent?: number | string | null;
  currency?: string | null;
  country?: string | null;
};

type PaymentRow = {
  id: string;
  amount: number | string;
  method?: string | null;
  date?: string | null;
  note?: string | null;
  created_at?: string | null;
};

type PayStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

const STATUS_STYLES: Record<
  PayStatus,
  { bg: string; text: string; label: string }
> = {
  paid: { bg: '#f0faf2', text: '#2d7a2d', label: 'PAID' },
  partial: { bg: '#fff8e1', text: '#f5a623', label: 'PARTIAL' },
  unpaid: { bg: '#fef2f2', text: '#c0392b', label: 'UNPAID' },
  overdue: { bg: '#fef2f2', text: '#c0392b', label: 'OVERDUE' },
};

function tradeColor(id: string): string {
  return TRADE_CATALOG[id as TradeCatalogId]?.color ?? '#888888';
}

function tradeLabel(t: TradeRow): string {
  return (t.trade_name || t.display_name || t.trade_id || 'Trade').trim();
}

function labourAmt(t: TradeRow): number {
  const c = t.labour_charge;
  if (c !== undefined && c !== null && c !== '') return Number(c) || 0;
  return Number(t.labour_total) || 0;
}

function materialsAmt(t: TradeRow): number {
  return Number(t.materials_total) || 0;
}

function tradeLineTotal(t: TradeRow): number {
  return labourAmt(t) + materialsAmt(t);
}

function roomTotal(room: RoomRow): number {
  const trades = room.project_room_trades ?? [];
  return trades.reduce((s, t) => s + tradeLineTotal(t), 0);
}

function formatMoney(n: number, currency = 'CAD'): string {
  try {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-CA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}

function formatMethod(method: string | null | undefined): string {
  const m = (method || '').toLowerCase();
  const map: Record<string, string> = {
    cash: 'Cash',
    etransfer: 'E-Transfer',
    cheque: 'Cheque',
    credit: 'Credit Card',
  };
  return map[m] || method || 'Payment';
}

function parseParam(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v[0] ?? '';
  return '';
}

/** Screen 11 — Invoice detail (`11_invoice.md`). */
export default function ProjectInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const serifLogo = Platform.OS === 'ios' ? 'Georgia' : 'serif';
  const raw = useLocalSearchParams<{ id: string; invoiceId: string }>();
  const projectId = parseParam(raw.id);
  const invoiceId = parseParam(raw.invoiceId);

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'etransfer' | 'cheque' | 'credit'>('etransfer');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    if (!projectId || !invoiceId) {
      setLoading(false);
      setError('Missing project or invoice.');
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

    const [invoiceRes, projectRes, roomsRes, paymentsRes, profileRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', invoiceId).single(),
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase
        .from('project_rooms')
        .select('id,name,sort_order,project_room_trades(*)')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
      supabase.from('payments').select('*').eq('invoice_id', invoiceId).order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    ]);

    if (invoiceRes.error || !invoiceRes.data) {
      setError(invoiceRes.error?.message ?? 'Invoice not found.');
      setLoading(false);
      return;
    }

    if (projectRes.error || !projectRes.data) {
      setError(projectRes.error?.message ?? 'Project not found.');
      setLoading(false);
      return;
    }

    if (paymentsRes.error) {
      const msg = paymentsRes.error.message || '';
      if (/payments/i.test(msg) && /does not exist/i.test(msg)) {
        setError('Payments table not found. Apply migration 010_payments_mobile.sql in Supabase.');
        setLoading(false);
        return;
      }
      setError(msg);
      setLoading(false);
      return;
    }

    if (roomsRes.error) {
      setError(roomsRes.error.message);
      setLoading(false);
      return;
    }

    const list = (roomsRes.data ?? []) as RoomRow[];
    for (const r of list) {
      const tr = r.project_room_trades ?? [];
      tr.sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0));
    }

    setInvoice(invoiceRes.data as InvoiceRow);
    setProject(projectRes.data as ProjectRow);
    setRooms(list);
    setPayments((paymentsRes.data ?? []) as PaymentRow[]);
    setProfile(profileRes.data as ProfileRow | null);
    setLoading(false);
  }, [projectId, invoiceId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const currency = profile?.currency || 'CAD';

  const { totalLabour, totalMaterials } = useMemo(() => {
    let labour = 0;
    let materials = 0;
    for (const room of rooms) {
      for (const t of room.project_room_trades ?? []) {
        labour += labourAmt(t);
        materials += materialsAmt(t);
      }
    }
    return { totalLabour: labour, totalMaterials: materials };
  }, [rooms]);

  const invoiceSubtotal = Number(invoice?.subtotal) || totalLabour + totalMaterials;
  const taxRate =
    invoice?.tax_rate !== undefined && invoice?.tax_rate !== null && invoice.tax_rate !== ''
      ? Number(invoice.tax_rate)
      : profile?.default_tax_percent !== undefined &&
          profile?.default_tax_percent !== null &&
          profile.default_tax_percent !== ''
        ? Number(profile.default_tax_percent)
        : 13;
  const taxAmount =
    invoice?.tax_amount !== undefined && invoice?.tax_amount !== null && invoice.tax_amount !== ''
      ? Number(invoice.tax_amount)
      : invoiceSubtotal * (taxRate / 100);
  const invoiceTotal =
    invoice?.total_amount !== undefined && invoice?.total_amount !== null && invoice.total_amount !== ''
      ? Number(invoice.total_amount)
      : invoiceSubtotal + taxAmount;

  const totalPaid = useMemo(
    () => payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [payments],
  );

  const balanceOwing = Math.max(0, invoiceTotal - totalPaid);

  const dueDateForCompare = useMemo(() => {
    if (invoice?.due_date) return new Date(invoice.due_date);
    const base = invoice?.created_at || invoice?.created_date;
    if (!base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + 7);
    return d;
  }, [invoice?.due_date, invoice?.created_at, invoice?.created_date]);

  const payStatus: PayStatus = useMemo(() => {
    if (totalPaid >= invoiceTotal && invoiceTotal > 0) return 'paid';
    if (totalPaid > 0) return 'partial';
    if (dueDateForCompare && dueDateForCompare < new Date(new Date().toDateString())) return 'overdue';
    return 'unpaid';
  }, [totalPaid, invoiceTotal, dueDateForCompare]);

  const badge = STATUS_STYLES[payStatus];
  const taxLabel = profile?.country === 'US' ? `Tax (${taxRate}%)` : `HST ${taxRate}%`;
  const depositReceived = Number(invoice?.deposit_amount) || 0;

  const handleGeneratePdf = async () => {
    const client = project?.client_name || invoice?.client_name || 'Client';
    try {
      await Share.share({
        message: `Invoice ${invoice?.invoice_number ?? ''} — ${client}: ${formatMoney(balanceOwing, currency)} owing (${formatMoney(invoiceTotal, currency)} total).`,
      });
    } catch {
      /* cancelled */
    }
  };

  const handleSendToClient = async () => {
    const client = project?.client_name || invoice?.client_name || 'Client';
    try {
      await Share.share({
        message: `Invoice for ${client}: ${formatMoney(invoiceTotal, currency)}. Balance owing: ${formatMoney(balanceOwing, currency)}.`,
      });
    } catch {
      /* cancelled */
    }
  };

  const handleRecordPayment = async () => {
    const amount = parseFloat(paymentAmount.replace(/[^0-9.-]/g, ''));
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid payment amount.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setSubmittingPayment(true);
    try {
      const { error: insErr } = await supabase.from('payments').insert({
        invoice_id: invoiceId,
        project_id: projectId,
        user_id: user.id,
        amount,
        method: paymentMethod,
        date: new Date().toISOString().split('T')[0],
        note: paymentNote.trim() || null,
      });

      if (insErr) throw insErr;

      const { data: updatedPayments, error: payFetchErr } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (payFetchErr) throw payFetchErr;

      const list = (updatedPayments ?? []) as PaymentRow[];
      setPayments(list);

      const newTotalPaid = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const paidFlag = newTotalPaid >= invoiceTotal;

      const { error: upErr } = await supabase
        .from('invoices')
        .update({
          amount_paid: newTotalPaid,
          paid: paidFlag,
        })
        .eq('id', invoiceId);

      if (upErr) throw upErr;

      setInvoice((prev) =>
        prev ? { ...prev, amount_paid: newTotalPaid, paid: paidFlag } : prev,
      );

      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not record payment.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const METHOD_OPTS = [
    { key: 'cash' as const, label: 'Cash' },
    { key: 'etransfer' as const, label: 'E-Transfer' },
    { key: 'cheque' as const, label: 'Cheque' },
    { key: 'credit' as const, label: 'Credit' },
  ];

  if (!projectId || !invoiceId) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.err}>Invalid invoice link.</Text>
      </View>
    );
  }

  const clientDisplay = project?.client_name || invoice?.client_name || 'Client';
  const addrDisplay = project?.address || invoice?.client_address || '—';
  const dueDisplay = invoice?.due_date
    ? formatDate(invoice.due_date)
    : dueDateForCompare
      ? formatDate(dueDateForCompare.toISOString())
      : '—';
  const invoiceDateDisplay = formatDate(invoice?.created_at ?? invoice?.created_date ?? null);

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button">
          <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.textWhite} />
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.kicker}>INVOICE</Text>
            <Text style={styles.clientName} numberOfLines={2}>
              {clientDisplay}
            </Text>
            <Text style={styles.totalMono}>{formatMoney(invoiceTotal, currency)}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeTxt, { color: badge.text }]}>{badge.label}</Text>
            </View>
            <Text style={styles.dateLbl}>{dueDisplay}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          <TouchableOpacity style={styles.pillWhite} onPress={() => void handleGeneratePdf()} accessibilityRole="button">
            <Text style={styles.pillWhiteTxt}>Generate PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pillFrost} onPress={() => void handleSendToClient()} accessibilityRole="button">
            <Text style={styles.pillFrostTxt}>Send to Client</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pillFrost}
            onPress={() => setShowPaymentModal(true)}
            accessibilityRole="button">
            <Text style={styles.pillFrostTxt}>Record Payment</Text>
          </TouchableOpacity>
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
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollIn, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.coRow}>
              {profile?.company_logo_url ? (
                <Image source={{ uri: profile.company_logo_url }} style={styles.logoImg} resizeMode="cover" />
              ) : (
                <LinearGradient colors={[Colors.primary, Colors.primaryDark]} style={styles.logoGrad}>
                  <Text style={[styles.logoDeg, { fontFamily: serifLogo }]}>R°</Text>
                </LinearGradient>
              )}
              <View style={styles.coMid}>
                <Text style={styles.coName}>{profile?.company_name || 'Your Company'}</Text>
                <Text style={styles.coMuted}>{profile?.company_phone || '—'}</Text>
                <Text style={styles.coMuted}>{profile?.company_email || '—'}</Text>
              </View>
              <View style={styles.coRight}>
                <Text style={styles.invHash}>INVOICE #</Text>
                <Text style={styles.invNum}>{invoice?.invoice_number || `…${invoiceId.slice(-4)}`}</Text>
                {invoice?.quote_id ? (
                  <Text style={styles.refQuote}>Ref: Q-{invoice.quote_id.replace(/-/g, '').slice(-4)}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>BILLED TO</Text>
            <Text style={styles.prepName}>{clientDisplay}</Text>
            <Text style={styles.prepAddr}>{addrDisplay}</Text>
          </View>

          <View style={[styles.card, styles.scopeCard]}>
            <View style={styles.scopeHead}>
              <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            </View>
            {rooms.length === 0 ? (
              <Text style={styles.emptyScope}>No line items.</Text>
            ) : (
              rooms.map((room) => {
                const rt = room.project_room_trades ?? [];
                const rTot = roomTotal(room);
                return (
                  <View key={room.id} style={styles.roomBlk}>
                    <View style={styles.roomHead}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomTot}>{formatMoney(rTot, currency)}</Text>
                    </View>
                    {rt.map((t) => {
                      const amt = tradeLineTotal(t);
                      return (
                        <View key={t.id} style={styles.tradeLine}>
                          <View style={styles.tradeLeft}>
                            <View style={[styles.dot, { backgroundColor: tradeColor(t.trade_id) }]} />
                            <Text style={styles.tradeLbl}>{tradeLabel(t)}</Text>
                          </View>
                          <Text style={styles.tradeAmt}>{formatMoney(amt, currency)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.totalLine}>
              <Text style={styles.tLbl}>Labour</Text>
              <Text style={styles.tVal}>{formatMoney(totalLabour, currency)}</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.tLbl}>Materials</Text>
              <Text style={styles.tVal}>{formatMoney(totalMaterials, currency)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalLine}>
              <Text style={styles.tLbl}>Subtotal</Text>
              <Text style={styles.tVal}>{formatMoney(invoiceSubtotal, currency)}</Text>
            </View>
            <View style={styles.totalLine}>
              <Text style={styles.tLbl}>{taxLabel}</Text>
              <Text style={styles.tVal}>{formatMoney(taxAmount, currency)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalLine}>
              <Text style={styles.tLbl}>Invoice Total</Text>
              <Text style={[styles.tVal, styles.tInvoiceTotal]}>{formatMoney(invoiceTotal, currency)}</Text>
            </View>

            {depositReceived > 0 ? (
              <View style={styles.totalLine}>
                <Text style={styles.depositLbl}>Deposit received</Text>
                <Text style={styles.depositVal}>{formatMoney(depositReceived, currency)}</Text>
              </View>
            ) : null}

            <View style={styles.divider} />
            <View style={styles.totalLine}>
              <Text style={[styles.balanceLbl, { color: balanceOwing <= 0 ? Colors.success : Colors.error }]}>
                Balance Owing
              </Text>
              <Text
                style={[styles.balanceVal, { color: balanceOwing <= 0 ? Colors.success : Colors.error }]}>
                {formatMoney(balanceOwing, currency)}
              </Text>
            </View>
          </View>

          <View style={[styles.card, styles.scopeCard]}>
            <View style={styles.scopeHead}>
              <Text style={styles.sectionLabel}>PAYMENT HISTORY</Text>
            </View>
            {payments.length === 0 ? (
              <Text style={styles.emptyPay}>No payments recorded yet</Text>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.payRow}>
                  <View style={styles.payLeft}>
                    <Text style={styles.payMethod}>{formatMethod(payment.method)}</Text>
                    <Text style={styles.payMeta}>
                      {formatDate(payment.date ?? payment.created_at)}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.payAmt}>{formatMoney(Number(payment.amount) || 0, currency)}</Text>
                </View>
              ))
            )}
            <View style={styles.recordWrap}>
              <TouchableOpacity
                style={styles.recordBtnOuter}
                onPress={() => setShowPaymentModal(true)}
                accessibilityRole="button">
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.recordBtnGrad}>
                  <Text style={styles.recordBtnTxt}>+ Record Payment</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.dueRow}>
              <Text style={styles.dueLbl}>Invoice date</Text>
              <Text style={styles.dueVal}>{invoiceDateDisplay}</Text>
            </View>
            <View style={styles.dueRow}>
              <Text style={styles.dueLbl}>Due date</Text>
              <Text style={[styles.dueVal, payStatus === 'overdue' ? styles.dueOverdue : null]}>{dueDisplay}</Text>
            </View>
            <View style={styles.dueRow}>
              <Text style={styles.dueLbl}>Terms</Text>
              <Text style={styles.dueVal}>Net 7</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.modalTitle}>Record Payment</Text>

            <Text style={styles.sectionLabel}>AMOUNT</Text>
            <TextInput
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              placeholder="$0.00"
              placeholderTextColor="#aaaaaa"
              style={styles.amountIn}
            />

            <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
            <View style={styles.segmentTrack}>
              {METHOD_OPTS.map(({ key, label }) => {
                const on = paymentMethod === key;
                return (
                  <TouchableOpacity key={key} style={styles.segmentFlex} onPress={() => setPaymentMethod(key)}>
                    <View style={[styles.segmentPill, on ? styles.segmentOn : styles.segmentOff]}>
                      <Text style={[styles.segmentTxt, on ? styles.segmentTxtOn : styles.segmentTxtOff]} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              value={paymentNote}
              onChangeText={setPaymentNote}
              placeholder="e.g. deposit cheque #1234"
              placeholderTextColor="#aaaaaa"
              style={styles.noteIn}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPaymentModal(false)} accessibilityRole="button">
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtnOuter}
                onPress={() => void handleRecordPayment()}
                disabled={submittingPayment}
                accessibilityRole="button">
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.confirmBtnGrad}>
                  {submittingPayment ? (
                    <ActivityIndicator color={Colors.textWhite} />
                  ) : (
                    <Text style={styles.confirmTxt}>Confirm Payment</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.screenBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  headerLeft: { flex: 1, minWidth: 0 },
  headerRight: { alignItems: 'flex-end' },
  kicker: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.5)',
  },
  clientName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  totalMono: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: FONT_MONO,
  },
  badge: {
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  badgeTxt: { fontSize: 10, fontWeight: '600' },
  dateLbl: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pillWhite: {
    backgroundColor: Colors.textWhite,
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillWhiteTxt: { fontSize: 11, fontWeight: '600', color: Colors.primary },
  pillFrost: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillFrostTxt: { fontSize: 11, fontWeight: '600', color: Colors.textWhite },

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

  card: {
    backgroundColor: Colors.cardBg,
    borderRadius: 12,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: 8,
  },

  coRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoImg: { width: 48, height: 48, borderRadius: 10 },
  logoGrad: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDeg: { fontSize: 18, color: Colors.textWhite },
  coMid: { flex: 1, minWidth: 0 },
  coName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  coMuted: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  coRight: { alignItems: 'flex-end' },
  invHash: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: '#aaaaaa' },
  invNum: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, fontFamily: FONT_MONO, marginTop: 2 },
  refQuote: { fontSize: 10, color: '#aaaaaa', marginTop: 4 },

  prepName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  prepAddr: { fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },

  scopeCard: { overflow: 'hidden', paddingHorizontal: 0, paddingVertical: 0 },
  scopeHead: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e8e8e8',
  },
  emptyScope: { padding: 16, fontSize: 13, color: Colors.textSecondary },
  roomBlk: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ececec',
  },
  roomHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  roomName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flex: 1, paddingRight: 8 },
  roomTot: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, fontFamily: FONT_MONO },
  tradeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingLeft: 2,
  },
  tradeLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tradeLbl: { fontSize: 11, color: Colors.textSecondary },
  tradeAmt: { fontSize: 11, color: Colors.textSecondary, fontFamily: FONT_MONO },

  totalLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  tLbl: { fontSize: 13, color: Colors.textSecondary },
  tVal: { fontSize: 13, color: Colors.textPrimary, fontFamily: FONT_MONO },
  tInvoiceTotal: { fontSize: 15, fontWeight: '700' },
  divider: { height: 0.5, backgroundColor: '#e0e0e0', marginVertical: 8 },
  depositLbl: { fontSize: 13, color: Colors.success },
  depositVal: { fontSize: 13, color: Colors.success, fontFamily: FONT_MONO },
  balanceLbl: { fontSize: 15, fontWeight: '700' },
  balanceVal: { fontSize: 17, fontWeight: '700', fontFamily: FONT_MONO },

  emptyPay: { fontSize: 13, color: '#aaaaaa', textAlign: 'center', paddingVertical: 14 },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ececec',
  },
  payLeft: { flex: 1, paddingRight: 12 },
  payMethod: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  payMeta: { fontSize: 11, color: '#aaaaaa', marginTop: 2 },
  payAmt: { fontSize: 13, fontWeight: '600', color: Colors.success, fontFamily: FONT_MONO },

  recordWrap: { paddingHorizontal: 14, paddingVertical: 12 },
  recordBtnOuter: { borderRadius: 100, overflow: 'hidden', minHeight: 44 },
  recordBtnGrad: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  recordBtnTxt: { fontSize: 12, fontWeight: '600', color: Colors.textWhite },

  dueRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dueLbl: { fontSize: 12, color: Colors.textSecondary },
  dueVal: { fontSize: 12, color: Colors.textPrimary, fontFamily: FONT_MONO },
  dueOverdue: { color: Colors.error },

  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    backgroundColor: Colors.textWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  amountIn: {
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    fontSize: 22,
    fontWeight: '600',
    fontFamily: FONT_MONO,
    marginBottom: 16,
    color: Colors.textPrimary,
  },
  segmentTrack: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#e8e8ec',
    borderRadius: 100,
    padding: 3,
    gap: 4,
    marginBottom: 16,
  },
  segmentFlex: { flexGrow: 1, flexBasis: '45%' },
  segmentPill: {
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segmentOn: {
    backgroundColor: Colors.textWhite,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentOff: { backgroundColor: 'transparent' },
  segmentTxt: { fontSize: 11, fontWeight: '600' },
  segmentTxtOn: { color: Colors.textPrimary },
  segmentTxtOff: { color: Colors.textSecondary },
  noteIn: {
    backgroundColor: Colors.cardBg,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 24,
    minHeight: 72,
    textAlignVertical: 'top',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  modalActions: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelTxt: { fontSize: 14, color: Colors.textSecondary },
  confirmBtnOuter: { flex: 2, borderRadius: 100, overflow: 'hidden', minHeight: 48 },
  confirmBtnGrad: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  confirmTxt: { fontSize: 14, fontWeight: '600', color: Colors.textWhite },
});
