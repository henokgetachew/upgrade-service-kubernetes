import * as k8s from '@kubernetes/client-node';
import { IDeploymentReadiness, IPodNotReady } from './deployment-readiness';
import Environment from './env-manager';
import { IUpgradedContainers, IUpgradeMessage } from './upgrade-message';

export default class K8sManager {
  kc: k8s.KubeConfig;
  kubeAPIConfigured = false;
  k8sCoreV1Api: k8s.CoreV1Api = new k8s.CoreV1Api();
  k8sAppsV1Api: k8s.AppsV1Api = new k8s.AppsV1Api();
  namespace: string;
  k8sDeploymentName: string;
  upgradeMessage: IUpgradeMessage[];
  upgradedContainers: IUpgradedContainers = {};

  constructor(namespace: string, k8sDeploymentName: string, upgradeMessage: IUpgradeMessage[] ) {
    this.kc = new k8s.KubeConfig();
    this.namespace = namespace;
    this.k8sDeploymentName = k8sDeploymentName;
    this.upgradeMessage = upgradeMessage;

    this.setupLinkWithK8Server();
    const invalidUpgradeMessages = this.filterInvalidUpgradePairs();
    if(invalidUpgradeMessages.length) {
      const errMessage = `Upgrade message invalid. container_name and image_tag need to be specified. 
            Payload needs to be an object in the following format: { containers: [{container_name: <>, image_tag: <>}] }
            Not Valid: ${invalidUpgradeMessages.toString()}`;

      console.error(errMessage);
      throw new Error(errMessage);
    }
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

  private filterInvalidUpgradePairs(): Array<IUpgradeMessage> {
    return this.upgradeMessage.filter(
      containerVersionPair => !containerVersionPair.container_name || !containerVersionPair.image_tag
    );
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
    } | undefined> {
    const deployment: k8s.V1Deployment = await this.pullDeploymentObject();
    const container = this.getContainerObject(deployment, containerName);
    if (container) {
      return {deployment, container};
    }

    // Look for the container in the other deployments within the same namespace
    const deployments: k8s.V1DeploymentList = await this.getDeploymentsList();
    for (const deployment of deployments.items) {
      const container = this.getContainerObject(deployment, containerName);
      if (container) {
        return {deployment, container};
      }
    }
    console.log(`Container name: ${containerName} not found in deployment spec.`);
  }

  private getContainerObject(deployment: k8s.V1Deployment, containerName: string) {
    return deployment?.spec?.template?.spec?.containers.find(container => container.name === containerName);
  }

  private async modifyContainerImageForDeployment() {
    for (const containerVersionPair of this.upgradeMessage) {
      const containerName = containerVersionPair.container_name;
      const imageTag = containerVersionPair.image_tag;

      this.upgradedContainers[containerName] = { ok: false };
      const result = await this.getContainerInNamespace(containerName);
      if (result?.deployment && result.container) {
        result.container.image = imageTag;
        this.upgradedContainers[containerName].deployment = result.deployment;
      }
    }
  }

  async upgradeDeploymentContainers(): Promise<IUpgradedContainers> {
    const areDeploymentsReady = await this.areAllDeploymentsInReadyState();
    if(!areDeploymentsReady.ready) {
      throw new Error(`Can't upgrade right now.
              The following pods are not ready.: ${JSON.stringify(areDeploymentsReady.podsNotReady)}`);
    }

    await this.modifyContainerImageForDeployment();
    for (const upgradedContainer of Object.values(this.upgradedContainers)) {
      const deploymentName = upgradedContainer.deployment?.metadata?.name;
      if (upgradedContainer.deployment && deploymentName) {
        await this.k8sAppsV1Api.replaceNamespacedDeployment(
          deploymentName,
          this.namespace,
          upgradedContainer.deployment
        );
        upgradedContainer.ok = true;
      }
    }
    return this.upgradedContainers;
  }

  async areAllDeploymentsInReadyState(): Promise<IDeploymentReadiness> {
    let deploymentReadiness: IDeploymentReadiness;
    const v1PodList = await this.k8sCoreV1Api.listNamespacedPod(this.namespace);
    const pods: k8s.V1PodList = v1PodList.body;
    const podsNotReady: IPodNotReady[] = [];

    pods.items.forEach((pod => {
      const notReadyContainers = pod.status?.containerStatuses?.filter(
        container => container.state?.running === undefined);
      const pendingStatus = pod.status?.phase === 'Pending';
      if(notReadyContainers?.length || pendingStatus) {
        const podNotReady: IPodNotReady = {
          podName: pod.metadata?.name,
          state: pod.status?.phase,
          containersNotReady: notReadyContainers
        };
        podsNotReady.push(podNotReady);
      }
    }));

    if(podsNotReady.length) {
      deploymentReadiness = {ready: false, podsNotReady: podsNotReady};
      return deploymentReadiness;
    }

    deploymentReadiness = { ready: true};
    return deploymentReadiness;
  }

  async getCurrentVersion(container: string): Promise<string> {
    const response = await this.getContainerInNamespace(container);
    return response?.container.image ?? 'Not found';
  }
}
