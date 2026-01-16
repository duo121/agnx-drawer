---
name: network
description: Network topology and infrastructure diagrams. Use this skill when creating network diagrams, topology maps, data center layouts, or any diagram involving routers, switches, firewalls, load balancers, servers, VLANs, subnets, and network connections.
engine: drawio
---

# Network Topology Diagrams

## Overview

This skill provides network infrastructure icons for creating topology diagrams, data center layouts, and network architecture using Draw.io.

## Usage

Use the mxgraph style syntax with various network prefixes:

```xml
<!-- Cisco style -->
<mxCell style="shape=mxgraph.cisco19.{shape};fillColor=#005073;strokeColor=#ffffff;" />

<!-- Generic network -->
<mxCell style="shape=mxgraph.networks.{shape};fillColor=#036897;strokeColor=#ffffff;" />
```

## Common Network Devices

### Core Infrastructure
- `router` - Router
- `switch` / `switch_l2` / `switch_l3` - Network switches
- `firewall` - Firewall
- `load_balancer` - Load balancer
- `gateway` - Gateway
- `proxy` - Proxy server

### Servers & Compute
- `server` / `rack_server` - Server
- `server_cluster` - Server cluster
- `database_server` - Database server
- `web_server` - Web server
- `application_server` - Application server
- `file_server` - File server
- `mail_server` - Mail server
- `dns_server` - DNS server

### Storage
- `storage` / `san` - Storage area network
- `nas` - Network attached storage
- `tape_library` - Tape library
- `disk_array` - Disk array

### Security
- `ids_ips` - IDS/IPS
- `vpn_concentrator` - VPN concentrator
- `waf` - Web application firewall
- `ssl_offloader` - SSL offloader

### Wireless
- `wireless_router` - Wireless router
- `access_point` / `wap` - Wireless access point
- `wireless_controller` - Wireless controller

### WAN & Connectivity
- `wan` - WAN link
- `internet` / `cloud` - Internet/Cloud
- `mpls` - MPLS network
- `vpn` - VPN tunnel
- `leased_line` - Leased line

### End Devices
- `workstation` / `pc` - Workstation/PC
- `laptop` - Laptop
- `printer` - Printer
- `ip_phone` - IP phone
- `mobile_device` - Mobile device

## Network Zones

For grouping and segmentation:
- `dmz` - DMZ zone
- `lan` - LAN segment
- `wan` - WAN segment
- `vlan` - VLAN
- `subnet` - Subnet
- `security_zone` - Security zone

## Connection Types

### Line Styles
- Solid line: Physical connection
- Dashed line: Logical/virtual connection
- Dotted line: Wireless connection

### Arrow Types
- Single arrow: Unidirectional flow
- Double arrow: Bidirectional flow
- No arrow: Physical link

## Common Patterns

### Three-Tier Architecture
```
Internet → Firewall → DMZ (Web Servers) → Internal Firewall → App Servers → Database Servers
```

### Hub and Spoke
```
Central Router/Switch connected to multiple branch locations
```

### Redundant Design
```
Dual firewalls, dual switches, dual links for high availability
```

## Color Conventions

- Routers: Blue (`#036897`)
- Switches: Green (`#00AA00`)
- Firewalls: Red (`#CC0000`)
- Servers: Gray (`#666666`)
- Cloud/Internet: Light blue (`#87CEEB`)

## Examples

- "Draw a corporate network with DMZ, internal network, and internet connectivity"
- "Create a data center topology with redundant switches and firewalls"
- "Design a branch office network connecting to headquarters via VPN"
- "Draw a three-tier web application network architecture"
