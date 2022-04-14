export interface IUpgradeMessage {
    containerName: string;
    imageTag: string;
}

export interface IUpgradeJSONPayload {
    containers: Array<IUpgradeMessage>;
}
