# Connecting a real salon (Supabase + Vercel)

Until these steps are done the website runs as a demo with a fictional salon.
You do them yourself, in your own Supabase and Vercel accounts. Nothing here puts a
secret key in the code, and nobody else needs your passwords.

## 1. Create the database (Supabase)

1. At supabase.com, create a new project (the free plan is fine). Pick the region
   **East US** so it's close to your customers. Keep the database password somewhere safe.
2. Open **SQL Editor**. Run each file in `supabase/migrations`, one at a time, in this order:
   1. `20261005000001_schema.sql`
   2. `20261005000002_security.sql`
   3. `20261006000001_usd_eastern.sql`
   4. `20261007000001_salon_tools.sql`
   5. `20261008000001_notifications.sql`

   Each should finish with "Success. No rows returned".
3. Open `supabase/starter-salon.sql`. Change the two lines marked **EDIT ME** to the
   salon's phone number and address, then run it. It adds:
   - the salon (US dollars, US Eastern Time, Washington, DC area);
   - 7 styles with sample prices and their sizes, lengths and extras;
   - one stylist called "Stylist 1", working Monday to Saturday, 9:00 AM to 7:00 PM.

   It refuses to run a second time, so it can't make a duplicate salon.

## 2. Sign-in settings (Supabase)

Under **Authentication → URL Configuration**:

- **Site URL:** `https://awaa-braids.vercel.app`
- **Redirect URLs:** add `https://awaa-braids.vercel.app/**`

Under **Authentication → Providers → Email**, keep **Confirm email** on, so every new
account has a real email address behind it.

## 3. Connect the website (Vercel)

1. In Supabase, open **Project Settings → API** and copy the **Project URL** and the
   **anon public** key. Never use the `service_role` key: it bypasses every security rule
   and must never be in a website.
2. In Vercel, open the project → **Settings → Environment Variables** and add, for Production:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
3. Go to **Deployments**, open the menu on the latest one and choose **Redeploy**.

The site now uses your salon instead of the demo. (On your own computer, the same two
values go in a file called `.env.local`.)

## 4. Make yourself the admin

1. On the website, choose **Create an account** and sign up with your email. Confirm it
   from the email Supabase sends.
2. In the Supabase SQL Editor, run this with your email:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Sign out and back in. You now see Today · Calendar · Salon · Account.

Everyone else who signs up is a customer. Only an admin can make someone else an admin.

## 5. Make it yours (in the app)

- **Salon → Stylists and hours:** rename "Stylist 1", set the real working week and
  breaks, and add the other stylists.
- **Salon → Styles and prices:** set your real prices and times, change or hide styles.
- Book a test appointment from a second account (or a friend's phone), confirm it as the
  admin, then cancel it.

## Good to know

- Customers pay at the salon; the app takes no payments.
- Notifications are in the app only (the bell). No texts or emails are sent.
- Backups depend on your Supabase plan: check **Database → Backups** to see what yours keeps.
- When a future update adds a new file to `supabase/migrations`, run only that new file.
  Don't run `starter-salon.sql` again.
