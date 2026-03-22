// Stub service — full implementation pending (Phase 20 asset-inventory plan)
import type { RlsContext } from '../../database/rls';
import type {
  CreateInventoryInput,
  CountItemInput,
  InventoryOutput,
  ListInventoriesQuery,
} from './asset-inventory.types';
import { AssetInventoryError } from './asset-inventory.types';

export async function createInventory(
  _ctx: RlsContext,
  _input: CreateInventoryInput,
  _userId: string,
): Promise<InventoryOutput> {
  throw new AssetInventoryError('Not implemented', 501);
}

export async function listInventories(
  _ctx: RlsContext,
  _query: ListInventoriesQuery,
): Promise<{ data: InventoryOutput[]; total: number }> {
  return { data: [], total: 0 };
}

export async function getInventory(
  _ctx: RlsContext,
  _id: string,
): Promise<InventoryOutput> {
  throw new AssetInventoryError('Not implemented', 501);
}

export async function countItems(
  _ctx: RlsContext,
  _id: string,
  _items: CountItemInput[],
): Promise<InventoryOutput> {
  throw new AssetInventoryError('Not implemented', 501);
}

export async function reconcileInventory(
  _ctx: RlsContext,
  _id: string,
  _userId: string,
): Promise<InventoryOutput> {
  throw new AssetInventoryError('Not implemented', 501);
}
