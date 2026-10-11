# iRaMzipa

منصة خاصة لرفع وتوقيع وتثبيت تطبيقات iOS (IPA)، مع تجهيز البنية لمكتبة تطبيقات لاحقًا.
A private platform to upload, sign and install iOS apps (IPA), built to grow into an app library.

## ما الذي يعمل الآن / What works now

- رفع IPA وتحليله: Bundle ID، الاسم، الإصدار، الحجم، الحد الأدنى لـ iOS، الأجهزة، وأيقونة (تحويل صيغة CgBI الخاصة بـ Apple).
- رفع شهادات P12 وملفات `.mobileprovision` مع تشفيرها AES-256-GCM، وعرض تاريخ الانتهاء ونوع الشهادة.
- توقيع IPA عبر `zsign` مع فحوص قبل التوقيع (الفريق، Bundle ID، الشهادة ضمن الملف، الصلاحية، نوع الشهادة) وفحوص بعده (Bundle ID، UUID الملف المضمّن، توقيع الكود).
- منع النشر لأي تطبيق غير موقّع أو بملف منتهٍ. أي نسخة جديدة تلغي النشر والتوقيع السابق.
- صفحة تطبيق عامة، ورابط قابل للمشاركة، ونسخ/مشاركة/واتساب.
- زر تثبيت بحالات حقيقية: جاهز ← جارٍ التحقق ← بدء التثبيت. لا يعرض نجاحًا لأن iOS لا يسمح للموقع بتأكيد اكتمال التثبيت.
- تثبيت OTA عبر `itms-services` مع `manifest.plist` وروابط تنزيل موقّعة قصيرة العمر.
- لوحة مدير: تسجيل دخول بكلمة مرور (scrypt) + رمز TOTP، جلسة HttpOnly، تحديد محاولات الدخول، سجلات للأخطاء والعمليات.
- عربي RTL وإنجليزي LTR، وضع نهاري/ليلي/تلقائي، ثلاث نظم ألوان (Blue الافتراضي، Purple، Aurora) قابلة للتغيير من الإعدادات.

## ما يحتاج أشياء خارجية / What needs external pieces

| الجزء | ما يلزم |
|---|---|
| توقيع بشهادة Apple الحقيقية | شهادة Apple Distribution أو Development وملف Provisioning Profile من حسابك في Apple Developer. التوقيع بشهادة Ad Hoc يعمل فقط على الأجهزة المسجّلة في الملف. |
| تثبيت فعلي على iPhone | نطاق HTTPS حقيقي (Cloudflare)، وجهاز مسجّل UDID ضمن الملف. |
| UDID تلقائيًا | غير منفّذ. يتطلب ملف Configuration موقّعًا ونقطة استقبال. الملف يحدّد الأجهزة، وiOS هو من يرفض التثبيت للجهاز غير المسجّل. |
| توزيع عام | غير مسموح به هنا. TestFlight أو App Store فقط. |
| فحص codesign كامل | يحتاج macOS. الفحص الحالي يتحقق من البنية وUUID والبيانات، لا من سلسلة Apple. |

## التشغيل المحلي / Local setup

```bash
npm install
cp .env.example .env.local        # عدّل القيم
npm run hash-password -- "كلمة-مرور-قوية-12+"   # الصق الناتج في ADMIN_PASSWORD_HASH
openssl rand -base64 48            # SESSION_SECRET
openssl rand -base64 32            # CERT_ENCRYPTION_KEY
npm run build && npm start         # http://localhost:3000
```

أداة التوقيع:
```bash
scripts/build-zsign.sh tools        # يبني zsign، ثم عيّن ZSIGN_BIN
```

## الاختبارات / Tests

```bash
npm test                                        # 26 اختبار وحدات (التوقيع يتخطى بدون ZSIGN_BIN)
ZSIGN_BIN=/path/to/zsign npm run test:signing   # تكامل حقيقي: شهادة + ملف تعريف + zsign
npm run typecheck
```

اختبار التكامل ينشئ شهادة ذاتية ضمن CA خاص وملف تعريف موقّعًا بـ CMS، ثم يوقّع IPA فعليًا عبر zsign ويتحقق من الناتج. لا يصلح للتثبيت على جهاز، فهو يختبر خط الأنابيب فقط.

## النشر على Cloudflare / Deployment and domain

