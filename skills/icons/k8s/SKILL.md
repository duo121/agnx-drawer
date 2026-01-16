---
name: k8s
description: Kubernetes architecture diagrams. Use this skill when creating K8s cluster diagrams, container orchestration architectures, or any diagram involving Kubernetes resources like Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, PersistentVolumes, etc.
engine: drawio
---

# Kubernetes Architecture

## Overview

This skill provides Kubernetes official icons for creating cluster and container orchestration diagrams using Draw.io.

## Usage

Use the mxgraph style syntax with prefix `mxgraph.kubernetes`:

```xml
<mxCell value="label" style="shape=mxgraph.kubernetes.icon;prIcon={shape};fillColor=#326CE5;strokeColor=none;verticalLabelPosition=bottom;verticalAlign=top;align=center;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="60" height="60" as="geometry" />
</mxCell>
```

## Available Shapes

### Workloads
- `pod` - Pod (smallest deployable unit)
- `deploy` - Deployment
- `rs` - ReplicaSet
- `sts` - StatefulSet
- `ds` - DaemonSet
- `job` - Job
- `cronjob` - CronJob

### Services & Networking
- `svc` - Service
- `ing` - Ingress
- `ep` - Endpoint
- `netpol` - NetworkPolicy

### Configuration
- `cm` - ConfigMap
- `secret` - Secret
- `limits` - LimitRange
- `quota` - ResourceQuota

### Storage
- `pv` - PersistentVolume
- `pvc` - PersistentVolumeClaim
- `sc` - StorageClass
- `vol` - Volume

### Cluster Components
- `node` - Node
- `master` - Master/Control Plane
- `ns` - Namespace
- `etcd` - etcd (key-value store)
- `api` - API Server
- `sched` - Scheduler
- `c_m` - Controller Manager
- `c_c_m` - Cloud Controller Manager
- `kubelet` - Kubelet
- `k_proxy` - Kube Proxy

### RBAC & Security
- `sa` - ServiceAccount
- `role` - Role
- `c_role` - ClusterRole
- `rb` - RoleBinding
- `crb` - ClusterRoleBinding
- `psp` - PodSecurityPolicy

### Custom Resources
- `crd` - CustomResourceDefinition

### Scaling
- `hpa` - HorizontalPodAutoscaler

### Grouping
- `group` - Generic group
- `frame` - Frame/boundary

## Color Convention

Kubernetes uses blue as the primary color:
- Primary: `#326CE5` (Kubernetes blue)
- Stroke: `none` or `#ffffff`

## Common Patterns

### Basic Deployment Pattern
```
Ingress -> Service -> Deployment -> Pod(s)
```

### StatefulSet Pattern
```
Service (headless) -> StatefulSet -> Pod(s) -> PVC -> PV
```

### ConfigMap/Secret Pattern
```
ConfigMap/Secret -> Pod (mounted as volume or env)
```

## Examples

- "Draw a Kubernetes deployment with Service and Ingress"
- "Create a StatefulSet architecture with PersistentVolumes"
- "Design a microservices architecture on Kubernetes"
- "Draw a K8s cluster with control plane and worker nodes"
- "Show a deployment with HPA for auto-scaling"
