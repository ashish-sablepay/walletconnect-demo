#!/bin/bash
# ===========================================
# Next.js Lambda Bootstrap Script
# ===========================================
# This script is used to run Next.js standalone output in AWS Lambda.
# It's designed to work with the AWS Lambda Web Adapter.

set -e

# Change to the directory containing the server
cd /var/task

# Set environment variables
export NODE_ENV=production
export PORT=${PORT:-3000}

# Start the Next.js server
exec node server.js
