import { V1Deployment } from '@kubernetes/client-node';

export interface IUpgradeMessage {
 container_name: string;
 image_tag: string;
}

export interface IUpgradeJSONPayload {
  containers: Array<IUpgradeMessage>;
}

export interface IUpgradedContainers {
  [key: string]: {
    ok: boolean,
    deployment?: V1Deployment,
  }
}
