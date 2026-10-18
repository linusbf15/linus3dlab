# Linus 3D Lab

A responsive storefront for Linus 3D Lab, built with plain HTML, CSS, and JavaScript.

## Run locally

Open `index.html` in a browser. The product catalog, filters, search, sorting, and local shopping bag work without a backend. The checkout preview clearly indicates when orders are not connected.

## Connect Supabase

1. Create a Supabase project and run [`[temp] SQL Supabase/setup.sql`](<./[temp] SQL Supabase/setup.sql>) in its SQL Editor. The script creates the catalog and order tables, enables row-level security, seeds the starter products, and adds the `place_order` RPC.
2. In `Scripts/products.js`, set `window.shopConfig.supabaseUrl` to your project URL and `supabaseAnonKey` to the project's **public anon key**. Never put a service-role key in browser code.
3. Serve the site over HTTP(S), then reload. The storefront loads active products from Supabase and checkout submits orders through the `place_order` database function. The function verifies customer inputs and calculates prices from the database catalog.

The SQL setup is safe to re-run: existing product records are not overwritten. Order submission records an order only; this starter does not collect online payment. Confirm shipping and payment with the customer before fulfilling an order.