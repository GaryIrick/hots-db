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

terraform {
  backend "azurerm" {
    resource_group_name  = "tfstate"
    storage_account_name = "tfstatehotsdb"
    container_name       = "tfstate"
    key                  = "hots-db.terraform.tfstate"
  }
}
