#!/usr/bin/env zsh
set -e

# ==============================================================================
# Azure Blob Storage Provisioning Script
# Video Teaching Research Platform
# ==============================================================================

# 1. Configuration variables
export RESOURCE_GROUP="rg-vtr-dev"
export LOCATION="southeastasia"        # or "eastus", "japaneast", etc.
export STORAGE_ACCOUNT="vtrdevstorage" # Must be globally unique across Azure (3-24 lowercase letters & numbers)
export CONTAINER_NAME="videos"

# 2. Create Resource Group
echo "Creating Resource Group: ${RESOURCE_GROUP} in ${LOCATION}..."
az group create \
  --name "${RESOURCE_GROUP}" \
  --location "${LOCATION}"

# 3. Create Storage Account
echo "Creating Storage Account: ${STORAGE_ACCOUNT}..."
az storage account create \
  --name "${STORAGE_ACCOUNT}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --access-tier Hot \
  --allow-blob-public-access true

# 4. Retrieve primary access key
echo "Retrieving primary access key..."
export STORAGE_KEY=$(az storage account keys list \
  --resource-group "${RESOURCE_GROUP}" \
  --account-name "${STORAGE_ACCOUNT}" \
  --query "[0].value" \
  --output tsv)

# 5. Create Blob Container
echo "Creating Blob Container: ${CONTAINER_NAME}..."
az storage container create \
  --name "${CONTAINER_NAME}" \
  --account-name "${STORAGE_ACCOUNT}" \
  --account-key "${STORAGE_KEY}" \
  --public-access blob

# 6. Output .env configuration snippet
print -P "\n%F{green}=========================================================%f"
print -P "%F{green}✅ Azure Storage Setup Complete!%f"
print -P "%F{yellow}Copy and paste the following into your backend/.env file:%f"
print -P "%F{green}=========================================================%f"
echo "AZURE_STORAGE_ACCOUNT=${STORAGE_ACCOUNT}"
echo "AZURE_STORAGE_KEY=${STORAGE_KEY}"
echo "AZURE_CONTAINER_NAME=${CONTAINER_NAME}"
print -P "%F{green}=========================================================%f"
