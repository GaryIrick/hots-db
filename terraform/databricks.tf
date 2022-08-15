module "db_workspace" {
  source = "./modules/databricks-workspace"

  name                 = "hots-db-workspace"
  location             = local.location
  resource_group       = local.resource_group
  storage_account_name = local.databricks_storage_account_name
}

data "databricks_spark_version" "latest" {
  long_term_support = true
}

resource "azuread_application" "db_app" {
  display_name = "Databricks HOTS-DB"
  owners       = [data.azuread_client_config.current.object_id]
}

resource "azuread_service_principal" "db_service_principal" {
  application_id = azuread_application.db_app.application_id
}

resource "azuread_service_principal_password" "db_service_principal_password" {
  service_principal_id = azuread_service_principal.db_service_principal.id
  display_name         = "Databricks service principal password"
  end_date_relative    = "17520h" # 2 years
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

// Even just running "terraform plan" may cause the cluster to start up.  Sigh.

resource "databricks_cluster" "all_purpose_cluster" {
  cluster_name        = "All Purpose"
  idempotency_token   = "all-purpose"
  spark_version       = data.databricks_spark_version.latest.id
  node_type_id        = "Standard_DS3_v2"
  driver_node_type_id = "Standard_DS3_v2"
  #  node_type_id        = "Standard_D4ds_v5"
  #  driver_node_type_id = "Standard_D4ds_v5"

  autotermination_minutes = 30
  is_pinned               = true

  spark_conf = {
    "spark.databricks.cluster.profile" : "singleNode"
    "spark.master" : "local[*]"
  }

  custom_tags = {
    "ResourceClass" = "SingleNode"
  }

  # autoscale {
  #   min_workers = 1
  #   max_workers = 4
  # }

  # azure_attributes {
  #   availability    = "SPOT_WITH_FALLBACK_AZURE"
  #   first_on_demand = 1
  # }
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

# It's not worth the effort to set up Git integration here, we'll just do it in the UI.

output "node_type" {
  value = databricks_cluster.all_purpose_cluster.node_type_id
}

output "driver_node_type" {
  value = databricks_cluster.all_purpose_cluster.driver_node_type_id
}

output "spark_version" {
  value = data.databricks_spark_version.latest.id
}
