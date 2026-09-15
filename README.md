# ToS Scanner — Don't Sell Your Soul

> A Chrome extension that reads Terms of Service / Privacy Policy pages with AI, finds the genuinely user-unfriendly clauses, and shows you — with the **exact quote** and a plain-English **"what you're giving up"** — what you're actually agreeing to.

---

## English

### What it does

Most people click "Accept" without reading thousands of words of legalese. This extension flips that script:

- Detects when you're on a Terms of Service / Privacy Policy page (including popups that appear during sign-up).
- Sends the page text to an AI provider for analysis.
- Shows a banner on the page with ALL the genuinely bad clauses found (up to 5, ranked by harm).
- Each flagged clause comes with the **verbatim quote** and a one-line explanation of what you're giving up.
- If nothing seriously unfair is found, it says **ALL CLEAR** in green instead.
- Highlights the flagged sentences in the page itself, with a jump-to-highlight button.

### Why it matters

Companies put things like these in fine print all the time:

- Mandatory arbitration + class-action waiver (you can never sue them together with others).
- One-sided termination without notice (they can kill your account anytime, for any reason).
- Unlimited / irrevocable license to your content, including **AI training**.
- Selling or broadly sharing your personal data.
- Waiving your moral rights or your right to be credited.
- Asking *you* to indemnify *them*.

The scanner treats these as **red flags** and shows you the evidence.

### Features

| Feature | Details |
|---|---|
| Free by default | Uses **Groq** (free tier, no credit card). Your own API key, your own account. |
| Multiple providers | Groq, Google Gemini, OpenAI, Anthropic — pick in the popup. |
| Model auto-discovery | Groq: picks the best available model on your account, with automatic fallback. |
| Verbatim quotes | The AI must copy the exact sentence, not paraphrase it. |
| Plain-English reasons | Every red flag says *why* it matters. |
| ALL CLEAR mode | Honest "safe" verdict when nothing shady is found (no false alarms). |
| Live detection | Tracks DOM changes, so terms popups during registration trigger the button. |
| Optional auto-scan | Toggle in the popup: scan automatically the moment terms appear. |
| Smart text sampling | Sends a head + keyword-focused sample (cost/speed friendly). |
| In-page highlighting | Flagged sentences are highlighted; jump straight to them. |
| XSS-safe UI | All banner/DOM text built with safe DOM APIs, not innerHTML. |
| Timeouts everywhere | Every API call is bounded (15 s) so a slow provider can't hang forever. |

### Installation

1. Download / clone this repo, keep the folder structure intact.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select the project folder.
5. Done — the extension now watches web pages.

### Setup

1. Click the extension icon in the toolbar.
2. Pick a provider. Recommended: **Groq** (free, no card).
   - Groq key: <https://console.groq.com/keys>
   - Gemini key (free tier): <https://aistudio.google.com/app/apikey>
   - OpenAI / Anthropic: paid options, more accurate on complex legal text.
3. Paste your key and click **Save**.
4. Optional: override the model, or enable **Auto-scan when a terms popup appears**.

### How to use it

- Open any Terms of Service / Privacy Policy page. A **🛡️ Scan this page** button appears in the corner.
- Click it. The banner appears in seconds with the verdict.
- For red-flag results: use **⚡ Jump to highlighted spots** to see the real context in the page text.

**Good test pages:**

- Worst-clause practice: `https://www.spotify.com/legal/consumer-terms/` or `https://discord.com/terms`
- ALL CLEAR practice: `https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use`

### Result guide

| Banner | Meaning |
|---|---|
| **WAKE UP** + RED FLAG #1..5 | The page contains genuinely user-unfriendly clauses. Each card shows the exact quote and why it hurts. |
| **ALL CLEAR** (green) | Nothing seriously unfair found in the text submitted. |
| **WORST CLAUSE** | Exactly one bad clause found. |

### Project structure

```
tos-scanner/
├─ manifest.json        # MV3 manifest, permissions, host permissions
├─ background.js        # Prompt, model logic, all provider requests, response parsing
├─ content.js           # Page detection, scan flow, banner, highlighting
├─ overlay.css          # Banner styling (red / green variants)
├─ popup.html           # Settings UI (provider, key, model, auto-scan)
├─ popup.js             # Settings logic and storage
└─ icons/               # 16/48/128 px icons
```

