<div align="center">
  <img src="src/public/images/blfs-square-one.webp" alt="BLFS Logo" width="300"/>

  # BLFS
  ### Bitcoin Lightning For Shopify
</div>

## About

BLFS (Bitcoin Lightning for Shopify) is a lightweight server application. It connects Shopify merchants to Bitcoin Lightning payments via NWC (Nostr Wallet Connect). 

**Decentralization:** BLFS is designed to be run by anyone. Any developer may run their own BLFS instance and connect merchants to any of many NWC-compatible Lightning services. 

### How BLFS Works: Two Key Roles

#### Role #1: Shopify Merchant 🛍️
The store owner who wants to accept Bitcoin Lightning payments.

#### Role #2: BLFS Developer 👨‍💻
A developer who sets up and operates BLFS to integrate Lightning payments with Shopify store(s).

### Basic Setup: One Developer, One Merchant

```mermaid
graph LR
  A["🛍️ Shopify Merchant"] <--> B["👨‍💻 BLFS Developer"]
```

### Scalable Setup: One Developer, Multiple Merchants

A single BLFS developer can service multiple Shopify merchants, managing Lightning payment infrastructure for all of them.

```mermaid
graph TD
  A["👨‍💻 BLFS Developer"] <--> B["🛍️ Merchant 1"]
  A <--> C["🛍️ Merchant 2"]
  A <--> D["🛍️ Merchant 3"]
  A <--> E["🛍️ Merchant 4"]
```

### Decentralized Network: Multiple Developers, Multiple Merchants

The true power of BLFS emerges when many independent developers run their own instances, creating a resilient, decentralized network with no single point of failure.

```mermaid
graph TD
  D1["👨‍💻 Developer 1"] <--> M1["🛍️ Merchant 1"]
  D1 <--> M2["🛍️ Merchant 2"]
  
  D2["👨‍💻 Developer 2"] <--> M3["🛍️ Merchant 3"]
  D2 <--> M4["🛍️ Merchant 4"]
  D2 <--> M5["🛍️ Merchant 5"]
  
  D3["👨‍💻 Developer 3"] <--> M6["🛍️ Merchant 6"]
  
  D4["👨‍💻 Developer 4"] <--> M7["🛍️ Merchant 7"]
  D4 <--> M8["🛍️ Merchant 8"]
  D4 <--> M9["🛍️ Merchant 9"]
  
  style D1 fill:#f9a825
  style D2 fill:#f9a825
  style D3 fill:#f9a825
  style D4 fill:#f9a825
```

### Complete Ecosystem: Maximum Decentralization

Each merchant can choose any NWC service, and each developer can support multiple NWC providers. This creates a truly permissionless, censorship-resistant payment infrastructure.

```mermaid
graph TB
  subgraph NWC["⚡ NWC Services"]
    N1["Rizful"]
    N2["Alby Hub"]
    N3["LNbits"]
    N4["Custom Node"]
  end
  
  subgraph Devs["👨‍💻 BLFS Developers"]
    D1["Developer 1"]
    D2["Developer 2"]
    D3["Developer 3"]
  end
  
  subgraph Merchants["🛍️ Shopify Merchants"]
    M1["Store 1"]
    M2["Store 2"]
    M3["Store 3"]
    M4["Store 4"]
    M5["Store 5"]
    M6["Store 6"]
  end
  
  M1 --> D1
  M2 --> D1
  M3 --> D2
  M4 --> D2
  M5 --> D3
  M6 --> D3
  
  D1 -.NWC.-> N1
  D1 -.NWC.-> N2
  D2 -.NWC.-> N2
  D2 -.NWC.-> N3
  D3 -.NWC.-> N1
  D3 -.NWC.-> N4
  
  style N1 fill:#9c27b0
  style N2 fill:#9c27b0
  style N3 fill:#9c27b0
  style N4 fill:#9c27b0
  style D1 fill:#f9a825
  style D2 fill:#f9a825
  style D3 fill:#f9a825
```

**Key Benefits:**
- 🔀 **No vendor lock-in** - Merchants can switch NWC providers anytime
- 🛡️ **Censorship resistant** - No single point of control or failure
- 🌐 **Geographic diversity** - Developers and services can be anywhere
- 💪 **Resilient** - If one service or developer goes down, others continue operating

**How it works with NWC:** BLFS uses Nostr Wallet Connect (NWC) to communicate with Lightning nodes, wallets, and vaults. Merchants provide a receive-only NWC connection string, and BLFS runs a lightweight web server that handles invoice generation, payment monitoring, and marking orders as "paid" in Shopify's database. 

**Incentives:** Developers (subject to agreement with Shopify merchants) may earn fees on each Shopify sale through BLFS. One developer can service multiple merchants. This is an excellent tool for an independent operator who wants to onboard a number of Shopify merchants.

---

