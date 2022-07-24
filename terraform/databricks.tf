module "db_workspace" {
  source = "./modules/databricks-workspace"

  name                        = "hots-db-workspace"
  location                    = local.location
  resource_group              = local.resource_group
  storage_account_name        = local.databricks_storage_account_name
  managed_resource_group_name = local.databricks_managed_resource_group
}

data "databricks_spark_version" "latest" {
}

data "databricks_node_type" "all_purpose_node" {
  local_disk = false
  min_cores  = 4
  category   = "General Purpose"
}

resource "azuread_application" "db_app" {
  display_name = "Databricks for HOTS-DB"
  owners       = [data.azuread_client_config.current.object_id]
}

resource "azuread_service_principal" "db_service_principal" {
  application_id = azuread_application.db_app.application_id
}

resource "azuread_service_principal_password" "db_service_principal_password" {
  service_principal_id = azuread_service_principal.db_service_principal.id
  display_name         = "Databricks service principal password"
}

resource "azurerm_resource_group" "db_resource_group" {
  name     = local.databricks_managed_resource_group
  location = local.location
}

resource "databricks_secret_scope" "storage_secrets" {
  name                     = local.databricks_storage_secret_scope
  initial_manage_principal = "users"
}

resource "databricks_secret" "service_principal_key" {
  scope        = databricks_secret_scope.storage_secrets.name
  key          = "service_principal_key"
  string_value = azuread_service_principal_password.db_service_principal_password.value
}

resource "databricks_cluster" "all_purpose_cluster" {
  cluster_name            = "All Purpose"
  idempotency_token       = "all-purpose"
  spark_version           = data.databricks_spark_version.latest.id
  node_type_id            = data.databricks_node_type.all_purpose_node.id
  autotermination_minutes = 30
  is_pinned               = true

  autoscale {
    min_workers = 1
    max_workers = 4
  }

  azure_attributes {
    availability    = "SPOT_WITH_FALLBACK_AZURE"
    first_on_demand = 1
  }
}

resource "databricks_mount" "import_storage_mount" {
  cluster_id  = databricks_cluster.all_purpose_cluster.id
  name        = "import"
  resource_id = azurerm_storage_container.spark_import.resource_manager_id
  abfs {
    client_id              = azuread_application.db_app.application_id
    client_secret_scope    = databricks_secret_scope.storage_secrets.name
    client_secret_key      = databricks_secret.service_principal_key.key
    initialize_file_system = true
  }
}

resource "databricks_mount" "stats_storage_mount" {
  cluster_id  = databricks_cluster.all_purpose_cluster.id
  name        = "stats"
  resource_id = azurerm_storage_container.stats.resource_manager_id
  abfs {
    client_id              = azuread_application.db_app.application_id
    client_secret_scope    = databricks_secret_scope.storage_secrets.name
    client_secret_key      = databricks_secret.service_principal_key.key
    initialize_file_system = true
  }
}

resource "azurerm_role_assignment" "db_storage_contributor_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.db_service_principal.object_id
}

output "node_type" {
  value = data.databricks_node_type.all_purpose_node.id
}
