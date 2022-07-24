resource "azurerm_databricks_workspace" "db_workspace" {
  name                = "hots-db-workspace"
  location            = var.location
  resource_group_name = var.resource_group
  # E_NOTIMPL: See if we can make this work?
  # managed_resource_group_name = var.managed_resource_group_name
  sku = "standard"

  custom_parameters {
    storage_account_name     = var.storage_account_name
    storage_account_sku_name = "Standard_LRS"
  }
}

output "workspace_url" {
  value = azurerm_databricks_workspace.db_workspace.workspace_url
}

output "id" {
  value = azurerm_databricks_workspace.db_workspace.id
}
