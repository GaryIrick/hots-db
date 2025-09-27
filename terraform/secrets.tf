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
