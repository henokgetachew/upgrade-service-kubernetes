import * as k8s from '@kubernetes/client-node';
import Environment from './env-manager';
import { IUpgradeMessage } from './upgrade-message';
export default class K8sManager {
    kc: k8s.KubeConfig;
    kubeAPIConfigured: boolean = false;
    k8sCoreV1Api: k8s.CoreV1Api = new k8s.CoreV1Api();
    k8sAppsV1Api: k8s.AppsV1Api = new k8s.AppsV1Api();
    namespace: string;
    k8sDeploymentName: string;
    upgradeMessage: IUpgradeMessage[];
    upgradedDeployments: k8s.V1Deployment[] = [];

    constructor(namespace: string, k8sDeploymentName: string, upgradeMessage: IUpgradeMessage[] ) {
        this.kc = new k8s.KubeConfig();
        this.namespace = namespace;
        this.k8sDeploymentName = k8sDeploymentName;
        this.upgradeMessage = upgradeMessage;
        
        this.setupLinkWithK8Server();
    }

    setupKCWithKCPath(): void {
        if(Environment.runningWithinCluster()) {
            this.kc.loadFromCluster();
        } else {
            const kcPath = Environment.getKubeConfigPath();
            this.kc.loadFromFile(kcPath);
        }
    }

    setupLinkWithK8Server(): void {
        if (this.kubeAPIConfigured) {
            return;
        }
        this.setupKCWithKCPath();
        this.k8sCoreV1Api = this.kc.makeApiClient(k8s.CoreV1Api);
        this.k8sAppsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
        this.kubeAPIConfigured = true;
    }

    async pullDeploymentObject(): Promise<k8s.V1Deployment> {
        return (await this.k8sAppsV1Api.readNamespacedDeployment(this.k8sDeploymentName, this.namespace))?.body;
    }

    async getContainerInNamespace(containerName: string): 
    Promise<{
        deployment: k8s.V1Deployment,
        container: k8s.V1Container
    }> {
        const deployment: k8s.V1Deployment = await this.pullDeploymentObject();
        const container = deployment?.spec?.template?.spec?.containers.find(x => x.name == containerName);
        if (container) {
            return {deployment, container};
        } else {
            // Look for the container in the other deployments within the same namespace
            const deployments: k8s.V1DeploymentList = (await this.k8sAppsV1Api.listNamespacedDeployment(this.namespace)).body;
            for (const deployment of deployments.items) {
                const container = deployment?.spec?.template?.spec?.containers.find(x => x.name == containerName);
                if (container) {
                    return {deployment, container};
                }
            }
            throw new Error(`Container name: ${containerName} not found in deployment spec.`);
        }
    }

    private async modifyContainerImageForDeployment(): Promise<k8s.V1Deployment[]> {
        for(let containerVersionPair of this.upgradeMessage) {
            const containerName = containerVersionPair.containerName;
            const imageTag = containerVersionPair.imageTag;

            let searchResult = await this.getContainerInNamespace(containerName);
            const deployment = searchResult.deployment;
            const container = searchResult.container;
            container.image = container?.image?.replace(/\:.*/, `:${imageTag}`);
            this.upgradedDeployments.push(deployment);
        }
        return this.upgradedDeployments;
    }

    async upgradeDeploymentContainers(): Promise<k8s.V1Deployment[]> {
        let succesfullyUpgraded: k8s.V1Deployment[] = [];
        const areDeploymentsReady = await this.areAllDeploymentsInReadyState();
        if(areDeploymentsReady.ready == false) {
            throw new Error(`Can't upgrade right now. Container with image: ${areDeploymentsReady.imageNotReady} is in state ${areDeploymentsReady.state}`);
        }

        await this.modifyContainerImageForDeployment();
        for (const deployment of this.upgradedDeployments) {
            let deploymentName: string = "";
            deploymentName = deployment.metadata?.name ?? "";
            if (deploymentName != "") {
                const upgradeResponse = await this.k8sAppsV1Api.replaceNamespacedDeployment(deploymentName, this.namespace, deployment);
                succesfullyUpgraded.push(upgradeResponse.body);
            }
        }
        return succesfullyUpgraded;
    }

    async areAllDeploymentsInReadyState(): Promise<{ready: boolean, imageNotReady?: string, state?: k8s.V1ContainerState}> {
        const pods: k8s.V1PodList = (await this.k8sCoreV1Api.listNamespacedPod(this.namespace)).body;

        pods.items.forEach((pod) => {
            const notReadyStatus = pod.status?.containerStatuses?.find(container => container.state != k8s.V1ContainerStateRunning);
            if(notReadyStatus?.name != undefined) {
                return {ready: false, imageNotReady: notReadyStatus.image, state: notReadyStatus.state};
            }
        });
        return { ready: true, imageNotReady: undefined, state: undefined};
    }

    async getCurrentVersion(container: string): Promise<string> {
        const response = await this.getContainerInNamespace(container);
        return response.container.image ?? 'Not found';
    }
}
