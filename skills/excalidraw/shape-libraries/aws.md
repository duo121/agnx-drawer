# AWS Icons for Excalidraw

**Type:** Excalidraw library icons
**Category:** `aws`

## Usage

Use the `$icon` reference in your elements array. The backend will expand it to full Excalidraw elements.

```json
{"$icon": "aws/lambda", "x": 100, "y": 100}
{"$icon": "aws/dynamodb", "x": 300, "y": 100}
{"$icon": "aws/s3", "x": 500, "y": 100}
```

Parameters:
- `$icon`: Required. Format is `aws/{icon_name}`
- `x`, `y`: Required. Position of the icon
- `scale`: Optional. Scale factor (default 1.0)

## Icons (269)

### Compute
- `lambda` - Lambda function
- `ec2` - EC2 instance
- `ecs` - Elastic Container Service
- `eks` - Elastic Kubernetes Service
- `fargate` - Fargate
- `batch` - Batch
- `elastic_beanstalk` - Elastic Beanstalk
- `app_runner` - App Runner
- `outposts` - Outposts

### Containers
- `ecr` - Elastic Container Registry
- `container` - Container
- `task` - ECS Task
- `service` - ECS Service

### Database
- `rds` - RDS
- `aurora` - Aurora
- `dynamodb` - DynamoDB
- `elasticache` - ElastiCache
- `neptune` - Neptune
- `documentdb` - DocumentDB
- `timestream` - Timestream
- `keyspaces` - Keyspaces
- `memorydb_for_redis` - MemoryDB for Redis

### Storage
- `s3` - S3
- `ebs` - EBS
- `efs` - EFS
- `fsx` - FSx
- `glacier` - Glacier
- `backup` - Backup
- `storage_gateway` - Storage Gateway

### Networking
- `vpc` - VPC
- `cloudfront` - CloudFront
- `api_gateway` - API Gateway
- `route_53` - Route 53
- `elb` - Elastic Load Balancer
- `alb` - Application Load Balancer
- `nlb` - Network Load Balancer
- `glb` - Gateway Load Balancer
- `direct_connect` - Direct Connect
- `transit_gateway` - Transit Gateway
- `nat_gateway` - NAT Gateway
- `internet_gateway` - Internet Gateway
- `client_vpn` - Client VPN
- `global_accelerator` - Global Accelerator

### Security
- `iam` - IAM
- `cognito` - Cognito
- `secrets_manager` - Secrets Manager
- `kms` - KMS
- `waf` - WAF
- `shield` - Shield
- `guardduty` - GuardDuty
- `inspector` - Inspector
- `macie` - Macie
- `security_hub` - Security Hub
- `certificate_manager` - Certificate Manager
- `firewall_manager` - Firewall Manager

### Integration
- `sqs` - SQS
- `sns` - SNS
- `eventbridge` - EventBridge
- `step_functions` - Step Functions
- `amazon_mq` - Amazon MQ
- `appsync` - AppSync
- `appflow` - AppFlow

### Analytics
- `athena` - Athena
- `redshift` - Redshift
- `kinesis` - Kinesis
- `glue` - Glue
- `emr` - EMR
- `quicksight` - QuickSight
- `opensearch_service` - OpenSearch Service
- `data_pipeline` - Data Pipeline
- `lake_formation` - Lake Formation

### AI/ML
- `sagemaker` - SageMaker
- `bedrock` - Amazon Bedrock
- `comprehend` - Comprehend
- `rekognition` - Rekognition
- `textract` - Textract
- `polly` - Polly
- `lex` - Lex
- `transcribe` - Transcribe
- `forecast` - Forecast
- `personalize` - Personalize
- `kendra` - Kendra

### Management
- `cloudwatch` - CloudWatch
- `cloudformation` - CloudFormation
- `cloudtrail` - CloudTrail
- `config` - Config
- `system_manager` - Systems Manager
- `organizations` - Organizations
- `control_tower` - Control Tower

### Developer Tools
- `codecommit` - CodeCommit
- `codebuild` - CodeBuild
- `codedeploy` - CodeDeploy
- `codepipeline` - CodePipeline
- `cloud9` - Cloud9
- `x_ray` - X-Ray
