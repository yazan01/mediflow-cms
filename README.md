# MediFlow CMS

نظام إدارة عيادات متكامل (Clinic ERP) مبني على FastAPI + Next.js + MySQL.

---

## المميزات

- **إدارة المرضى** — تسجيل، تاريخ طبي، حساسيات، أمراض مزمنة
- **المواعيد** — جدولة، تسجيل الحضور، تتبع الحالة، تعيين الأطباء
- **السجل الطبي الإلكتروني (EMR)** — استشارات، علامات حيوية، نتائج مختبر وأشعة
- **الفواتير** — فواتير، مدفوعات، مطالبات تأمين، نسبة التحمّل (co-pay)
- **الصيدلية** — مخزون الأدوية، حركة المخزون، صرف الوصفات
- **المختبر والأشعة** — تتبع الطلبات، إدخال النتائج
- **الموارد البشرية** — موظفون، حضور، إجازات، رواتب، مناوبات
- **المحاسبة** — نظرة مالية، أصول، مصروفات، موردون، أوامر شراء
- **التقارير** — إيرادات، إحصاءات المرضى، أداء الأقسام
- **إدارة المستخدمين** — صلاحيات مبنية على الأدوار (RBAC)
- **سجل التدقيق** — تتبع كامل لكل النشاطات
- **متعدد الفروع** — إدارة فروع متعددة لكل فرع موظفوه ومواعيده وماليته
- **ثنائي اللغة** — عربي وإنجليزي كامل مع دعم RTL

---

## الـ Tech Stack

| الطبقة | التقنية |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11) — المنفذ 8000 |
| قاعدة البيانات | MySQL 8.4 |
| ORM | SQLAlchemy 2.0 + PyMySQL |
| Migrations | Alembic 1.14 |
| المصادقة | JWT (python-jose) + bcrypt (passlib) |
| واجهة المستخدم | Tailwind CSS v4، Material Symbols، Recharts |
| Rate Limiting | slowapi |
| Edge JWT | jose (Next.js middleware) |

---

## المعمارية

```
المتصفح → Nginx :443 → Next.js :3000 (frontend)
                     → FastAPI :8000 (api/*)
                            ↓
                          MySQL
```

> **dev فقط:** المتصفح → Next.js :3000 → (proxy rewrite) → FastAPI :8000 → MySQL

---

## المتطلبات الأساسية

| البرنامج | الإصدار المطلوب |
|---|---|
| Python | 3.11 أو أحدث |
| Node.js | 20 أو أحدث |
| MySQL | 8.4 |

---

## التشغيل المحلي (Windows — بيئة تطوير)

### التثبيت الأول

```cmd
install.bat
```

يقوم تلقائياً بتثبيت المكتبات، إنشاء قاعدة البيانات، وإضافة المستخدم الافتراضي.

### التشغيل اليومي

```cmd
start.bat    # يشغّل MySQL + Backend + Frontend
stop.bat     # يوقف جميع الخدمات
```

### التشغيل اليدوي (للتطوير)

**Terminal 1 — Backend:**
```cmd
cd backend
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```cmd
npm run dev
```

> يستخدم `--webpack`. لا تستخدم Turbopack — يفشل مع مسارات تحتوي مسافات.

### بيانات الدخول الافتراضية

```
URL:       http://localhost:3000
البريد:    admin@mediflow.com
كلمة السر: Admin@1234
```

> غيّر كلمة المرور فوراً بعد أول دخول.

---

## النشر على Ubuntu Server (بيئة إنتاج)

> مُختبَر على **Ubuntu 22.04 / 24.04**.

### الطريقة السريعة — سكريبت تلقائي

```bash
# 1. استنساخ المشروع
git clone https://github.com/YOUR_USERNAME/mediflow-cms.git /opt/mediflow

# 2. تشغيل سكريبت النشر (يثبّت كل شيء)
sudo bash /opt/mediflow/deploy/deploy.sh
```

السكريبت سيوقف في منتصفه ويطلب منك تعبئة ملفات `.env`. بعد التعبئة شغّله مرة ثانية.

### إعداد ملفات البيئة يدوياً

**`/opt/mediflow/backend/.env`** (انسخ من `.env.example`):

```env
DATABASE_URL=mysql+pymysql://mediflow:STRONG_PASSWORD@localhost:3306/mediflow_db
JWT_SECRET=سلسلة_عشوائية_64_حرف_على_الأقل
SETTINGS_ENCRYPTION_KEY=مفتاح_Fernet
ALLOWED_ORIGINS=https://yourdomain.com
COOKIE_SECURE=true
```

**`/opt/mediflow/.env.local`** (انسخ من `.env.example`):

```env
BACKEND_URL=http://localhost:8000
JWT_SECRET=نفس_القيمة_الموجودة_في_backend
```

### توليد المفاتيح السرية

```bash
# JWT_SECRET
python3 -c "import secrets; print(secrets.token_hex(64))"

# SETTINGS_ENCRYPTION_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### تفعيل HTTPS

```bash
sudo certbot --nginx -d yourdomain.com
```

---

## تحديث النظام (بعد كل push)

```bash
sudo bash /opt/mediflow/deploy/update.sh
```

يقوم تلقائياً بـ: `git pull` → تحديث مكتبات Python → تطبيق migrations → بناء Next.js → إعادة تشغيل الخدمات.

---

## إدارة قاعدة البيانات

### Migrations — Alembic (موصى به للإنتاج)

