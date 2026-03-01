Build a full-stack Sui crowdfunding dApp. Project at /home/ubuntu/Dev/sui-crowdfund/, git already initialized.

MOVE CONTRACT:

Create move/Move.toml with package sui_crowdfund v0.0.1 edition 2024.beta, Sui dependency from MystenLabs git testnet rev, address sui_crowdfund=0x0

Create move/sources/crowdfund.move:
- Structs: AdminCap(key,store), CreatorCap(key,store), Event(key) with id UID, organizer address, encrypted_participants vector<u8>, password_hash vector<u8>, statuses VecMap<String,u8>, pool Balance<SUI>, tip Balance<SUI>, goal u64, deadline u64, active bool
- Errors: ENotOrganizer=0, EEventClosed=1, ENameNotFound=2, EAlreadyContributed=3
- fun init: transfer AdminCap to sender
- admin_add_creator(cap,recipient,ctx): transfer CreatorCap to recipient
- create_event(_cap,encrypted_participants,password_hash,names,goal,deadline,ctx): init statuses from names all=0, share Event
- contribute_sui(event,name,payment,ctx): check active+name+status==0, set 1, join pool
- contribute_sui_with_tip(event,name,payment,tip_coin,ctx): same + join tip
- mark_paypal(event,name,ctx): check active+name+status==0, set 2
- organizer_withdraw(event,ctx): check organizer, withdraw pool+tip to sender
- close_event(event,ctx): check organizer, set active=false

NEXT.JS FRONTEND:

Run: cd /home/ubuntu/Dev/sui-crowdfund && npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
Run: cd frontend && npm install @mysten/dapp-kit @mysten/sui @tanstack/react-query

Create frontend/lib/crypto.ts: Web Crypto API helpers - deriveKey(PBKDF2), encryptNames(AES-GCM, returns hex iv+ciphertext), decryptNames, hashPassword(SHA-256)

Create frontend/lib/contract.ts: PACKAGE_ID placeholder, transaction builders for all contract functions

Create frontend/app/providers.tsx: QueryClientProvider + SuiClientProvider(testnet) + WalletProvider

Create frontend/app/layout.tsx: import providers + dapp-kit CSS, header with ConnectButton

Create frontend/app/page.tsx: landing page with Create Event button

Create frontend/app/create/page.tsx: form for names+password+goal+deadline, encrypts and submits transaction

Create frontend/app/event/[id]/page.tsx: public event view, password unlock, contribute UI

Create frontend/app/event/[id]/organizer/page.tsx: organizer dashboard with withdraw/close

FINISH:
git config user.email 'p31.d3ng@gmail.com' && git config user.name 'Pei Deng' && git add -A && git commit -m 'scaffold: Move contract + Next.js frontend'
openclaw system event --text 'Done: sui-crowdfund scaffold complete' --mode now
