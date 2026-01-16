---
name: gcp
description: Google Cloud Platform architecture icons and diagrams. Use this skill when creating GCP infrastructure diagrams, cloud solutions, or any diagram involving Google Cloud services like Compute Engine, Cloud Functions, Cloud Storage, BigQuery, Cloud Run, GKE, Pub/Sub, Cloud SQL, etc.
engine: drawio
---

# Google Cloud Platform Architecture

## Overview

This skill provides Google Cloud Platform official icons for creating cloud architecture diagrams using Draw.io.

## Usage

Use the mxgraph style syntax with prefix `mxgraph.gcp2`:

```xml
<mxCell value="label" style="shape=mxgraph.gcp2.{shape};fillColor=#4285F4;strokeColor=#ffffff;verticalLabelPosition=bottom;verticalAlign=top;align=center;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="60" height="60" as="geometry" />
</mxCell>
```

## Common Services

### Compute
- `compute_engine` / `gce` - Compute Engine (VMs)
- `cloud_functions` - Cloud Functions (serverless)
- `cloud_run` - Cloud Run (containers)
- `app_engine` / `gae` - App Engine (PaaS)
- `kubernetes_engine` / `gke` - Google Kubernetes Engine
- `anthos` - Anthos (hybrid/multi-cloud)

### Storage
- `cloud_storage` / `gcs` - Cloud Storage (object)
- `persistent_disk` - Persistent Disk
- `filestore` - Filestore (NFS)
- `cloud_storage_nearline` - Nearline storage
- `cloud_storage_coldline` - Coldline storage

### Database
- `cloud_sql` - Cloud SQL (MySQL/PostgreSQL)
- `cloud_spanner` - Cloud Spanner (global SQL)
- `bigtable` - Cloud Bigtable (NoSQL)
- `firestore` - Firestore (document DB)
- `memorystore` - Memorystore (Redis)
- `datastore` - Datastore

### Networking
- `virtual_private_cloud` / `vpc` - VPC
- `cloud_load_balancing` - Load Balancing
- `cloud_cdn` - Cloud CDN
- `cloud_dns` - Cloud DNS
- `cloud_armor` - Cloud Armor (WAF)
- `cloud_nat` - Cloud NAT
- `cloud_interconnect` - Cloud Interconnect
- `cloud_vpn` - Cloud VPN

### Big Data & Analytics
- `bigquery` - BigQuery (data warehouse)
- `dataflow` - Dataflow (stream/batch)
- `dataproc` - Dataproc (Spark/Hadoop)
- `pub_sub` / `pubsub` - Pub/Sub (messaging)
- `data_fusion` - Data Fusion (ETL)
- `composer` - Cloud Composer (Airflow)
- `looker` - Looker (BI)

### AI & Machine Learning
- `vertex_ai` - Vertex AI
- `ai_platform` - AI Platform
- `automl` - AutoML
- `vision_api` - Vision API
- `n_language_api` - Natural Language API
- `speech_to_text` - Speech-to-Text
- `translation_api` - Translation API
- `dialogflow` - Dialogflow

### Security & Identity
- `cloud_iam` / `iam` - Identity and Access Management
- `cloud_kms` - Key Management Service
- `secret_manager` - Secret Manager
- `security_command_center` - Security Command Center
- `identity_platform` - Identity Platform

### DevOps
- `cloud_build` - Cloud Build
- `cloud_source_repositories` - Source Repositories
- `artifact_registry` - Artifact Registry
- `container_registry` - Container Registry

### Management
- `cloud_monitoring` / `stackdriver` - Cloud Monitoring
- `cloud_logging` - Cloud Logging
- `cloud_trace` - Cloud Trace
- `cloud_profiler` - Cloud Profiler

## Group Shapes

For grouping elements:
- `google_cloud_platform` - GCP boundary
- `project` - Project
- `region` - Region
- `zone` - Zone
- `vpc` - VPC boundary
- `subnet` - Subnet

## Color Conventions

GCP uses specific colors:
- Primary: `#4285F4` (Google blue)
- Compute: `#4285F4`
- Storage: `#4285F4`
- Networking: `#4285F4`
- Big Data: `#4285F4`

## Examples

- "Draw a GCP web application with Cloud Run, Cloud SQL, and Cloud Storage"
- "Create a data pipeline with Pub/Sub, Dataflow, and BigQuery"
- "Design a machine learning workflow using Vertex AI"
- "Draw a microservices architecture on GKE with Cloud Load Balancing"
