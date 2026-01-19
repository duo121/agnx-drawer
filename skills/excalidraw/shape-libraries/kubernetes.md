# Kubernetes Icons for Excalidraw

**Type:** Excalidraw library icons
**Category:** `kubernetes`

## Usage

Use the `$icon` reference in your elements array. The backend will expand it to full Excalidraw elements.

```json
{"$icon": "kubernetes/pod", "x": 100, "y": 100}
{"$icon": "kubernetes/deploy", "x": 300, "y": 100}
{"$icon": "kubernetes/svc", "x": 500, "y": 100}
```

Parameters:
- `$icon`: Required. Format is `kubernetes/{icon_name}`
- `x`, `y`: Required. Position of the icon
- `scale`: Optional. Scale factor (default 1.0)

## Icons (74)

### Workloads
- `pod` - Pod
- `deploy` - Deployment
- `rs` - ReplicaSet
- `ds` - DaemonSet
- `sts` - StatefulSet
- `cronjob` - CronJob
- `cron` - Cron

### Services & Networking
- `svc` - Service
- `ing` - Ingress
- `ep` - Endpoints
- `netpol` - NetworkPolicy

### Config & Storage
- `cm` - ConfigMap
- `secret` - Secret
- `pv` - PersistentVolume
- `pvc` - PersistentVolumeClaim
- `sc` - StorageClass

### Cluster
- `node` - Node
- `ns` - Namespace
- `master` - Master
- `etcd` - etcd
- `kubernetes` - Kubernetes logo

### RBAC
- `sa` - ServiceAccount
- `role` - Role
- `c_role` - ClusterRole
- `rb` - RoleBinding
- `crb` - ClusterRoleBinding

### Policy
- `limits` - LimitRange
- `quota` - ResourceQuota
- `psp` - PodSecurityPolicy
- `pdb` - PodDisruptionBudget

### Extensions
- `crd` - CustomResourceDefinition
- `hpa` - HorizontalPodAutoscaler

### Users
- `user` - User
- `group` - Group

Note: Icons with `_text` suffix include labels (e.g., `pod_text`, `deploy_text`)
