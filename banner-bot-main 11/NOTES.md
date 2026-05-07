# Banner Bot — Нотатки розробки

## Огляд проекту

Автоматизована система генерації банерів для маркетингового відділу Everstake.
Дизайнер створив темплейти в Figma → ми перенесли їх в HTML/CSS → Puppeteer рендерить PNG 1600×900 → Slack бот дає команді інтерфейс для замовлення банерів.

## Figma джерело

- **Файл:** CMS — `CsGSaMnSlupaeSFto3b4HJ`
- **Сторінка:** Design (node `3-2`)
- **Лінк:** https://www.figma.com/design/CsGSaMnSlupaeSFto3b4HJ/CMS?node-id=3-2

## 6 типів темплейтів

### Type A — Brand Article
- Split layout: ліворуч subtitle + title, праворуч лого партнера
- Приклади з Figma: DES-283 (Monad), DES-286 (Solana), DES-284 (Aptos), DES-301 (Neo)
- Має вертикальний розділювач по центру (x=800)

### Type B — Centered Title
- Великий центрований заголовок з опціональним лого зверху
- Приклади: DES-285 ("Selecting the Right Staking-as-a-Service Provider"), DES-312 (Ethereum)

### Type C — Dark Article
- Темний фон, центрований заголовок, шрифт 111px
- Приклади: DES-336, DES-337, DES-317 ("Future-Proofing Proof of Stake"), DES-318

### Type D — Partnership
- Два лого поруч через "x": everstake x Partner
- Приклад: DES-298 (everstake x Pye)

### Type E — Week in Blockchains
- Щотижневий дайджест: дати + "Week in Blockchains" зліва, іконки криптовалют справа
- Іконки справа експортовані напряму з Figma як готова картинка (`week-icons-grid.png`)
- Приклад: "Week in Blockchains" (node `3:12656`)

### Type F — Guide / Tutorial
- Split layout з ілюстрацією справа
- Зверху зліва everstake + партнер лого
- Приклад: DES-294a (Trezor + Cardano)

## Дизайн-система — точні значення з Figma

### Кольори
| Елемент | Значення |
|---------|----------|
| Світлий фон | `#f5fffd` |
| Темний фон | `linear-gradient(180deg, #034638 75%, #012d24 100%)` |
| Текст на світлому | `#034638` |
| Текст на темному | `#f5fffd` |
| Everstake лого (dark) | `#0b1d1a` |
| Сітка ліній (light) | `#dee8e6` |
| Сітка ліній (dark) | `rgba(222,232,230,0.12)` |

### Градієнтний blob (зелений)
- Еліпс 640×640px
- Позиція: (-320, -320) відносно фрейму
- Blur: 200px
- Градієнт: `rgba(64,193,172,0.40)` → `rgba(130,230,180,1.0)`

### Права частина "Week in Blockchains"
- Градієнт фону: `rgba(64,193,172,0.20)` → `rgba(123,150,144,0.50)`

### Шрифт
- **Zalando Sans** (Variable font)
- Title: weight 200-250 (ExtraLight/Light)
- Subtitle: weight 500 (Medium)
- Розміри: 128px (xxl), 111px (xl), 96px (lg), 86px (md), 26px (date), 20px (subtitle)

### Точні позиції (Week in Blockchains як референс)
| Елемент | x | y | w | h |
|---------|---|---|---|---|
| Everstake logo | 56 | 56 | 250 | 40 |
| Date text | 56 | 523 | 654 | 31 |
| Title text | 56 | 578 | 654 | 266 |
| Right panel | 800 | 0 | 800 | 900 |
| Gradient blob | -320 | -320 | 640 | 640 |

## Figma Frame IDs

| Frame ID | Назва | Тип |
|----------|-------|-----|
| 3:8420 | DES-283 (Monad) | A |
| 3:8439 | DES-286 (Solana) | A |
| 3:12207 | DES-284 (Aptos) | A |
| 3:12226 | DES-285 | B |
| 3:12656 | Week in Blockchains | E |
| 3:12238 | DES-336 | C |
| 3:12250 | DES-337 | C |
| 3:12260 | DES-302 | C |
| 3:12272 | DES-304 | ? |
| 3:12291 | DES-298 (Partnership) | D |
| 3:12406 | DES-301 (Neo) | A |
| 3:12438 | DES-310 (Stake ADA) | promo |
| 3:12532 | DES-294 (Trezor) | F |
| 3:12589 | DES-286 (duplicate) | A |
| 3:13000 | DES-312 (Ethereum) | B |
| 3:13018 | DES-313 | ? |
| 3:13064 | DES-314 | ? |
| 3:13123 | DES-317 | C |
| 3:13173 | DES-294 | F |
| 3:13229 | DES-294 | F |
| 3:13300 | DES-294 | F |
| 3:27286 | DES-318 | C |
| 3:27368 | DES-322 | dark |
| 3:27325 | DES-320 | ? |
| 3:27389 | DES-321 | ? |
| 3:27568 | DES-324 | light |

## Технічний стек

- **Node.js** — серверна частина
- **Puppeteer** — рендеринг HTML в PNG (headless Chrome)
- **Slack Bolt** — Slack бот (Socket Mode, команда `/banner`)
- **Zalando Sans** — шрифти вбудовані як base64 в HTML

## Структура проекту

```
banner-bot/
├── src/
│   ├── app.js                  # Slack bot entry point
│   ├── renderer.js             # Puppeteer HTML→PNG
│   ├── preview.js              # Локальна генерація для тестування
│   ├── templates/
│   │   ├── templates.js        # Всі 6 типів (HTML генератори)
│   │   └── base.css            # Стилі (довідковий файл)
│   └── slack/
│       └── interactions.js     # Slack модалка і хендлери
├── assets/
│   ├── fonts/                  # ZalandoSans-ExtraLight/Light/Regular/Medium.ttf
│   └── logos/
│       ├── everstake-dark.png  # Темний лого (для світлого фону)
│       ├── everstake-light.png # Світлий лого (для темного фону)
│       └── week-icons-grid.png # Іконки криптовалют (експорт з Figma)
├── output/                     # Згенеровані банери (gitignored)
├── .env.example
├── package.json
└── README.md
```

## Що зроблено

- [x] Проаналізовано всі 26 фреймів з Figma через API
- [x] Визначено 6 типів темплейтів
- [x] Створено HTML/CSS генератори для кожного типу
- [x] Налаштовано Puppeteer рендерер
- [x] Написано Slack бот з інтерактивною модалкою
- [x] Експортовано лого everstake та іконки з Figma
- [x] Підключено шрифт Zalando Sans
- [x] Залито на GitHub: https://github.com/mkunytsia-dev/banner-bot
- [x] Type E (Week in Blockchains) — pixel-perfect з Figma

## Що потрібно зробити

- [ ] Створити Slack App (токени: BOT, SIGNING_SECRET, APP_TOKEN)
- [ ] Додати лого партнерів в `assets/logos/`
- [ ] Підключити Slack бот і протестувати `/banner`
- [ ] Точно відтворити інші типи (A-D, F) з pixel-perfect позиціями
- [ ] Додати можливість завантажувати лого через Slack (drag & drop)
- [ ] Хостинг (Railway / Render / Fly.io)

## Важливі уроки

1. **Не апроксимувати** — завжди брати точні координати з Figma API
2. **Сітка ліній** — не додавати якщо не підтверджено
3. **Лого** — експортувати напряму з Figma (scale=4), а не використовувати наближені версії
4. **Права частина Week in Blockchains** — простіше експортувати як картинку з Figma ніж відтворювати в HTML
