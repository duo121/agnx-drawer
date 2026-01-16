---
name: azure
description: Microsoft Azure cloud architecture icons and diagrams. Use this skill when creating Azure infrastructure diagrams, cloud solutions, or any diagram involving Azure services like Virtual Machines, Azure Functions, Blob Storage, SQL Database, App Service, AKS, Event Hub, Service Bus, etc.
engine: drawio
---

# Azure Cloud Architecture

## Overview

This skill provides Microsoft Azure official icons for creating cloud architecture diagrams using Draw.io.

## Usage

Use the mxgraph style syntax with prefix `mxgraph.azure`:

```xml
<mxCell value="label" style="shape=mxgraph.azure.{shape};fillColor=#0078D4;strokeColor=#ffffff;verticalLabelPosition=bottom;verticalAlign=top;align=center;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="60" height="60" as="geometry" />
</mxCell>
```

## Common Services

### Compute
- `virtual_machine` / `vm` - Virtual Machines
- `azure_functions` / `function_apps` - Serverless functions
- `app_services` / `web_app` - Web applications
- `container_instances` - Container instances
- `kubernetes_services` / `aks` - Azure Kubernetes Service
- `batch` - Batch processing
- `cloud_services` - Cloud services

### Storage
- `blob_storage` / `storage_blob` - Blob storage
- `file_storage` - File shares
- `queue_storage` - Queue storage
- `table_storage` - Table storage
- `data_lake` / `data_lake_storage` - Data Lake
- `managed_disks` - Managed disks

### Database
- `sql_database` / `azure_sql` - SQL Database
- `cosmos_db` - Cosmos DB (NoSQL)
- `mysql_database` - MySQL
- `postgresql_database` - PostgreSQL
- `redis_cache` - Redis Cache
- `synapse_analytics` - Synapse Analytics

### Networking
- `virtual_network` / `vnet` - Virtual Network
- `load_balancer` - Load Balancer
- `application_gateway` - Application Gateway
- `cdn` - Content Delivery Network
- `dns` / `azure_dns` - DNS
- `traffic_manager` - Traffic Manager
- `expressroute` - ExpressRoute
- `vpn_gateway` - VPN Gateway
- `firewall` - Azure Firewall
- `front_door` - Front Door

### Integration
- `service_bus` - Service Bus (messaging)
- `event_hub` / `event_hubs` - Event Hubs (streaming)
- `event_grid` - Event Grid
- `logic_apps` - Logic Apps (workflows)
- `api_management` - API Management

### Security & Identity
- `active_directory` / `azure_ad` / `entra_id` - Azure AD / Entra ID
- `key_vault` - Key Vault (secrets)
- `security_center` / `defender` - Security Center
- `sentinel` - Sentinel (SIEM)

### AI & Analytics
- `cognitive_services` - Cognitive Services
- `machine_learning` - Machine Learning
- `databricks` - Databricks
- `hdinsight` - HDInsight
- `stream_analytics` - Stream Analytics
- `openai_service` - Azure OpenAI

### DevOps
- `devops` / `azure_devops` - Azure DevOps
- `repos` - Repos
- `pipelines` - Pipelines
- `artifacts` - Artifacts

### Management
- `monitor` - Azure Monitor
- `log_analytics` - Log Analytics
- `application_insights` - Application Insights
- `automation` - Automation
- `resource_group` - Resource Group

## Group Shapes

For grouping elements:
- `azure_subscription` - Subscription boundary
- `resource_group` - Resource group
- `virtual_network` - VNet boundary
- `subnet` - Subnet
- `availability_zone` - Availability zone

## Color Conventions

Azure uses specific colors:
- Primary: `#0078D4` (Azure blue)
- Compute: `#0078D4`
- Storage: `#0078D4`
- Networking: `#0078D4`
- Security: `#E81123` (red)

## Examples

- "Draw an Azure web application with App Service, SQL Database, and Blob Storage"
- "Create a microservices architecture using AKS and Service Bus"
- "Design a data pipeline with Event Hub, Stream Analytics, and Cosmos DB"
- "Draw a hybrid cloud setup with ExpressRoute and VPN Gateway"
