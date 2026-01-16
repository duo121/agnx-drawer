---
name: aws
description: AWS cloud architecture icons and diagrams. Use this skill when creating AWS infrastructure diagrams, serverless architectures, or any diagram involving AWS services like EC2, Lambda, S3, RDS, DynamoDB, VPC, API Gateway, CloudFront, ECS, EKS, SQS, SNS, etc.
engine: drawio
---

# AWS Cloud Architecture

## Overview

This skill provides AWS official icons (1000+ shapes) for creating cloud architecture diagrams using Draw.io.

## Usage

Use the mxgraph style syntax with prefix `mxgraph.aws4`:

```xml
<mxCell value="label" style="shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.{shape};fillColor=#ED7100;strokeColor=#ffffff;verticalLabelPosition=bottom;verticalAlign=top;align=center;" vertex="1" parent="1">
  <mxGeometry x="0" y="0" width="60" height="60" as="geometry" />
</mxCell>
```

For simple shapes use: `shape=mxgraph.aws4.{shape};fillColor=#232F3D;`

## Common Services

### Compute
- `ec2` - EC2 instances
- `lambda` / `lambda_function` - Lambda functions
- `ecs` / `ecs_service` / `ecs_task` - ECS containers
- `eks` / `eks_cloud` - Kubernetes service
- `fargate` - Serverless containers
- `elastic_beanstalk` - PaaS

### Storage
- `s3` / `bucket` - S3 storage
- `elastic_block_store` - EBS volumes
- `elastic_file_system` - EFS
- `glacier` / `glacier_deep_archive` - Archive storage
- `fsx` / `fsx_for_lustre` - FSx

### Database
- `rds` / `aurora` - Relational databases
- `dynamodb` - NoSQL database
- `elasticache` / `elasticache_for_redis` - Caching
- `neptune` - Graph database
- `redshift` - Data warehouse
- `documentdb_with_mongodb_compatibility` - Document DB

### Networking
- `vpc` / `virtual_private_cloud` - VPC
- `cloudfront` - CDN
- `route_53` - DNS
- `api_gateway` - API management
- `elastic_load_balancing` / `application_load_balancer` / `network_load_balancer` - Load balancers
- `direct_connect` - Dedicated connection
- `transit_gateway` - Network hub
- `nat_gateway` - NAT
- `internet_gateway` - Internet access

### Integration
- `sqs` / `queue` - Message queue
- `sns` / `topic` - Pub/sub messaging
- `eventbridge` - Event bus
- `step_functions` - Workflow orchestration
- `mq` - Message broker

### Security
- `identity_and_access_management` - IAM
- `cognito` - User authentication
- `secrets_manager` - Secrets management
- `key_management_service` - KMS
- `waf` - Web application firewall
- `shield` - DDoS protection
- `guardduty` - Threat detection

### Analytics
- `athena` - SQL queries on S3
- `kinesis` / `kinesis_data_streams` / `kinesis_data_firehose` - Streaming
- `glue` - ETL
- `emr` - Big data processing
- `quicksight` - BI dashboards

### AI/ML
- `sagemaker` - ML platform
- `bedrock` - Foundation models
- `rekognition` - Image/video analysis
- `comprehend` - NLP
- `lex` - Chatbots
- `polly` - Text-to-speech
- `transcribe` - Speech-to-text
- `translate` - Translation

### Developer Tools
- `codecommit` - Git repos
- `codebuild` - Build service
- `codedeploy` - Deployment
- `codepipeline` - CI/CD
- `cloud9` - Cloud IDE

### Management
- `cloudwatch` / `cloudwatch_logs` - Monitoring
- `cloudformation` - IaC
- `cloudtrail` - Audit logs
- `config` - Configuration tracking
- `systems_manager` - Operations

## Group Shapes

For grouping elements, use these container shapes:
- `group_aws_cloud` - AWS Cloud boundary
- `group_region` - Region
- `group_availability_zone` - AZ
- `group_vpc` - VPC
- `group_subnet` - Subnet
- `group_security_group` - Security group
- `group_auto_scaling_group` - Auto Scaling group

## Color Conventions

AWS uses specific colors for service categories:
- Compute: `#ED7100` (orange)
- Storage: `#3F8624` (green)
- Database: `#3B48CC` (blue)
- Networking: `#8C4FFF` (purple)
- Security: `#DD344C` (red)
- Analytics: `#8C4FFF` (purple)
- General: `#232F3D` (dark gray)

## Examples

- "Draw a serverless web application with API Gateway, Lambda, and DynamoDB"
- "Create a three-tier architecture with ALB, EC2, and RDS"
- "Design a microservices architecture using ECS and API Gateway"
- "Draw a data pipeline with Kinesis, Lambda, and S3"
