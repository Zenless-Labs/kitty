import { Transaction } from '@mysten/sui/transactions';

export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? "0x_PLACEHOLDER";
export const MODULE_NAME = 'kitty';

// USDC on Sui mainnet
export const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

export interface CreateEventParams {
  titleEncrypted: number[];
  encryptedParticipants: number[];
  passwordHash: number[];
  names: string[];
  goalUsdCents: number;
  deadline: bigint;
}

export interface ContributeParams {
  eventId: string;
  name: string;
  amountMist: bigint;
}

export interface ContributeWithTipParams extends ContributeParams {
  tipMist: bigint;
}

export interface ContributeUsdcParams {
  eventId: string;
  name: string;
  amountUnits: bigint; // USDC has 6 decimals
  usdcCoinId: string;  // object ID of USDC coin to use
}

export function buildCreateEvent(p: CreateEventParams): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_event`,
    arguments: [
      tx.pure.vector('u8', p.titleEncrypted),
      tx.pure.vector('u8', p.encryptedParticipants),
      tx.pure.vector('u8', p.passwordHash),
      tx.pure.vector('string', p.names),
      tx.pure.u64(p.goalUsdCents),
      tx.pure.u64(p.deadline),
    ],
  });
  return tx;
}

export function buildContributeSui(p: ContributeParams): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [p.amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::contribute_sui`,
    arguments: [tx.object(p.eventId), tx.pure.string(p.name), coin],
  });
  return tx;
}

export function buildContributeSuiWithTip(p: ContributeWithTipParams): Transaction {
  const tx = new Transaction();
  const [coin, tip] = tx.splitCoins(tx.gas, [p.amountMist, p.tipMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::contribute_sui_with_tip`,
    arguments: [tx.object(p.eventId), tx.pure.string(p.name), coin, tip],
  });
  return tx;
}

export function buildContributeUsdc(p: ContributeUsdcParams): Transaction {
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(p.usdcCoinId), [p.amountUnits]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::contribute_usdc`,
    typeArguments: [USDC_TYPE],
    arguments: [tx.object(p.eventId), tx.pure.string(p.name), coin],
  });
  return tx;
}

export function buildMarkPaypal(eventId: string, name: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::mark_paypal`,
    arguments: [tx.object(eventId), tx.pure.string(name)],
  });
  return tx;
}

export function buildMarkPaypalBatch(eventId: string, names: string[]): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::mark_paypal_batch`,
    arguments: [tx.object(eventId), tx.pure.vector('string', names)],
  });
  return tx;
}

export function buildWithdraw(eventId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::organizer_withdraw`,
    arguments: [tx.object(eventId)],
  });
  return tx;
}

export function buildCloseEvent(eventId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::close_event`,
    arguments: [tx.object(eventId)],
  });
  return tx;
}