### Privacy

- Keys are stored in `chrome.storage.local` — local to your browser profile.
- Only page text is sent to the AI provider (plain body text, capped at ~30 000 characters, no URLs, no cookies, no passwords).
- No analytics, no tracking, no third-party servers of our own. The extension talks to the provider you chose, with your key.

---

## Known limitations & honest answers

This is **version 1.0 — an early MVP**, not a finished product. Be honest with yourself and your users about it:

1. **Accuracy depends on the AI model.**
   The free tier (Groq open models like `gpt-oss`) is fast but not the most capable model out there. A stronger / paid provider (OpenAI, Anthropic, Gemini Pro) will produce more reliable verdicts and better-qualified quotes. **This is fixable** — the extension already supports all four providers, so it's an account/keys decision, not a code limit.

2. **The model can occasionally hallucinate a quote or miss a clause.**
   Quotes are supposed to be verbatim, but no model is perfect. **Mitigations exist**: the quote-matching for highlights is fuzzy, and we cap quotes at 200 chars. A bad quote simply won't highlight — it won't damage the page. Improvement path: stricter post-processing, or feeding the model a paragraph-indexed context. **Fixable.**

3. **It is NOT legal advice.**
   The output is a helpful flag, not a lawyer. For any decision that actually matters, read the relevant clause yourself (the banner points you right to it). This is inherently a statement about *fairness*, which AI can approximate but not guarantee.

4. **iframe-embedded terms are not read.**
   When a site embeds its agreement in a cross-origin `<iframe>`, browser security prevents reading the content. Same-origin iframes can be added with a small patch. **Partially fixable.**

5. **English-only UI and prompt for now.**
   The banner text, prompt, and reasons are in English. A language setting is straightforward to add. **Fixable.**

6. **Text is capped** (~30 000 chars in, quotes under 200 chars, max 5 clauses).
   Deliberate, to keep free-tier speed and cost sane. Long legal docs are still sample-covered thanks to keyword-aware sampling.

7. **Free-tier occasional slowness.**
   Overloaded free endpoints can be slow or time out. Every request now has a hard 15-second timeout and model fallback, so worst case it fails *fast* instead of hanging. Retrying usually works. **Not a bug we can remove — it's the nature of a free API.**

8. **Highlight matching is best-effort.**
   On pages with heavily split text nodes, exact highlighting may land only on the first part of a sentence. The quote is always shown in the banner either way. **Partially fixable** with a smarter locator.

9. **Requires internet + a valid key.**
   Nothing to scan offline, and no key means no request. There's no bundled key and never should be — shared keys get rate-limited and risk abuse.

### Bugs & feedback

Something broke, or a verdict felt wrong? **Tell us. That's how this gets better.**

Please include:
- The URL of the page you scanned,
- what the banner/error said,
- ideally a screenshot,
- and which provider/model you used (Groq free model? Gemini? …).

---

### Roadmap (in rough priority)

- [ ] Language setting (choose output language for banner & reasons)
- [ ] `<mark>`-quality smart quote locator (find the sentence even in split text nodes)
- [ ] Optional local AI (Ollama) so sensitive pages never leave your machine
- [ ] Per-site ignore list and a "skip this site" option
- [ ] Keyboard shortcut + auto-run rules (only scan on `*://*/terms*` etc.)
- [ ] Same-origin iframe support
- [ ] Verbatim-check post-processing against the source text

---

### Disclaimer

This project is an experimental tool for awareness, not a substitute for professional legal advice. "Red flags" are AI judgments about how user-unfriendly a clause reads — they don't necessarily mean a clause is unlawful.

---

## فارسی

### چیکار میکنه؟

اکثر آدمها بدون خوندن هزارها کلمهٔ حقوقی روی «پذیرفتن» کلیک میکنن. این اکستنشن برعکسش رو میکنه:

