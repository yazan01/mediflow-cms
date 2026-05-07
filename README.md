# MediFlow CMS

نظام إدارة عيادات متكامل (Clinic ERP) مبني على FastAPI + Next.js + MySQL.

---

## المميزات

- **إدارة المرضى** — تسجيل، تاريخ طبي، حساسيات، أمراض مزمنة
- **المواعيد** — جدولة، تسجيل الحضور، تتبع الحالة، تعيين الأطباء
- **السجل الطبي الإلكتروني (EMR)** — استشارات، علامات حيوية، نتائج مختبر وأشعة
- **الفواتير** — فواتير، مدفوعات، مطالبات تأمين
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

## المتطلبات الأساسية

| البرنامج | الإصدار المطلوب |
|---|---|
| Python | 3.11 أو أحدث |
| Node.js | 20 أو أحدث |
| npm | 10 أو أحدث (يأتي مع Node.js) |
| MySQL | 8.4 |

---

## التثبيت على Windows — بيئة محلية

### الطريقة السريعة (نقرة واحدة)

انقر مزدوجاً على `install.bat` أو شغّله من `cmd`:

```cmd
install.bat
```

يقوم تلقائياً بـ:
- التحقق من إصدارات Python وNode.js
- إنشاء Python virtual environment في `backend/.venv`
- تثبيت جميع مكتبات Python وNode.js
- طلب بيانات اتصال MySQL
- إنشاء قاعدة البيانات `mediflow` وجميع الجداول
- إضافة المستخدم الافتراضي
- توليد ملف `backend/.env` تلقائياً

### التشغيل اليومي

```cmd
start.bat    # يشغّل MySQL + Backend + Frontend ويفتح المتصفح
stop.bat     # يوقف جميع الخدمات
```

### بيانات الدخول الافتراضية

```
URL:       http://localhost:3000
البريد:    admin@mediflow.com
كلمة السر: Admin@1234
```

> غيّر كلمة المرور فوراً بعد أول دخول.

---

## التثبيت على Linux Server — بيئة إنتاج

> مُختبَر على **Ubuntu 22.04 / 24.04**. يعمل كذلك على Debian وRocky Linux مع تعديل مدير الحزم فقط.

---

### الخطوة 1 — تحديث النظام

```bash
sudo apt update && sudo apt upgrade -y
```

---

### الخطوة 2 — تثبيت Python 3.11

```bash
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
python3.11 --version   # يجب أن يظهر: Python 3.11.x
```

---

### الخطوة 3 — تثبيت Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v20.x.x
npm --version    # 10.x.x
```

---

### الخطوة 4 — تثبيت MySQL 8.4

```bash
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
```

تأمين التثبيت:

```bash
sudo mysql_secure_installation
```

إنشاء قاعدة البيانات والمستخدم المخصص:

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE mediflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mediflow_user'@'localhost' IDENTIFIED BY 'ضع_كلمة_مرور_قوية_هنا';
GRANT ALL PRIVILEGES ON mediflow.* TO 'mediflow_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

### الخطوة 5 — نقل ملفات المشروع للسيرفر

```bash
# عبر Git
git clone https://github.com/your-org/mediflow-cms.git /opt/mediflow

# أو عبر SCP من جهازك المحلي
scp -r ./mediflow-cms user@your-server:/opt/mediflow
```

```bash
cd /opt/mediflow
```

---

### الخطوة 6 — إعداد Backend

```bash
cd /opt/mediflow/backend

# إنشاء virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# تثبيت المكتبات
pip install -r requirements.txt
```

إنشاء ملف `.env`:

```bash
nano /opt/mediflow/backend/.env
```

```env
DATABASE_URL=mysql+pymysql://mediflow_user:كلمة_المرور@localhost:3306/mediflow
JWT_SECRET=ضع_هنا_سلسلة_عشوائية_طويلة_64_حرف_على_الأقل
ALLOWED_ORIGINS=https://your-domain.com
```

توليد `JWT_SECRET` عشوائي:

```bash
python3 -c "import secrets; print(secrets.token_hex(64))"
```

> **مهم:** `JWT_SECRET` يجب أن يكون نفس القيمة في الـ backend وفي الـ frontend.

إنشاء الجداول وإضافة البيانات الأولية:

```bash
cd /opt/mediflow/backend
source .venv/bin/activate
python reset_db.py --confirm
```

---

### الخطوة 7 — إعداد Frontend

```bash
cd /opt/mediflow

# تثبيت المكتبات
npm install

# إنشاء ملف المتغيرات البيئية
nano .env.local
```

```env
JWT_SECRET=نفس_القيمة_الموجودة_في_backend_env
BACKEND_URL=http://127.0.0.1:8000
```

بناء النسخة الإنتاجية:

```bash
npm run build
```

---

### الخطوة 8 — تشغيل Backend كخدمة نظام (systemd)

```bash
sudo nano /etc/systemd/system/mediflow-backend.service
```

```ini
[Unit]
Description=MediFlow FastAPI Backend
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mediflow/backend
Environment="PATH=/opt/mediflow/backend/.venv/bin"
ExecStart=/opt/mediflow/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mediflow-backend
sudo systemctl start mediflow-backend
sudo systemctl status mediflow-backend   # تأكد أنه يعمل
```

---

### الخطوة 9 — تشغيل Frontend كخدمة نظام (systemd)

```bash
sudo nano /etc/systemd/system/mediflow-frontend.service
```

```ini
[Unit]
Description=MediFlow Next.js Frontend
After=network.target mediflow-backend.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/mediflow
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable mediflow-frontend
sudo systemctl start mediflow-frontend
sudo systemctl status mediflow-frontend   # تأكد أنه يعمل
```

---

### الخطوة 10 — إعداد Nginx كـ Reverse Proxy

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/mediflow
```

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/mediflow /etc/nginx/sites-enabled/
sudo nginx -t           # تحقق من صحة الإعداد
sudo systemctl reload nginx
```

---

### الخطوة 11 — تفعيل HTTPS بـ SSL (Certbot)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

يُحدِّث certbot ملف Nginx تلقائياً ليضيف HTTPS. للتجديد التلقائي:

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# اختبار التجديد
sudo certbot renew --dry-run
```

