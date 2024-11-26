terraform {
  required_providers {
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.39.0"

    }

    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.117.0"
    }
  }

  required_version = ">= 0.15"
}
