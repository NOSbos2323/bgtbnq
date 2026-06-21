import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ar" | "en";

type Dict = Record<string, string>;

const ar: Dict = {
  app_name: "نيو بنك",
  tagline: "بنكك الإلكتروني بالدولار الأمريكي",
  // auth
  login: "تسجيل الدخول",
  signup: "إنشاء حساب",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  full_name: "الاسم الكامل",
  phone: "رقم الهاتف",
  referral_optional: "كود الإحالة (اختياري)",
  have_account: "لديك حساب؟",
  no_account: "ليس لديك حساب؟",
  continue: "متابعة",
  loading: "جاري التحميل…",
  // nav
  home: "الرئيسية",
  cards: "البطاقات",
  deposit: "شحن",
  loans: "قروض",
  settings: "الإعدادات",
  admin: "الإدارة",
  logout: "تسجيل الخروج",
  // dashboard
  total_balance: "الرصيد الإجمالي",
  hide_balance: "إخفاء الرصيد",
  show_balance: "إظهار الرصيد",
  quick_actions: "إجراءات سريعة",
  recharge: "شحن سريع",
  request_loan: "طلب قرض",
  new_card: "بطاقة جديدة",
  recent_activity: "أحدث المعاملات",
  no_activity: "لا توجد معاملات بعد.",
  // deposit
  deposit_title: "شحن عبر BaridiMob",
  rip_label: "رقم حساب RIP",
  copy: "نسخ",
  copied: "تم النسخ",
  amount_usd: "المبلغ بالدولار",
  amount_dzd: "المبلغ بالدينار",
  exchange_rate: "سعر الصرف",
  upload_receipt: "ارفع وصل التحويل",
  submit_deposit: "إرسال للمراجعة",
  pending_review: "قيد المراجعة",
  approved: "موافق عليه",
  rejected: "مرفوض",
  my_deposits: "طلباتي السابقة",
  // cards
  virtual_cards: "البطاقات الافتراضية",
  create_card: "إنشاء بطاقة",
  card_balance: "رصيد البطاقة",
  topup: "شحن",
  freeze: "تجميد",
  unfreeze: "إلغاء التجميد",
  cancel: "إلغاء",
  // loans
  loan_calculator: "حاسبة القروض",
  amount: "المبلغ",
  installments: "عدد الأقساط",
  total_repay: "إجمالي السداد",
  installment_value: "قيمة القسط",
  submit_loan: "طلب القرض",
  // referrals
  referral_program: "برنامج الإحالة",
  your_code: "كودك الخاص",
  referral_hint: "احصل على 5$ عند أول شحن لكل من تدعوهم.",
  // settings
  account: "الحساب",
  security: "الأمان",
  notifications: "الإشعارات",
  language: "اللغة",
  change_password: "تغيير كلمة المرور",
  twofa: "التحقق الثنائي (2FA)",
  // admin
  admin_panel: "لوحة الإدارة",
  pending_deposits: "طلبات الشحن المعلقة",
  approve: "موافقة",
  reject: "رفض",
  user: "المستخدم",
  amount_col: "المبلغ",
  receipt: "الوصل",
  actions: "إجراءات",
  view: "عرض",
  total_users: "إجمالي المستخدمين",
  total_deposits_today: "إيداعات اليوم",
  pending_count: "المعلقة",
  // misc
  welcome: "مرحباً",
  back: "رجوع",
  save: "حفظ",
  saved: "تم الحفظ",
  error_generic: "حدث خطأ، حاول مرة أخرى.",
};

const en: Dict = {
  app_name: "NeoBank",
  tagline: "Your USD digital bank",
  login: "Sign in",
  signup: "Create account",
  email: "Email",
  password: "Password",
  full_name: "Full name",
  phone: "Phone",
  referral_optional: "Referral code (optional)",
  have_account: "Already have an account?",
  no_account: "No account yet?",
  continue: "Continue",
  loading: "Loading…",
  home: "Home",
  cards: "Cards",
  deposit: "Deposit",
  loans: "Loans",
  settings: "Settings",
  admin: "Admin",
  logout: "Sign out",
  total_balance: "Total balance",
  hide_balance: "Hide balance",
  show_balance: "Show balance",
  quick_actions: "Quick actions",
  recharge: "Top up",
  request_loan: "Request loan",
  new_card: "New card",
  recent_activity: "Recent activity",
  no_activity: "No transactions yet.",
  deposit_title: "Top up via BaridiMob",
  rip_label: "RIP account number",
  copy: "Copy",
  copied: "Copied",
  amount_usd: "Amount in USD",
  amount_dzd: "Amount in DZD",
  exchange_rate: "Exchange rate",
  upload_receipt: "Upload transfer receipt",
  submit_deposit: "Submit for review",
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  my_deposits: "My previous requests",
  virtual_cards: "Virtual cards",
  create_card: "Create card",
  card_balance: "Card balance",
  topup: "Top up",
  freeze: "Freeze",
  unfreeze: "Unfreeze",
  cancel: "Cancel",
  loan_calculator: "Loan calculator",
  amount: "Amount",
  installments: "Installments",
  total_repay: "Total repayment",
  installment_value: "Per installment",
  submit_loan: "Request loan",
  referral_program: "Referral program",
  your_code: "Your code",
  referral_hint: "Earn $5 when each referred user makes their first top-up.",
  account: "Account",
  security: "Security",
  notifications: "Notifications",
  language: "Language",
  change_password: "Change password",
  twofa: "Two-factor authentication (2FA)",
  admin_panel: "Admin panel",
  pending_deposits: "Pending deposits",
  approve: "Approve",
  reject: "Reject",
  user: "User",
  amount_col: "Amount",
  receipt: "Receipt",
  actions: "Actions",
  view: "View",
  total_users: "Total users",
  total_deposits_today: "Today's deposits",
  pending_count: "Pending",
  welcome: "Welcome",
  back: "Back",
  save: "Save",
  saved: "Saved",
  error_generic: "Something went wrong, try again.",
};

const dicts: Record<Lang, Dict> = { ar, en };

interface I18nContextValue {
  lang: Lang;
  dir: "rtl" | "ltr";
  t: (key: keyof typeof ar) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("lang") as Lang | null) ?? "ar";
    setLangState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };

  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = (key: keyof typeof ar) => dicts[lang][key] ?? String(key);

  return <I18nContext.Provider value={{ lang, dir, t, setLang }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