---

## المتغيرات البيئية — مرجع كامل

### `backend/.env`

| المتغير | مثال | الوصف |
|---|---|---|
| `DATABASE_URL` | `mysql+pymysql://user:pass@localhost:3306/mediflow` | رابط الاتصال بقاعدة البيانات |
| `JWT_SECRET` | سلسلة عشوائية 64+ حرف | مفتاح توقيع JWT — **يجب تغييره في الإنتاج** |
| `ALLOWED_ORIGINS` | `https://your-domain.com` | نطاقات CORS (افصل بفاصلة لأكثر من نطاق) |

### `.env.local` (Frontend)

| المتغير | الوصف |
|---|---|
| `JWT_SECRET` | **نفس القيمة** الموجودة في backend — لفك تشفير الكوكي |
| `BACKEND_URL` | عنوان الـ backend الداخلي (افتراضي: `http://localhost:8000`) |

---

## أوامر مفيدة بعد التشغيل

```bash
# متابعة logs الـ backend
sudo journalctl -u mediflow-backend -f

# متابعة logs الـ frontend
sudo journalctl -u mediflow-frontend -f

# حالة جميع الخدمات دفعة واحدة
sudo systemctl status mediflow-backend mediflow-frontend nginx mysql

# تحديث الكود وإعادة النشر
cd /opt/mediflow
git pull
npm run build
sudo systemctl restart mediflow-frontend
sudo systemctl restart mediflow-backend
```

---

## إعادة تعيين قاعدة البيانات

```bash
cd /opt/mediflow/backend
source .venv/bin/activate
python reset_db.py --confirm
```

> **تحذير:** يحذف جميع البيانات. تُعطيك 3 ثوانٍ للإلغاء بـ `Ctrl+C`.

---

## هيكل الملفات

```
mediflow-cms/
├── install.bat                   # مثبّت Windows بنقرة واحدة
├── start.bat / stop.bat          # تشغيل/إيقاف (Windows)
├── public/
│   └── robots.txt               # يمنع فهرسة محركات البحث
├── backend/
│   ├── main.py                  # FastAPI app + CORS + rate limiting
│   ├── models.py                # جميع نماذج SQLAlchemy
│   ├── auth.py                  # JWT، bcrypt، token blocklist
│   ├── seed.py                  # بيانات أولية (admin user)
│   ├── reset_db.py              # مسح وإعادة بناء قاعدة البيانات
│   ├── requirements.txt
│   ├── .env                     # ← لا ترفعه على Git
│   ├── .venv/                   # Python virtual environment
│   └── routers/                 # router لكل وحدة
├── src/
│   ├── middleware.ts             # حماية routes بـ JWT (Edge Runtime)
│   ├── app/(dashboard)/         # صفحات النظام المحمية
│   ├── app/(auth)/login/        # صفحة الدخول
│   ├── components/
│   │   ├── layout/
│   │   │   ├── DashboardShell.tsx  # session timeout + mobile sidebar
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── ErrorBanner.tsx
│   └── lib/
│       ├── hooks/useDebounce.ts
│       ├── hooks/useDataFetch.ts
│       ├── TimezoneContext.tsx
│       └── i18n/translations.ts  # قاموس عربي/إنجليزي
├── .env.local                   # ← لا ترفعه على Git
└── next.config.ts               # proxy + security headers
```

---

## ملاحظات الأمان للإنتاج

- `JWT_SECRET` يجب أن يكون **مختلفاً** في كل بيئة — لا تستخدم القيمة الافتراضية
- لا ترفع `.env` أو `.env.local` على Git — مضافان في `.gitignore`
- الجلسة تنتهي تلقائياً بعد **30 دقيقة من عدم النشاط** (تحذير + countdown تلقائي)
- JWT token يُبطَل فور تسجيل الخروج عبر token blocklist في قاعدة البيانات
- Rate limiting: 10 محاولات دخول في الدقيقة لكل IP
- Cookie مُعيَّن كـ `HttpOnly` + `SameSite=Strict` — لا يمكن للـ JavaScript قراءته

---

## الـ Tech Stack

| الطبقة | التقنية |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| Backend | FastAPI (Python 3.11) — المنفذ 8000 |
| قاعدة البيانات | MySQL 8.4 |
| ORM | SQLAlchemy 2.0 + PyMySQL |
| المصادقة | JWT (python-jose) + bcrypt (passlib) |
| واجهة المستخدم | Tailwind CSS v4، Material Symbols، Recharts |
| Rate Limiting | slowapi |
| Edge JWT | jose (Next.js middleware) |

---

## المعمارية

```
المتصفح → Next.js :3000 → (proxy rewrite) → FastAPI :8000 → MySQL
```

جميع طلبات `/api/*` تمر عبر Next.js proxy — لا توجد Next.js API routes.