## Live Example: Sonia Boyajian

See BLFS in action at [soniabstyle.com](https://soniabstyle.com/) - a Los Angeles jewelry and ceramics boutique accepting Bitcoin Lightning payments.

<div align="center">
  
### Select "Pay with Bitcoin Lightning" at checkout
<img src="src/public/images/sonia-boyajian-pay-with-bitcoin-lightning-and-complete-order.webp" alt="Select Pay with Bitcoin Lightning at checkout" width="600"/>

### Click the 'Complete Payment' button
<img src="src/public/images/sonia-boyajian-complete-payment.webp" alt="Click the Complete Payment button" width="600"/>

### Pay the Lightning invoice
<img src="src/public/images/sonia-boyajian-final-invoice.webp" alt="Pay a Lightning invoice" width="600"/>

### Order complete!
<img src="src/public/images/sonia-boyajian-order-complete.webp" alt="All done!" width="600"/>

</div>

---

## Acknowledgments 

This implementation is inspired by the BTCPay Server Shopify plugin created by [TChukwuleta](https://github.com/TChukwuleta), [ndeet](https://github.com/ndeet), and [NicolasDorier](https://github.com/NicolasDorier).

Our goal was to build something similar, but that did not require a running `bitcoind`, `btcpayserver`, `nbitcoin`, and that required Lightning payments by default, so as to give consumers and merchants a "payment completed in 2 seconds" guarantee. (As long as a high-performance NWC service is used!)



---

## Documentation

Complete documentation is available at [BLFS @ Megalith Lightning Docs](https://docs.megalithic.me/BLFS/getting-started).

1. **[Getting Started](https://docs.megalithic.me/BLFS/getting-started)** - Overview of BLFS architecture, benefits for merchants and operators, and real-world examples.

2. **[First Steps for Merchant](https://docs.megalithic.me/BLFS/first_steps_for_merchant)** `[Merchant]` - Merchant signs up for NWC service, obtains receive-only credentials, and provides Shopify store domain.

3. **[First Steps for Developer](https://docs.megalithic.me/BLFS/first_steps_for_developer)** `[Developer]` - Developer configures domain, VPS hosting, and gathers merchant's NWC credentials and Shopify store URL.

4. **[Shopify Partner Setup](https://docs.megalithic.me/BLFS/shopify-partner-setup-for-developer)** `[Developer]` - Developer creates Shopify Partner account (FREE) and configures custom app with distribution link.

5. **[Click Install Link](https://docs.megalithic.me/BLFS/merchant_uses_install_link)** `[Merchant]` - Merchant installs BLFS custom app to their Shopify store using the distribution link.

6. **[Add Merchant to BLFS](https://docs.megalithic.me/BLFS/developer-add-merchant-to-blfs)** `[Developer]` - Developer starts BLFS server and adds merchant's shop configuration via the developer portal at `/dev`.

7. **[Deploy BLFS To Shop](https://docs.megalithic.me/BLFS/developer-deploy-shop)** `[Developer]` - Developer deploys the BLFS app to merchant's Shopify store and grants necessary permissions.

8. **[Add Buttons & Payment Method](https://docs.megalithic.me/BLFS/merchant_add_buttons_to_ui)** `[Merchant]` - Merchant adds Bitcoin Lightning payment buttons to checkout and configures manual payment method.

9. **[Try a Test Checkout](https://docs.megalithic.me/BLFS/developer_try_a_test_checkout)** `[Developer]` - Developer performs test checkout to verify Bitcoin Lightning payment flow works correctly.
---

## Technical Quickstart

### Prerequisites

- Linux VPS (minimum 1 vCPU, 2 GB RAM)
- Docker and Docker Compose installed
- Domain name pointed to your VPS
- Shopify Partner account (FREE)

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

```

### Architecture

- **Node.js/Express** - Application server
- **TypeORM + SQLite** - Database layer
- **Caddy** - Reverse proxy with automatic HTTPS
- **Docker Compose** - Container orchestration
- **Nostr Wallet Connect** - Lightning payment protocol

### Optional: Litestream Database Replication

BLFS includes optional [Litestream](https://litestream.io/) support for continuous SQLite replication to cloud storage (S3, Google Cloud Storage, Azure Blob Storage, or local filesystem). This provides disaster recovery and enables zero-downtime migrations.

To enable Litestream backups, configure the following in your `.env` file:

```bash
LITESTREAM_REPLICA_URL=s3://your-bucket/replication/app.sqlite
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
```

See the [Litestream documentation](https://litestream.io/guides/s3/) for detailed configuration options.

---

## MIT License

```
MIT License

Copyright (c) 2025 Megalithic.me

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

For detailed setup instructions, troubleshooting, and best practices, visit the [complete documentation](https://docs.megalithic.me/category/blfs-bitcoin-lightning-for-shopify).
