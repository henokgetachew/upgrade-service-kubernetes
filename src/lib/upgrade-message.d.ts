export interface IUpgradeMessage {
    container_name: string;
    image_tag: string;
}

export interface IUpgradeJSONPayload {
    containers: Array<IUpgradeMessage>;
}
