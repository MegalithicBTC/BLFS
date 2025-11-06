# Changelog

All notable changes to BLFS (Bitcoin Lightning for Shopify) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-11-06

### Fixed
- Fixed sats display rounding in Alby Chrome extension
  - Implemented rounding up to the next whole sat (multiple of 1000 msats) to avoid display bugs
  - Ensures minimum of 1 sat for all invoices
  - Maintains 100% NIP-47 compliance while improving wallet compatibility

## [0.1.1] - 2024-10-02

### Added
- Initial release of BLFS (Bitcoin Lightning for Shopify)
- Core payment processing functionality
- Nostr Wallet Connect (NWC) integration for Lightning payments
- Developer portal for managing Shopify merchants
- Merchant dashboard for viewing orders and payment status
- Shopify webhook integration (orders/create, app/uninstalled)
- Invoice generation and payment monitoring
- Multi-merchant support (one developer can service multiple stores)
- Support for multiple NWC services (Rizful, Alby Hub, LNbits, Coinos, Wallet of Satoshi, Zeus)
- Automatic exchange rate fetching (CoinGecko primary, fallback to megalithic.me)
- Payment expiration handling (default 30 minutes)
- Order summary generation with line items
- Developer fee calculation and CSV export
- SQLite database with TypeORM
- Litestream backup support for S3, GCS, Azure Blob, and local file systems
- Docker deployment support
- Caddy reverse proxy configuration
- Winston logging with daily rotation
- Environment-based configuration
- Basic authentication for developer portal

[0.1.2]: https://github.com/MegalithicBTC/BLFS/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/MegalithicBTC/BLFS/releases/tag/v0.1.1
