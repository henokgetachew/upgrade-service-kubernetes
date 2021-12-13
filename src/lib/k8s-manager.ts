import * as k8s from '@kubernetes/client-node';
import config from '../../config.json';
import Environment from './env-manager';
import { IUpgradeMessage } from './upgrade-message';

export default class K8sManager {
    kc: k8s.KubeConfig;
    k8sCoreV1Api: k8s.CoreV1Api = new k8s.CoreV1Api();
    k8sAppsV1Api: k8s.AppsV1Api = new k8s.AppsV1Api();

    constructor() {
        this.kc = new k8s.KubeConfig();
        this.setupLinkWithK8Server();
    }

    setupKCWithKCPath(): void {
        const kcPath = Environment.getKubeConfigPath();
        this.kc.loadFromFile(kcPath);
    }

    setupLinkWithK8Server(): void {
        if (this.k8sCoreV1Api && this.k8sAppsV1Api) {
            return;
        }
        this.setupKCWithKCPath();
        this.k8sCoreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
        this.k8sAppsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
    }

    async pullDeploymentObject(k8Deployment: string, namespace: string): Promise<k8s.V1Deployment> {
        return (await this.k8sAppsV1Api.readNamespacedDeployment(k8Deployment, namespace))?.body;
    }

    getContainerFromDeploymentObject(deploymentObject: k8s.V1Deployment, containerName: string): k8s.V1Container {
        const container = deploymentObject?.spec?.template?.spec?.containers.find(x => x.name == containerName);
        if (container) {
            return container;
        } else {
            throw new Error(`Container name: ${containerName} not found in deployment spec.`);
        }
    }

    async pullContainerObject(k8Deployment: string, namespace: string, containerName: string): Promise<k8s.V1Container> {
        const deploymentObject: k8s.V1Deployment = await this.pullDeploymentObject(k8Deployment, namespace);
        return this.getContainerFromDeploymentObject(deploymentObject, containerName);
    }

    replaceContainerImageForDeployment(deploymentObject: k8s.V1Deployment, upgradeMessage: IUpgradeMessage[]): void {
        for(let containerVersionPair of upgradeMessage) {
            const containerName = containerVersionPair.containerName;
            const imageTag = containerVersionPair.imageTag;

            let container: k8s.V1Container = this.getContainerFromDeploymentObject(deploymentObject, containerName);
            container.image = container?.image?.replace(/\:.*/, `:${imageTag}`);
        }
    }

    async upgradeDeploymentContainers(
        k8Deployment: string,
        namespace: string,
        upgradeArray: IUpgradeMessage[]): Promise<k8s.V1Deployment> {

        let deploymentDetail: k8s.V1Deployment = await this.pullDeploymentObject(k8Deployment, namespace);
        this.replaceContainerImageForDeployment(deploymentDetail, upgradeArray);
        return (await this.k8sAppsV1Api.replaceNamespacedDeployment(k8Deployment, namespace, deploymentDetail))?.body;
    }
}
