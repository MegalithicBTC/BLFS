<div align="center">
  <img src="src/public/images/blfs-square-one.webp" alt="BLFS Logo" width="300"/>
  
  # BLFS
  ### Bitcoin Lightning for Shopify
</div>

## About

BLFS (Bitcoin Lightning for Shopify) is a decentralized server application that connects Shopify merchants to Bitcoin Lightning payments via NWC (Nostr Wallet Connect). 

**Decentralization:** BLFS is designed to be run by anyone - there's no single point of control or failure. Any developer can run their own BLFS instance and connect merchants to any NWC-compatible Lightning service. 

**How it works with NWC:** BLFS uses Nostr Wallet Connect (NWC) to communicate with Lightning nodes, wallets, and vaults. Merchants provide a receive-only NWC connection string, and BLFS handles invoice generation, payment monitoring, and Shopify order fulfillment.

## License

MIT License - see below for full text.

---

## Documentation

Complete documentation is available at [Megalith Lightning Docs](https://docs.megalithic.me/BLFS/getting-started)

### Documentation Pages

1. **[Getting Started](https://docs.megalithic.me/BLFS/getting-started)** - Overview of BLFS architecture, benefits for merchants and operators, and real-world examples.

2. **[First Steps for Merchant](https://docs.megalithic.me/BLFS/first-steps-for-merchant)** - Merchant signs up for NWC service, obtains receive-only credentials, and provides Shopify store domain.

3. **[First Steps for Developer](https://docs.megalithic.me/BLFS/first-steps-for-developer)** - Developer configures domain, VPS hosting, and gathers merchant's NWC credentials and Shopify store URL.

4. **[Shopify Partner Setup for Developer](https://docs.megalithic.me/BLFS/shopify-partner-setup-for-developer)** - Developer creates Shopify Partner account and configures custom app with distribution link.

5. **[Merchant Uses Install Link](https://docs.megalithic.me/BLFS/merchant-uses-install-link)** - Merchant installs BLFS custom app to their Shopify store using the distribution link.

6. **[Developer: Add Merchant to BLFS](https://docs.megalithic.me/BLFS/developer-add-merchant-to-blfs)** - Developer starts BLFS server and adds merchant's shop configuration via the developer portal at `/dev`.

7. **[Developer: Deploy BLFS To Shop](https://docs.megalithic.me/BLFS/developer-deploy-shop)** - Developer deploys the BLFS app to merchant's Shopify store and grants necessary permissions.

8. **[Merchant: Add Buttons & Payment Method](https://docs.megalithic.me/BLFS/merchant-add-buttons-to-ui)** - Merchant adds Bitcoin Lightning payment buttons to checkout and configures manual payment method.

9. **[Developer: Try a Test Checkout](https://docs.megalithic.me/BLFS/developer-try-a-test-checkout)** - Developer performs test checkout to verify Bitcoin Lightning payment flow works correctly.

---

## Technical Quickstart

### Prerequisites

- Linux VPS (minimum 1 vCPU, 2 GB RAM)
- Docker and Docker Compose installed
- Domain name pointed to your VPS
- Shopify Partner account

### Environment Configuration

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit the `.env` file and set these 3 required variables:**

   - **`THIS_APP_DOMAIN`** - Your hostname/domain for BLFS (e.g., `pay.yourdomain.com`)
     ```bash
     THIS_APP_DOMAIN=pay.yourdomain.com
     ```

   - **`MASTER_KEY`** - A 32-byte hex string for encrypting sensitive data. Generate with:
     ```bash
     openssl rand -hex 32
     ```
     Then paste the output:
     ```bash
     MASTER_KEY=your_generated_hex_string_here
     ```

   - **`DEVELOPER_PASSWORD`** - Password for accessing the `/dev` portal
     ```bash
     DEVELOPER_PASSWORD=your_secure_password
     ```

   All other variables in `.env.example` have sensible defaults and don't need to be changed.

### Installation & Startup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MegalithicBTC/BLFS
   cd BLFS
   ```

2. **Configure environment** (see above)

3. **Start BLFS:**
   ```bash
   ./start.sh
   ```

   This will:
   - Build and start the Docker containers (app + Caddy)
   - Initialize the SQLite database
   - Issue a Let's Encrypt SSL certificate for your domain
   - Start the application on the configured port

4. **Access the Developer Portal:**
   
   Navigate to `https://YOUR_DOMAIN/dev` (e.g., `https://pay.yourdomain.com/dev`)
   
   Log in with your `DEVELOPER_BASIC_USER` and `DEVELOPER_PASSWORD` credentials.
   
   From here you can:
   - Add merchant shops
   - Configure NWC connections
   - Deploy to Shopify stores
   - Monitor transactions

### Quick Commands

```bash
# Start BLFS
./start.sh

# View logs
docker-compose logs -f app

# Stop BLFS
docker-compose down

# View database
sqlite3 ./data/app.sqlite
```

### Architecture

- **Node.js/Express** - Application server
- **TypeORM + SQLite** - Database layer
- **Caddy** - Reverse proxy with automatic HTTPS
- **Docker Compose** - Container orchestration
- **Nostr Wallet Connect** - Lightning payment protocol

---

## MIT License

```
MIT License

Copyright (c) 2025 Megalithic

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Support

For detailed setup instructions, troubleshooting, and best practices, visit the [complete documentation](https://docs.megalithic.me/BLFS/).
