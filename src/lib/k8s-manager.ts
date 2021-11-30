import k8s, { V1Deployment } from '@kubernetes/client-node';
import config from '../../config.json';
import { IUpgradeMessage } from './upgrade-message';

export default class K8sManager {
    kc: k8s.KubeConfig;
    k8sCoreV1Api: k8s.CoreV1Api;
    k8sAppsV1Api: k8s.AppsV1Api;

    constructor() {
        this.kc = new k8s.KubeConfig();
        this.setupLinkWithK8Server();
    }

    static getKCPath(): string {
        const kcPath = process.env.KUBECONFIG || config.KUBECONFIG_DEFAULT_PATH;
        return kcPath;
    }

    setupKCWithKCPath(): void {
        const kcPath = K8sManager.getKCPath();
        this.kc.loadFromFile(kcPath);
    }

    setupLinkWithK8Server(k8sCoreV1Api?: k8s.CoreV1Api, k8sAppsV1Api?: k8s.AppsV1Api): void {
        if (this.k8sCoreV1Api && this.k8sAppsV1Api) {
            return;
        }

        if (!k8sAppsV1Api && !k8sCoreV1Api) {
            this.setupKCWithKCPath();
            this.k8sCoreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
            this.k8sAppsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
        } else {
            this.k8sCoreV1Api = k8sCoreV1Api;
            this.k8sAppsV1Api = k8sAppsV1Api;
        }
    }

    async pullDeploymentObject(k8Deployment: string, namespace: string): Promise<k8s.V1Deployment> {
        return (await this.k8sAppsV1Api.readNamespacedDeployment(k8Deployment, namespace))?.body;
    }

    getContainerFromDeploymentObject(deploymentObject: k8s.V1Deployment, containerName: string): k8s.V1Container {
        return deploymentObject?.spec.template.spec.containers.find(x => x.name == containerName);
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
            container.image = container?.image.replace(/\:.*/, `:${imageTag}`);
        }
    }

    async upgradeDeploymentContainer(
        k8Deployment: string,
        namespace: string,
        upgradeMessage: IUpgradeMessage[]): Promise<V1Deployment> {

        let deploymentDetail: k8s.V1Deployment = await this.pullDeploymentObject(k8Deployment, namespace);
        this.replaceContainerImageForDeployment(deploymentDetail, upgradeMessage);
        return (await this.k8sAppsV1Api.replaceNamespacedDeployment(k8Deployment, namespace, deploymentDetail))?.body;
    }
}
