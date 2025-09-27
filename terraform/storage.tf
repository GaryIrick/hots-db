resource "azurerm_storage_account" "hots_db_data" {
  name                       = "hotsdbdata"
  resource_group_name        = local.resource_group
  location                   = local.location
  account_tier               = "Standard"
  account_kind               = "StorageV2"
  account_replication_type   = "LRS"
  is_hns_enabled             = true
  https_traffic_only_enabled = true
}

resource "azurerm_role_assignment" "my_storage_contributor_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azuread_user.me.id
}

resource "azurerm_role_assignment" "my_storage_owner_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = data.azuread_user.me.id
}

resource "azurerm_storage_container" "config" {
  name                  = "config"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "raw" {
  name                  = "raw"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "parsed" {
  name                  = "parsed"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_management_policy" "parsed_replays_rule" {
  storage_account_id = azurerm_storage_account.hots_db_data.id
  rule {
    name = "delete-processed-replays"

    enabled = true
    filters {
      prefix_match = ["raw/processed/hp"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 60
      }
    }
  }
}

resource "azurerm_storage_container" "sql_import" {
  name                  = "sql-import"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "spark_import" {
  name                  = "spark-import"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "stats" {
  name                  = "stats"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_container" "db_backups" {
  name                  = "database-backups"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}