- وقتی روی صفحهٔ «شرایط استفاده / حریم خصوصی» هستی (حتی popup های موقعِ ثبتنام) خودش تشخیص میده.
- متن صفحه رو برای تحلیل میفرسته به سرویس هوش مصنوعی.
- یه بنر بالای صفحه نشون میده که **تمام** بندهای واقعاً بد رو لیست میکنه (حداکثر ۵، مرتبشده از زیانبارترین).
- هر بند با **عینِ جملهٔ متن** + یک خط توضیح ساده که «داری چی از دست میدی».
- اگه چیز بدی پیدا نشه، سبز میشه و مینویسه **ALL CLEAR** (همهچیز امنه).
- جملههای مشکلدار داخل خودِ صفحه با **هایلایت** مشخص میشن + دکمهٔ پرش مستقیم.

### چرا مهمه؟

شرکتها همیشه توی ریزنوشتهها چیزهایی مثل اینها جا میدن:

- داوری اجباری + انصراف از دعوای گروهی (هیچوقت نمیتونی دستهجمعی شکایت کنی).
- قطعِ سرویسِ یکطرفه بدون اخطار (هر وقت بخوان حسابتو میبندن).
- مجوز نامحدود/غیرقابللغو روی محتوای تو — از جمله **آموزش AI**.
- فروش یا بهاشتراکگذاشتن گستردهٔ دادههای شخصیات.
- انصراف از «حقوق معنوی» و حقِ ذکرِ نام نویسنده.
- و اینکه **تو** باید خسارتهای **آنها** رو جبران کنی!

اسکنر این موارد رو **پرچم قرمز** میزنه و مدرکش رو نشونت میده.

### راهاندازی

1. پوشهٔ پروژه رو دانلود/clone کن.
2. آدرس `chrome://extensions` رو باز کن.
3. **Developer mode** (حالت توسعهدهنده) رو فعال کن.
4. روی **Load unpacked** بزن و پوشه رو انتخاب کن.

### تنظیم کلید

1. روی آیکون اکستنشن کلیک کن.
2. سرویس رو انتخاب کن. پیشنهاد ما: **Groq** — رایگان و بدون کارت بانکی.
   - کلید Groq: <https://console.groq.com/keys>
   - کلید Gemini (رایگان): <https://aistudio.google.com/app/apikey>
   - OpenAI / Anthropic: پولی ولی دقیقتر روی متنهای حقوقی پیچیده.
3. کلید رو بچسبون و **Save** بزن.
4. اختیاری: مدل دلخواه یا **Auto-scan هنگام ظاهرشدن popup شرایط** رو فعال کن.

### استفاده

- هر صفحهٔ «Terms of Service / Privacy Policy» رو باز کن. دکمهٔ **🛡️ Scan this page** گوشهٔ پنجره ظاهر میشه.
- بزنش — بنر در چند ثانیه جواب میده.
- توی نتیجهٔ قرمز: با **⚡ Jump to highlighted spots** برو سراغ جملهٔ اصلی توی خودِ متن.

**سایتهای تست پیشنهادی:**
- برای دیدن پرچمهای واقعی: `https://www.spotify.com/legal/consumer-terms/` یا `https://discord.com/terms`
- برای تست ALL CLEAR (سالم بودن): `https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use`

### حریم خصوصی

- کلیدها فقط توی `chrome.storage.local` مرورگر خودت ذخیره میشن — جایی فرستاده نمیشن.
- فقط متنِ صفحه به سرویس هوش مصنوعی میره (حداکثر ~۳۰٬۰۰۰ کاراکتر؛ بدون URL، بدون کوکی، بدون رمز).
- نه پیگیری، نه تبلیغات، نه سرور ثالثِ شخصی. اکستنشن فقط با سرویسی که خودت انتخاب کردی و با کلیدِ خودت حرف میزنه.

---

## محدودیتها — و صادقانه بگیم

این **نسخهٔ ۱.۰ و یک MVP ابتداییه**، نه محصول نهایی. بهتره هم برای خودت هم برای دیگران صادق باشیم:

