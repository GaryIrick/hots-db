provider "azuread" {
  version = "~> 2.23.0"
}

provider "azurerm" {
  version = "~> 2.72.0"
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
