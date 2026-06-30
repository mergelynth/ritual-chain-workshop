# Інструкція з розгортання (локальна машина → GitHub)

Покроковий гайд: від чистого клону до тестів, локального деплою та публікації
на GitHub. Проєкт складається з двох пакетів:

- `hardhat/` — смартконтракт `AIJudge` (commit-reveal), тести, скрипт синхронізації ABI
- `web/` — Next.js фронтенд

## 0. Передумови

- Node.js 20+ (рекомендовано 22 LTS)
- [pnpm](https://pnpm.io/installation) (`corepack enable` зазвичай вже дає `pnpm`)
- Git та обліковий запис GitHub
- (Опційно, для тестнет/Ritual-деплою) гаманець з тестовими коштами та RPC-URL

Перевірка:

```bash
node -v
pnpm -v
git --version
```

## 1. Клонування / розпакування проєкту

```bash
git clone <your-fork-or-repo-url> ritual-chain-workshop
cd ritual-chain-workshop
```

(Якщо працюєте з локальною копією без git — просто перейдіть у розпаковану
директорію `ritual-chain-workshop`.)

## 2. Встановлення залежностей

```bash
cd hardhat
pnpm install

cd ../web
pnpm install
```

## 3. Створення .env файлів

### 3.1 Фронтенд (`web/.env.local`)

```bash
cd web
cp .env.example .env.local
```

Відкрийте `web/.env.local` і заповніть значення:

```dotenv
# Адреса задеплоєного контракту AIJudge (заповнюється після деплою, крок 5)
NEXT_PUBLIC_CONTRACT_ADDRESS=

# RPC Ritual Chain
NEXT_PUBLIC_RITUAL_RPC_URL=https://rpc.ritualfoundation.org

# Chain id Ritual Chain
NEXT_PUBLIC_RITUAL_CHAIN_ID=1979

# Адреса Ritual LLM executor / precompile-callback
NEXT_PUBLIC_RITUAL_EXECUTOR_ADDRESS=0xB42e435c4252A5a2E7440e37B609F00c61a0c91B

# Опційно: WalletConnect project id (можна лишити порожнім — працюватимуть injected-гаманці)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
```

`NEXT_PUBLIC_CONTRACT_ADDRESS` заповнюється **після** деплою контракту
(крок 5) — поки що можна лишити порожнім, фронтенд це коректно обробляє.

### 3.2 Hardhat (секрети для деплою на Sepolia / Ritual)

У Hardhat 3 секрети **не зберігаються у `.env`-файлі**, а через вбудований
менеджер Configuration Variables (`configVariable(...)` у `hardhat.config.ts`).
За замовчуванням значення читаються зі звичайних змінних середовища з тим же
іменем, або (рекомендовано) — з зашифрованого keystore.

Потрібні змінні (дивись `hardhat/hardhat.config.ts`):

- `SEPOLIA_RPC_URL`, `SEPOLIA_PRIVATE_KEY` — для мережі `sepolia`
- `DEPLOYER_PRIVATE_KEY` — для мережі `ritual`

**Варіант А — зашифрований keystore (рекомендовано):**

```bash
cd hardhat
npx hardhat keystore set SEPOLIA_RPC_URL
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set DEPLOYER_PRIVATE_KEY
```

Hardhat попросить створити пароль keystore під час першого запуску, далі
значення зчитуються автоматично (з підтвердженням паролем) при деплої.

**Варіант Б — змінні середовища (для локальних експериментів):**

```bash
export SEPOLIA_RPC_URL="https://eth-sepolia.g.alchemy.com/v2/<your-key>"
export SEPOLIA_PRIVATE_KEY="0x<your-private-key>"
export DEPLOYER_PRIVATE_KEY="0x<your-private-key>"
```

⚠️ Ніколи не комітьте приватні ключі в репозиторій. Для локального хардхат-нода
(`hardhatMainnet`) ці змінні взагалі не потрібні — мережа використовує тестові
акаунти Hardhat автоматично.

## 4. Компіляція та тести

```bash
cd hardhat
npx hardhat compile
npx hardhat test
```

> **Якщо бачите `CompilerError: Stack too deep`** — це вже виправлено в
> `hardhat.config.ts` (`viaIR: true` + `optimizer.enabled: true` для профілю
> `default`/`production`). `getBounty` повертає 12 значень, що перевищує
> ліміт стека EVM (16 локальних змінних) без `viaIR`. Якщо ви бачите цю
> помилку — переконайтесь, що користуєтесь актуальним `hardhat.config.ts` з
> цього архіву, видаліть `cache/` та `artifacts/` і перекомпілюйте:
> ```bash
> rm -rf cache artifacts
> npx hardhat compile
> ```

Очікується, що всі тести з `test/AIJudge.ts` пройдуть зелено: коректність
commit-reveal, контроль доступу, дедлайни, пакетне суддівство через мок
Ritual LLM precompile та виплата переможцю.

Запустити окремо TS- чи Solidity-тести:

```bash
npx hardhat test nodejs   # TypeScript-тести (test/AIJudge.ts)
npx hardhat test solidity # Solidity-тести (*.t.sol), якщо є
```

## 5. Деплой контракту

### 5.1 Локальна симульована мережа (швидка перевірка)

```bash
cd hardhat
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network hardhatMainnet
```

### 5.2 Sepolia (публічний тестнет)

Потрібні кошти на Sepolia (faucet) і налаштовані `SEPOLIA_RPC_URL` /
`SEPOLIA_PRIVATE_KEY` (крок 3.2):

```bash
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network sepolia
```

### 5.3 Ritual Chain

Потрібен налаштований `DEPLOYER_PRIVATE_KEY` (крок 3.2):

```bash
npx hardhat ignition deploy ignition/modules/AIJudge.ts --network ritual
```

Після успішного деплою Ignition виведе адресу контракту — скопіюйте її у
`web/.env.local` як `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## 6. Синхронізація ABI з фронтендом

Після будь-якої зміни контракту перекомпілюйте та синхронізуйте ABI у
`web/src/abi/AIJudge.ts` одним скриптом:

```bash
cd hardhat
pnpm run sync-abi
```

Це виконає `hardhat compile`, а потім `scripts/sync-abi.ts`, який згенерує
типізований `web/src/abi/AIJudge.ts` напряму з артефакту компіляції — без
ручного копіювання JSON.

## 7. Запуск фронтенда

```bash
cd web
pnpm dev
```

Відкрийте http://localhost:3000, підключіть гаманець (мережа Ritual /
Sepolia / локальний нод відповідно до того, де задеплоєно контракт) і
перевірте повний цикл: create → commit → reveal → judge → finalize.

Білд для продакшну:

```bash
pnpm build
pnpm start
```

## 8. Публікація на GitHub

```bash
# у корені репозиторію
git init                     # якщо репозиторій ще не ініціалізований
git add .
git commit -m "feat: commit-reveal AIJudge bounty + tests + ABI sync"

# створіть пустий репозиторій на github.com, потім:
git remote add origin git@github.com:<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

Перевірте, що `.env.local` (і будь-які реальні секрети) потрапляють у
`.gitignore` — у `web/.gitignore` та `hardhat/.gitignore` це вже враховано.
Якщо використовуєте keystore (крок 3.2, варіант А) — секрети взагалі не
лежать у репозиторії, файл keystore зберігається у домашній директорії поза
проєктом.

## 9. Здача домашнього завдання (відповідність ПДФ)

Розділ "6. Deliverables" та "7. Evaluation Criteria" з `Ritual_AI_Bounty_Judge_Homework.pdf`:

| Вимога з ПДФ | Де в репозиторії | Вага оцінки |
|---|---|---|
| Updated Solidity contract (commit-reveal) | `hardhat/contracts/AIJudge.sol` | Commit-reveal correctness — 30% |
| Access control / payout safety | `onlyOwner`, `bountyExists`, checks-effects-interactions у `finalizeWinner` | Smart contract safety — 20% |
| Batch judging respektовано (1 LLM-виклик на бaунті, не на сабмішн) | `judgeAll` робить один виклик `_executePrecompile(LLM_INFERENCE_PRECOMPILE, ...)` | Ritual understanding — 20% |
| README з новим лайфциклом бaунті | `hardhat/README.md` | Code clarity — 15% |
| Тести / тест-план для valid/invalid reveal-кейсів | `hardhat/test/AIJudge.ts` + `TEST_PLAN.md` | Testing / explanation — 15% |
| Architecture note: commit-reveal vs Ritual-native | `ARCHITECTURE.md` | Ritual understanding (частково) |
| Reflection question (5–8 речень) | `REFLECTION.md` | — |
| Advanced Track (опційно, дизайн-документ) | `ARCHITECTURE.md`, розділ 3 | — |

### Контрольний чекліст перед здачею

- [ ] `rm -rf hardhat/cache hardhat/artifacts && npx hardhat compile` — без помилок
- [ ] `npx hardhat test` — усі тести зелені (commit-reveal, дедлайни, payout, judging)
- [ ] `pnpm run sync-abi` виконано, `web/src/abi/AIJudge.ts` синхронізовано з останнім компільованим контрактом
- [ ] Контракт задеплоєно мінімум на локальну мережу (`hardhatMainnet`); за бажанням — на Sepolia/Ritual
- [ ] `web/.env.local` створено з `NEXT_PUBLIC_CONTRACT_ADDRESS`, заповненим адресою задеплоєного контракту
- [ ] `ARCHITECTURE.md` містить пояснення Advanced Track (де лежить plaintext, що on-chain/off-chain, як LLM отримує всі сабмішни разом, як відбувається reveal, як контракт верифікує bundle) — усі пункти з розділу 4 ПДФ закриті
- [ ] `REFLECTION.md` — відповідь на 5–8 речень готова
- [ ] `TEST_PLAN.md` покриває valid/invalid reveal-кейси explicite
- [ ] Усі секрети (`SEPOLIA_PRIVATE_KEY`, `DEPLOYER_PRIVATE_KEY`) НЕ закомічені — використано keystore або змінні середовища (крок 3.2)
- [ ] `.gitignore` виключає `node_modules/`, `cache/`, `artifacts/`, `.env*`
- [ ] Репозиторій запушено на GitHub (крок 8), посилання на репо готове для здачі

