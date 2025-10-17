#!/bin/bash

# Create shared directory for KDS data
mkdir -p /opt/cocokds

# Set permissions (allow all users to read/write)
chmod 777 /opt/cocokds

# Set ownership
chown root:root /opt/cocokds

echo "CocoKDS shared directory created at /opt/cocokds"