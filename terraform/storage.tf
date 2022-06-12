resource "azurerm_storage_account" "hots_db_data" {
  name                      = "hotsdbdata"
  resource_group_name       = local.resource_group
  location                  = local.location
  account_tier              = "Standard"
  account_kind              = "StorageV2"
  account_replication_type  = "LRS"
  is_hns_enabled            = true
  enable_https_traffic_only = true
}

resource "azurerm_role_assignment" "my_data_contributor_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = data.azuread_user.me.id
}

resource "azurerm_role_assignment" "my_data_owner_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Owner"
  principal_id         = data.azuread_user.me.id
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

resource "azurerm_storage_container" "sql" {
  name                  = "sql"
  storage_account_name  = azurerm_storage_account.hots_db_data.name
  container_access_type = "private"
}

resource "azurerm_storage_account" "functions" {
  name                     = "hotsdbfunctions"
  location                 = local.location
  resource_group_name      = local.resource_group
  account_tier             = "Standard"
  account_kind             = "StorageV2"
  account_replication_type = "LRS"
}

resource "azurerm_role_assignment" "functions_replay_read_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_function_app.hots_db_functions.identity[0].principal_id
}

// A container named "$web" will be created automatically.
resource "azurerm_storage_account" "web" {
  name                      = "hotsdbweb"
  resource_group_name       = local.resource_group
  location                  = local.location
  account_tier              = "Standard"
  account_kind              = "StorageV2"
  account_replication_type  = "LRS"
  enable_https_traffic_only = true

  static_website {
    index_document     = "index.html"
    error_404_document = "404.html"
  }
}

resource "azurerm_storage_blob" "test_file" {
  name                   = "index.html"
  storage_account_name   = azurerm_storage_account.web.name
  storage_container_name = "$web"
  type                   = "Block"
  source                 = "index.html"
}
