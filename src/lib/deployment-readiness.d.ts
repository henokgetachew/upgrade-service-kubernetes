export interface IPodNotReady {
  podName?: string;
  state?: string;
  containersNotReady?: V1ContainerStatus[];
}

export interface IDeploymentReadiness {
  ready: boolean;
  podsNotReady?: IPodNotReady[];
}
