# E_NOTIMPL: See if we can add the Microsoft.Azure.Cdn permission for certificates.

resource "azurerm_key_vault" "key_vault" {
  name                = local.key_vault
  resource_group_name = local.resource_group
  location            = local.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"
}

resource "azurerm_key_vault_secret" "heroes_profile_api_key" {
  name         = "heroes-profile-api-key"
  key_vault_id = azurerm_key_vault.key_vault.id
  value        = "top_secret"
  lifecycle {
    ignore_changes = [value]
  }
}

resource "azurerm_key_vault_secret" "cosmos_readonly_key" {
  name         = "cosmos-read-only-key"
  key_vault_id = azurerm_key_vault.key_vault.id
  value        = azurerm_cosmosdb_account.cosmos_account.primary_readonly_key
}

resource "azurerm_key_vault_secret" "cosmos_readwrite_key" {
  name         = "cosmos-read-write-key"
  key_vault_id = azurerm_key_vault.key_vault.id
  value        = azurerm_cosmosdb_account.cosmos_account.primary_key
}

resource "azurerm_key_vault_secret" "aws_credentials" {
  name         = "aws-credentials"
  key_vault_id = azurerm_key_vault.key_vault.id
  value        = "top_secret"
  lifecycle {
    ignore_changes = [value]
  }
}
resource "azurerm_key_vault_secret" "functions_key" {
  name         = "functions-key"
  key_vault_id = azurerm_key_vault.key_vault.id
  value        = data.azurerm_function_app_host_keys.function_keys.default_function_key
}

resource "azurerm_key_vault_access_policy" "secret_policy_for_me" {
  key_vault_id = azurerm_key_vault.key_vault.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azuread_user.me.id

  secret_permissions = [
    "Get",
    "Set",
    "List",
    "Delete",
    "Purge"
  ]

  certificate_permissions = [
    "Get",
    "List",
    "Update",
    "Create",
    "Import",
    "Delete",
    "Purge"
  ]
}

resource "azurerm_key_vault_access_policy" "function_secret_policy" {
  key_vault_id = azurerm_key_vault.key_vault.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_function_app.hots_db_functions.identity[0].principal_id

  secret_permissions = [
    "Get"
  ]
}

resource "azurerm_key_vault_access_policy" "factory_secret_policy" {
  key_vault_id = azurerm_key_vault.key_vault.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = azurerm_data_factory.factory.identity[0].principal_id

  secret_permissions = [
    "Get",
    "List"
  ]
}
