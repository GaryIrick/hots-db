locals {
  location             = "centralus"
  resource_group       = "hots-db-resource-group"
  domain_names_resource_group = "domain-names"
  key_vault            = "hots-db-keys"
  storage_account_name = "hots-db-storage"
  my_ip                = "97.85.189.66"
}

data "azurerm_client_config" "current" {}

data "azuread_user" "me" {
  user_principal_name = "garyirick_gmail.com#EXT#@garyirickgmail.onmicrosoft.com"
}

