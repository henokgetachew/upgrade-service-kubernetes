import * as k8s from '@kubernetes/client-node';
import Environment from './env-manager';
import { IUpgradeMessage } from './upgrade-message';

export default class K8sManager {
    kc: k8s.KubeConfig;
    kubeAPIConfigured = false;
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
            if (kcPath) {
                this.kc.loadFromFile(kcPath);
            } else {
                throw new Error('Could not load kube config.');
            }
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
        const deployment = await this.k8sAppsV1Api.readNamespacedDeployment(this.k8sDeploymentName, this.namespace);
        return deployment?.body;
    }

    async getDeploymentsList(): Promise<k8s.V1DeploymentList> {
        const deployments = await this.k8sAppsV1Api.listNamespacedDeployment(this.namespace);
        return deployments?.body;
    }

    async getContainerInNamespace(containerName: string): 
    Promise<{
        deployment: k8s.V1Deployment,
        container: k8s.V1Container
    }> {
        const deployment: k8s.V1Deployment = await this.pullDeploymentObject();
        const container = deployment?.spec?.template?.spec?.containers.find(x => x.name === containerName);
        if (container) {
            return {deployment, container};
        }
        
        // Look for the container in the other deployments within the same namespace
        const deployments: k8s.V1DeploymentList = await this.getDeploymentsList();
        for (const deployment of deployments.items) {
            const container = deployment?.spec?.template?.spec?.containers.find(x => x.name === containerName);
            if (container) {
                return {deployment, container};
            }
        }
        throw new Error(`Container name: ${containerName} not found in deployment spec.`);
    }

    private async modifyContainerImageForDeployment(): Promise<k8s.V1Deployment[]> {
        for(const containerVersionPair of this.upgradeMessage) {
            const containerName = containerVersionPair.containerName;
            const imageTag = containerVersionPair.imageTag;

            const { deployment, container } = await this.getContainerInNamespace(containerName);
            container.image = container?.image?.replace(/\:.*/, `:${imageTag}`);
            this.upgradedDeployments.push(deployment);
        }
        return this.upgradedDeployments;
    }

    async upgradeDeploymentContainers(): Promise<k8s.V1Deployment[]> {
        const succesfullyUpgraded: k8s.V1Deployment[] = [];
        const areDeploymentsReady = await this.areAllDeploymentsInReadyState();
        if(!areDeploymentsReady.ready) {
            throw new Error(`Can't upgrade right now.
              Container with image: ${areDeploymentsReady.imageNotReady} is in state ${areDeploymentsReady.state}`);
        }

        await this.modifyContainerImageForDeployment();
        for (const deployment of this.upgradedDeployments) {
            const deploymentName = deployment.metadata?.name;
            if (deploymentName) {
                const upgradeResponse = await this.k8sAppsV1Api
                    .replaceNamespacedDeployment(deploymentName, this.namespace, deployment);
                succesfullyUpgraded.push(upgradeResponse.body);
            }
        }
        return succesfullyUpgraded;
    }

    async areAllDeploymentsInReadyState(): Promise<{ready: boolean, imageNotReady?: string, state?: string}> {
        const pods: k8s.V1PodList = (await this.k8sCoreV1Api.listNamespacedPod(this.namespace)).body;
        for(let p=0; p < pods.items.length; p++) {
            const pod = pods.items[p];
            const notReadyStatus = pod.status?.containerStatuses?.find(
                container => container.state !== k8s.V1ContainerStateRunning);
            const pendingStatus = pod.status?.phase === 'Pending';
            if(notReadyStatus?.name !== undefined || pendingStatus) {
                return {ready: false, imageNotReady: pod.metadata?.name, state: pod.status?.phase};
            }
        }

        return { ready: true, imageNotReady: undefined, state: undefined};
    }

    async getCurrentVersion(container: string): Promise<string> {
        const response = await this.getContainerInNamespace(container);
        return response.container.image ?? 'Not found';
    }
}
