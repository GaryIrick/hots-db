terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate"
    storage_account_name = "tfstatehotsdb"
    container_name       = "tfstate"
    key                  = "hots-db.terraform.tfstate"
  }
}

provider "azuread" {
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = false
    }
  }
}

provider "databricks" {
  azure_workspace_resource_id = module.db_workspace.id
}


data "azurerm_client_config" "current" {}

// E_NOTIMPL: Are these the same thing, since I am running the terraform?
data "azuread_client_config" "current" {}

data "azuread_user" "me" {
  user_principal_name = "garyirick_gmail.com#EXT#@garyirickgmail.onmicrosoft.com"
}
