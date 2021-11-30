import * as k8s from '@kubernetes/client-node';
import { V1PodStatus } from '@kubernetes/client-node';
// please remove unused variables (this should be covered by eslint)
import Environment from './env-manager';
import { IUpgradeMessage } from './upgrade-message';
// please add one or two empty lines between import statements and class declarations
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
        // this is a very long line, takes a long time to get to the ?.body bit.
        // please consider refactoring this to:
        // const deployment = await this.k8sAppsV1Api.readNamespacedDeployment(this.k8sDeploymentName, this.namespace);
        // return deployment?.body;
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
            // this block terminates execution.
            // this next else block is not required
        } else {
            // Look for the container in the other deployments within the same namespace
            // please extract this to a `listNamespacedDeployment` method . Also, in the other fetch function
            // you were also null-checking the result before accessing .body.
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
        // please use const over let
        for(let containerVersionPair of this.upgradeMessage) {
            const containerName = containerVersionPair.containerName;
            const imageTag = containerVersionPair.imageTag;

            // please use const over let
            // you can also do const { deployment, container } = await this.getContainerInNamespace(containerName);
            let searchResult = await this.getContainerInNamespace(containerName);
            const deployment = searchResult.deployment;
            const container = searchResult.container;
            // Is it possible that the payload contains the exact image tag, and we don't need this .replace call
            // and instead we simply overwrite?
            container.image = container?.image?.replace(/\:.*/, `:${imageTag}`);
            this.upgradedDeployments.push(deployment);
        }
        return this.upgradedDeployments;
    }

    async upgradeDeploymentContainers(): Promise<k8s.V1Deployment[]> {
        // please use const over let
        let succesfullyUpgraded: k8s.V1Deployment[] = [];
        const areDeploymentsReady = await this.areAllDeploymentsInReadyState();
        // please always use strict equality.
        // also, can this be rewritten as if (!areDeploymentsReady.ready) ?
        if(areDeploymentsReady.ready == false) {
            throw new Error(`Can't upgrade right now. Container with image: ${areDeploymentsReady.imageNotReady} is in state ${areDeploymentsReady.state}`);
        }

        await this.modifyContainerImageForDeployment();
        for (const deployment of this.upgradedDeployments) {
            // can we make this a const?
            // const deploymentName = deployment.metadata?.name;
            let deploymentName: string = "";
            deploymentName = deployment.metadata?.name ?? "";
            // please always use strict equality. this can also be simplified like `if (deploymentName) {`
            if (deploymentName != "") {
                const upgradeResponse = await this.k8sAppsV1Api.replaceNamespacedDeployment(deploymentName, this.namespace, deployment);
                succesfullyUpgraded.push(upgradeResponse.body);
            }
        }
        return succesfullyUpgraded;
    }

    async areAllDeploymentsInReadyState(): Promise<{ready: boolean, imageNotReady?: string, state?: string}> {
        const pods: k8s.V1PodList = (await this.k8sCoreV1Api.listNamespacedPod(this.namespace)).body;
        // I think getting the list of all not-ready containers should be useful
        // Is it possible to change this to a forEach or a  map or filter, and return pairs of { containerName, state }
        // for containers which are not ready?
        // also `for` statements are not very easy to read, and for arrays we have better options for loops.
        for(let p=0; p < pods.items.length; p++) {
            const pod = pods.items[p];
            // please always use strict equals
            const notReadyStatus = pod.status?.containerStatuses?.find(container => container.state != k8s.V1ContainerStateRunning);
            const pendingStatus = pod.status?.phase === 'Pending';
            if(notReadyStatus?.name != undefined || pendingStatus) {
                // is it a pod or an image or a container? :D
                // if we design it so the pod only has one container, maybe we should return the container name? (so we match input and output?)
                return {ready: false, imageNotReady: pod.metadata?.name, state: pod.status?.phase};
            }
        }

        // do we have to return imageNotReady and state in this case?
        return { ready: true, imageNotReady: undefined, state: undefined};
    }

    async getCurrentVersion(container: string): Promise<string> {
        const response = await this.getContainerInNamespace(container);
        return response.container.image ?? 'Not found';
    }
}
