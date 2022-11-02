export const enum UpgradeResult {
  Success = 1,
  Failure = 0
}

export interface IUpgradeContainersResult {
  [key: string]: {
    ok: boolean,
  }
}
