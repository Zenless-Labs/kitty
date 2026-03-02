import { Transaction } from '@mysten/sui/transactions';

export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? "0x_PLACEHOLDER";
export const MODULE_NAME = 'kitty';

// Default alt coin = USDC mainnet. Can be swapped for any Sui coin type.
export const USDC_TYPE = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';

export interface CreateEventParams {
  titleEncrypted: number[];
  encryptedParticipants: number[];
  passwordHash: number[];
  names: string[];
  goalUsdCents: number;
  deadline: bigint;
  coinType?: string; // defaults to USDC
}

export interface ContributeParams {
  eventId: string;
  name: string;
  amountMist: bigint;
  coinType?: string;
}

export interface ContributeWithTipParams extends ContributeParams {
  tipMist: bigint;
}

export interface ContributeCoinParams {
  eventId: string;
  name: string;
  amountUnits: bigint;
  coinObjectId: string;
  coinType?: string;
}

export function buildCreateEvent(p: CreateEventParams): Transaction {
  const coinType = p.coinType ?? USDC_TYPE;
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::create_event`,
    typeArguments: [coinType],
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
  const coinType = p.coinType ?? USDC_TYPE;
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [p.amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::contribute_sui`,
    typeArguments: [coinType],
    arguments: [tx.object(p.eventId), tx.pure.string(p.name), coin],
  });
  return tx;
}

export function buildContributeSuiWithTip(p: ContributeWithTipParams): Transaction {
  const coinType = p.coinType ?? USDC_TYPE;
  const tx = new Transaction();
  const [coin, tip] = tx.splitCoins(tx.gas, [p.amountMist, p.tipMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::contribute_sui_with_tip`,
    typeArguments: [coinType],
    arguments: [tx.object(p.eventId), tx.pure.string(p.name), coin, tip],
  });
  return tx;
}

export function buildContributeCoin(p: ContributeCoinParams): Transaction {
  const coinType = p.coinType ?? USDC_TYPE;
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.object(p.coinObjectId), [p.amountUnits]);
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::contribute_coin`,
    typeArguments: [coinType],
    arguments: [tx.object(p.eventId), tx.pure.string(p.name), coin],
  });
  return tx;
}

export function buildMarkPaypal(eventId: string, name: string, coinType = USDC_TYPE): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::mark_paypal`,
    typeArguments: [coinType],
    arguments: [tx.object(eventId), tx.pure.string(name)],
  });
  return tx;
}

export function buildMarkPaypalBatch(eventId: string, names: string[], coinType = USDC_TYPE): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::mark_paypal_batch`,
    typeArguments: [coinType],
    arguments: [tx.object(eventId), tx.pure.vector('string', names)],
  });
  return tx;
}

export function buildWithdraw(eventId: string, coinType = USDC_TYPE): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::organizer_withdraw`,
    typeArguments: [coinType],
    arguments: [tx.object(eventId)],
  });
  return tx;
}

export function buildCloseEvent(eventId: string, coinType = USDC_TYPE): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::close_event`,
    typeArguments: [coinType],
    arguments: [tx.object(eventId)],
  });
  return tx;
}
