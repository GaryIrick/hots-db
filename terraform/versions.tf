terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.26.1"

    }

    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.14.0"
    }
  }

  required_version = ">= 0.15"
}
