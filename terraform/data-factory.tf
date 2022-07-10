resource "azurerm_data_factory" "factory" {
  name                = "hots-db-factory"
  location            = local.location
  resource_group_name = local.resource_group

  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_data_factory_linked_service_key_vault" "factory_key_value_link" {
  name            = "hots-db-factory-key-vault"
  data_factory_id = azurerm_data_factory.factory.id
  key_vault_id    = azurerm_key_vault.key_vault.id
}

resource "azurerm_data_factory_linked_service_azure_function" "factory_functions_link" {
  name            = "hots-db-factory-functions"
  data_factory_id = azurerm_data_factory.factory.id

  // This should be fixed in the 3.14.0 version of the provider, and we can stop using "data" here.
  # url = azurerm_windows_function_app.hots_db_functions.default_hostname
  url = data.azurerm_function_app.hots_db_functions_reference.default_hostname

  key_vault_key {
    linked_service_name = azurerm_data_factory_linked_service_key_vault.factory_key_value_link.name
    secret_name         = "functions-key"
  }
}