1. اشترِ `iramzipa.com` وأضفه إلى Cloudflare.
2. شغّل التطبيق على خادم Node 22.13+ (أو حاوية)، وضعه خلف Cloudflare Tunnel أو Proxy.
3. سجلات DNS: `A`/`CNAME` لـ `@` و`www` إلى الخادم (Proxied). SSL/TLS: وضع **Full (strict)**.
4. عيّن `PUBLIC_BASE_URL=https://iramzipa.com` و`PRIMARY_DOMAIN=iramzipa.com`. يعيد التطبيق توجيه `www` إلى الدومين الأساسي تلقائيًا.
5. تأكد أن `DATA_DIR` على قرص دائم ومحمي، ونسّخه احتياطيًا (يحوي قاعدة البيانات وملفات IPA والشهادات المشفّرة).

## البنية / Architecture

- `app/` : الواجهة العامة `(public)`، لوحة المدير `admin/(panel)`، وmanifest والتنزيل الموقّع في `i/` و`dl/`.
- `lib/ipa/` : تحليل IPA، Provisioning Profile، فحوص التوقيع (دوال نقية مختبرة).
- `lib/signing.ts` : يشغّل zsign ضمن مجلد مؤقت خاص، ويتحقق من الناتج قبل التخزين.
- `lib/install.ts` : قرار أهلية التثبيت، مع سبب واضح لكل حالة.
- `lib/db.ts` : طبقة بيانات. تستخدم SQLite عبر `node:sqlite` للتشغيل الحالي.

## ملاحظات تقنية / Notes

- **قاعدة البيانات:** المخطط الحالي SQLite (`node:sqlite`) لأن الاختبار المحلي بلا خادم PostgreSQL. الانتقال إلى PostgreSQL مطلوب قبل التوسّع إلى مكتبة كبيرة، وطبقة `lib/db.ts` معزولة لتسهيل ذلك.
- **التخزين:** ملفات محلية في `DATA_DIR`. الانتقال إلى Cloudflare R2 يحتاج محوّل تخزين جديد.
- **كلمة مرور zsign:** تُمرَّر كوسيط سطر أوامر، وهي مرئية لعمليات النظام المحلية لفترة التوقيع القصيرة. يُفضّل تشغيل zsign في حاوية معزولة أو عامل توقيع منفصل عند الإنتاج.
- **المكتبات:** لم تُستخدم Framer Motion، وحركات الواجهة بـ CSS فقط.
- **MFA:** TOTP مدعوم عند ضبط `ADMIN_TOTP_SECRET`. بدونه تعتمد الحماية على كلمة المرور فقط.

## الواجهة العامة على GitHub Pages / Static storefront on GitHub Pages

الرابط: https://abu00salman.github.io/ipa

- `site/` مشروع Next.js منفصل بـ `output: "export"` و`basePath: "/ipa"`. يُبنى بـ `npm run build:site` ويُنشر تلقائيًا عبر `.github/workflows/pages.yml` عند الدفع إلى `main`.
- الكتالوج يأتي من `site/data/catalog.json`، وهو لقطة للتطبيقات المنشورة. الواجهة الثابتة لا تقرأ قاعدة البيانات.
- تحديث الكتالوج من الخادم (حيث توجد قاعدة البيانات): `npm run export:catalog -- --live-url https://your-server`.
- التثبيت المباشر من Pages يتطلب نشر IPA موقّع وmanifest: `npm run export:catalog:packages`. الملفات الموقّعة تصبح عامة بعد النشر، فاستخدمه فقط لبناءات تقبل مشاركتها. الزر يعمل فقط للتطبيقات `ad-hoc` أو `enterprise` ذات الملف الصالح، وغير ذلك يحيل إلى الخادم الرئيسي.
- الشهادات وملفات التعريف وسجلات المدير لا تُنسخ أبدًا إلى الواجهة الثابتة.
- لوحة الإدارة، ورفع IPA، والتوقيع، ونقاط `/api` و`/i` و`/dl` تبقى في المشروع الجذر (`app/`)، وتحتاج خادمًا يعمل بـ Node. لا تعمل على GitHub Pages.

### الانتقال إلى iramzipa.com لاحقًا

1. اربط الدومين بالخادم الذي يشغّل المشروع الجذر، ثم عيّن `PUBLIC_BASE_URL=https://iramzipa.com`.
2. لنشر الواجهة الثابتة على الدومين نفسه، ابنِ بـ `SITE_BASE_PATH= npm run build:site` (بلا basePath) وانشر `site/out` على الدومين.
3. أعد تصدير الكتالوج مع `--origin https://iramzipa.com` لتصبح روابط manifest والتحميل على الدومين.
