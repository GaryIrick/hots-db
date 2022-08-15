resource "azurerm_data_factory" "factory" {
  name                = "hots-db-factory"
  location            = local.location
  resource_group_name = local.resource_group

  identity {
    type = "SystemAssigned"
  }

  # We will complete the Git integration in the Data Factory UI, can't do it here.

  github_configuration {
    git_url         = "https://github.com"
    account_name    = local.github_account
    repository_name = local.data_factory_repo
    branch_name     = "main"
    root_folder     = "/"
  }
}

resource "azuread_application" "datafactory_app" {
  display_name = "DataFactory HOTS-DB"
  owners       = [data.azuread_client_config.current.object_id]
}

resource "azuread_service_principal" "datafactory_service_principal" {
  application_id = azuread_application.datafactory_app.application_id
}

resource "azuread_service_principal_password" "datafactory_service_principal_password" {
  service_principal_id = azuread_service_principal.datafactory_service_principal.id
  display_name         = "DataFactory service principal password"
  end_date_relative    = "17520h" # 2 years
}

resource "azurerm_key_vault_secret" "datafactory_service_principal_key" {
  name         = "datafactory-service-principal-key"
  key_vault_id = azurerm_key_vault.key_vault.id
  value        = azuread_service_principal_password.datafactory_service_principal_password.value
}
resource "azurerm_role_assignment" "datafactory_storage_contributor_access" {
  scope                = azurerm_storage_account.hots_db_data.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azuread_service_principal.datafactory_service_principal.object_id
}

resource "azurerm_role_assignment" "datafactory_databricks_contributor_access" {
  scope                = module.db_workspace.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_data_factory.factory.identity[0].principal_id
}