1. **دقت بستگی به مدل AI داره.**
   مدل رایگان گروک (`gpt-oss`) تنده ولی از قویترین مدلها نیست. سرویس پولی (OpenAI / Anthropic / Gemini Pro) نتیجهٔ دقیقتر و نقلقولهای بهتر میده. **این قابل حله** — خود اکستنشن هر چهار سرویس رو ساپورت میکنه؛ فقط به کلیدِ بهتر نیاز داری.

2. **مدل گاهی ممکنه نقلقول رو اشتباه دربیاره یا یه بند رو از دست بده.**
   نقلقولها باید عینِ متن باشن، ولی هیچ مدلی بینقص نیست. خوشبختانه بدترین حالت اینه که هایلایت نشه — به خودِ صفحه آسیب نمیرسه. راه بهبود: پردازش سختگیرانهتر. **قابل حله.**

3. **این مشاورهٔ حقوقی نیست.**
   خروجی یه «هشدارِ کمکی» است، نه رأی وکیل. برای هر تصمیم مهم خودت بند مربوطه رو بخون — بنر دقیقاً همون نقطه رو نشونت میده.

4. **شرایط داخل iframe خوندنی نیست.**
   بعضی سایتهای خارجی توافقنامه رو توی `<iframe>` میذارن که امنیت مرورگر اجازهٔ خوندنش رو نمیده. (iframe های همخاستگاه رو میشه با یه وصلهٔ کوچیک اضافه کرد.) **تا حدی قابل حله.**

5. **فعلاً فقط انگلیسی** — متن بنر و دلایل انگلیسیه. اضافهکردن تنظیم زبان آسونه. **قابل حله.**

6. **سقفِ متن** (~۳۰٬۰۰۰ کاراکتر ورودی، نقلقول زیر ۲۰۰ کاراکتر، حداکثر ۵ بند) — عمدیه تا سرویس رایگان سریع و کمهزینه بمونه.

7. **کندیِ گاهی سرویس رایگان.** سرور رایگان شلوغ بشه، درخواست کُند یا cut میشه. الان هر درخواست سقف ۱۵ ثانیهای داره و مدل fallback داره؛ بدترین حالت اینه که **سریع** خطا بده نه اینکه معلق بمونه. یه بار دیگه امتحان کن معمولاً جواب میده. **باگ نیست — ذات API رایگانه.**

8. **هایلایت «آزمایشی-با-بهترین-تلاش» است.** روی صفحههای با ساختار عجیب ممکنه فقط آغاز جمله هایلایت بشه. ولی نقلقول کامل همیشه توی بنر نمایش داده میشه. **تا حدی قابل حله.**

9. **نیاز به اینترنت و کلید معتبر.** هیچ کلیدِ مشترکی داخل پروژه نیست و نباید هم باشه — کلید مشترک محدود میشه و ممکنه سواستفاده بشه.

### باگ داره؟ بگو!

چیزی خراب شد یا یه نتیجه غلط به نظر رسید؟ **بگو — همینطور این پروژه بهتر میشه.**

لطفاً بفرست:
- آدرس صفحهای که اسکن کردی،
- متن خطا یا پیام بنر،
- اگه شد یه اسکرین شات،
- و اینکه از چه سرویس/مدلی استفاده کردی (Groq رایگان؟ Gemini؟ …).

---

### نقشهٔ راه (اولویتبندیشده)

- [ ] انتخاب زبان خروجی بنر و دلایل
- [ ] لوکیتور هوشمند جمله برای هایلایت دقیقتر
- [ ] پشتیبانی AI محلی (Ollama) برای متنهای حساس
- [ ] لیست نادیدهگرفتن سایتها
- [ ] میانبر کیبورد و اسکن خودکار بر اساس الگوی URL
- [ ] پشتیبانی iframe همخاستگاه
- [ ] راستیآزمایی نقلقولها با متن اصلی

---

### سلب مسئولیت

این پروژه یک ابزار آزمایشیِ آگاهیساز است، نه جایگزین مشاورهٔ حقوقی حرفهای. «پرچم قرمز» یعنی قضاوتِ مدل دربارهٔ ناعادلانهبودنِ یک بند — نه لزوماً غیرقانونیبودن آن.

---

Made with audacity for the people who read the fine print.