import type { Order } from './order.type';
import type { CocoKDSOrder } from '../../electron/plugins/tmbill/transformer';

export type DisplayOrder =
  | (Order & { _source?: 'cocoeats' })
  | CocoKDSOrder;

export function isTmbillOrder(order: DisplayOrder): order is CocoKDSOrder {
  return (order as CocoKDSOrder)._source === 'tmbill';
}