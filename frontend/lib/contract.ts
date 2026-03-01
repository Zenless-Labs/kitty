import { Transaction } from '@mysten/sui/transactions';

export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID ?? "0x_PLACEHOLDER";
export const MODULE_NAME = 'crowdfund';

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

export function buildMarkPaypal(eventId: string, name: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::mark_paypal`,
    arguments: [tx.object(eventId), tx.pure.string(name)],
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