```bash
cd backend
source .venv/bin/activate   # Linux
# أو: .venv\Scripts\activate  (Windows)

# إنشاء migration جديد بعد تعديل models.py
alembic revision --autogenerate -m "وصف التعديل"

# تطبيق جميع الـ migrations المعلّقة
alembic upgrade head

# التراجع عن آخر migration
alembic downgrade -1

# عرض الحالة الحالية
alembic current
```

### إعادة تعيين قاعدة البيانات (للتطوير فقط — يحذف كل البيانات)

```bash
cd backend
python reset_db.py --confirm
```

> **تحذير:** لا تشغّل هذا على الإنتاج.

---

## مراقبة الخدمات (Ubuntu)

```bash
# حالة الخدمات
sudo systemctl status mediflow-backend mediflow-frontend nginx mysql

# متابعة logs مباشرة
sudo journalctl -u mediflow-backend -f
sudo journalctl -u mediflow-frontend -f

# إعادة تشغيل خدمة
sudo systemctl restart mediflow-backend
sudo systemctl restart mediflow-frontend
```

---

## المتغيرات البيئية — مرجع كامل

### `backend/.env`

| المتغير | الوصف | مثال |
|---|---|---|
| `DATABASE_URL` | رابط قاعدة البيانات | `mysql+pymysql://user:pass@localhost:3306/mediflow_db` |
| `JWT_SECRET` | مفتاح توقيع JWT — **لا تشاركه** | سلسلة hex طولها 64+ حرف |
| `SETTINGS_ENCRYPTION_KEY` | مفتاح تشفير Fernet (أسرار 2FA وAPI keys) | مفتاح Fernet base64 |
| `ALLOWED_ORIGINS` | نطاقات CORS مفصولة بفاصلة | `https://yourdomain.com` |
| `COOKIE_SECURE` | `true` في الإنتاج (HTTPS)، `false` محلياً | `true` |
| `REDIS_URL` | اختياري — cache موزّع للإعدادات | `redis://localhost:6379/0` |

### `.env.local` (Frontend)

| المتغير | الوصف |
|---|---|
| `JWT_SECRET` | **نفس القيمة** في backend — لفك تشفير الكوكي |
| `BACKEND_URL` | عنوان الـ backend الداخلي (افتراضي: `http://localhost:8000`) |

---

## هيكل الملفات

```
mediflow-cms/
├── install.bat / start.bat / stop.bat   # أدوات Windows
├── .env.example                         # قالب متغيرات Frontend
├── next.config.ts                       # Proxy + security headers
├── deploy/                              # ملفات Ubuntu production
│   ├── deploy.sh                        # نشر أول مرة
│   ├── update.sh                        # تحديث النظام
│   ├── nginx.conf                       # Nginx reverse proxy + HTTPS
│   ├── mediflow-backend.service         # systemd — FastAPI
│   └── mediflow-frontend.service        # systemd — Next.js
├── backend/
│   ├── main.py                          # FastAPI app + CORS + rate limiting
│   ├── models.py                        # جميع نماذج SQLAlchemy
│   ├── auth.py                          # JWT، bcrypt، token blocklist
│   ├── database.py                      # SQLAlchemy engine + connection pool
│   ├── seed.py                          # بيانات أولية (admin user)
│   ├── reset_db.py                      # مسح وإعادة بناء (dev only)
│   ├── requirements.txt
│   ├── alembic.ini                      # إعداد Alembic migrations
│   ├── .env.example                     # قالب المتغيرات البيئية
│   ├── .env                             # ← لا ترفعه على Git
│   ├── .venv/                           # Python virtual environment
│   ├── migrations/
│   │   ├── env.py                       # Alembic env — يقرأ .env تلقائياً
│   │   ├── script.py.mako               # قالب migration
│   │   └── versions/                   # ملفات migrations المولّدة
│   └── routers/                         # router لكل وحدة
├── src/
│   ├── middleware.ts                    # حماية routes بـ JWT (Edge Runtime)
│   ├── app/(dashboard)/                 # صفحات النظام المحمية
│   ├── app/(auth)/login/                # صفحة الدخول
│   ├── components/
│   │   ├── layout/DashboardShell.tsx    # session timeout + mobile sidebar
│   │   ├── layout/Sidebar.tsx
│   │   ├── layout/TopBar.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ErrorBanner.tsx
│   └── lib/
│       ├── utils.ts
│       ├── TimezoneContext.tsx
│       ├── hooks/useDebounce.ts
│       ├── hooks/useDataFetch.ts
│       └── i18n/translations.ts        # قاموس عربي/إنجليزي
└── .env.local                          # ← لا ترفعه على Git
```

---

## ملاحظات الأمان للإنتاج

- `COOKIE_SECURE=true` إلزامي مع HTTPS — يمنع إرسال الكوكي عبر HTTP
- `JWT_SECRET` يجب أن يكون مختلفاً في كل عميل — لا تكرر نفس القيمة
- لا ترفع `.env` أو `.env.local` على Git — مضافان في `.gitignore`
- الجلسة تنتهي تلقائياً بعد **30 دقيقة من عدم النشاط**
- JWT token يُبطَل فور تسجيل الخروج عبر token blocklist
- Rate limiting: 10 محاولات دخول في الدقيقة لكل IP
- Cookie مُعيَّن كـ `HttpOnly` + `SameSite=Strict`
- CSRF protection: double-submit cookie على جميع طلبات POST/PATCH/DELETE
