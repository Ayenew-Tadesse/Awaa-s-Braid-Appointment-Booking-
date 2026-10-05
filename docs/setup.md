# Going live: the customer, staff and demo websites

One codebase makes three websites. Each is its own Vercel project, built from this
same GitHub repository; its settings say which one it is.

| Website | Vercel project | Settings (Environment Variables) | Who uses it |
|---|---|---|---|
| Customer | `awaa-braids` → awaa-braids.vercel.app | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE=customer`, `NEXT_PUBLIC_STAFF_URL=https://awaa-braids-staff.vercel.app` | Customers: sign in, sign up, book |
| Staff | `awaa-braids-staff` → awaa-braids-staff.vercel.app | The same two Supabase values, `NEXT_PUBLIC_SITE=staff` | You (salon admin) and your stylists |
| Demo | `awaa-braids-demo` → awaa-braids-demo.vercel.app | **None** | Your portfolio: a fictional salon, no database |

The demo has no database at all, so nobody visiting your portfolio can reach the real
salon or its customers. Link your portfolio only to the demo.

You do these steps yourself, in your own Supabase and Vercel accounts. Nothing here needs
a secret key in the code, and nobody else needs your passwords.

## 1. The demo website (do this first)

1. In Vercel: **Add New… → Project**, import this repository again, and name the project
   `awaa-braids-demo`. Add **no** environment variables. Deploy.
2. Open awaa-braids-demo.vercel.app: it's the demo with the tour and the demo accounts.

## 2. The database (Supabase)

1. At supabase.com, create a new project (the free plan is fine). Pick the region
   **East US**. Keep the database password somewhere safe.
2. Open **SQL Editor**. Run each file in `supabase/migrations`, one at a time, in this order:
   1. `20261005000001_schema.sql`
   2. `20261005000002_security.sql`
   3. `20261006000001_usd_eastern.sql`
   4. `20261007000001_salon_tools.sql`
   5. `20261008000001_notifications.sql`
   6. `20261009000001_home_visits.sql`
   7. `20261010000001_team.sql`
   8. `20261011000001_stylist_logins.sql`
   9. `20261012000001_join_requests.sql`

   Each should finish with "Success. No rows returned".
3. Open `supabase/starter-salon.sql`. Change the line marked **EDIT ME** to your
   business phone number, then run it. It adds the salon (US dollars, US Eastern Time,
   home visits to ZIP codes 200 to 209, an hour between visits for travel), 7 styles with
   sample prices, and one stylist called "Stylist 1". It refuses to run a second time.
4. **Authentication → URL Configuration:** Site URL `https://awaa-braids.vercel.app`;
   Redirect URLs: add `https://awaa-braids.vercel.app/**` and `https://awaa-braids-staff.vercel.app/**`.
5. **Authentication → Providers → Email:** keep **Confirm email** on.

## 3. The customer website

1. In Supabase, **Project Settings → API**: copy the **Project URL** and the **anon public**
   key. Never use the `service_role` key: it bypasses every security rule.
2. In Vercel, project `awaa-braids` → **Settings → Environment Variables**, add the four
   customer settings from the table above. Then **Deployments → … → Redeploy**.
3. awaa-braids.vercel.app now shows the real salon: no demo buttons, no tour.

## 4. The staff website

1. In Vercel: **Add New… → Project**, import this repository again, name it
   `awaa-braids-staff`, and add the staff settings from the table above. Deploy.
2. It opens straight on **Staff sign in** with two doors: **Salon admin** and **I'm a stylist**.
   Search engines are asked not to list it.

## 5. Your admin account

1. On the **customer** website, tap **Create an account** and sign up with your email.
   Confirm it from the email Supabase sends.
2. In the Supabase SQL Editor, run this with your email:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```
3. Sign in on the **staff** website under **Salon admin**. (If you sign in on the customer
   website, it sends you to the staff website.)

There is no admin sign-up anywhere: only you can make an admin, here in Supabase.

## 6. Your stylists

1. Each stylist opens the staff website, taps **I'm a stylist → New to the team? Ask to join**
   and signs up with their own email. They can't see anything yet.
2. You open **Salon → Stylists and hours**. Under **Waiting to join**, choose **Add as a new
   stylist** (or link them to one without a login, such as "Stylist 1") and tap **Add to team**.
3. They now sign in under **I'm a stylist** and see only their own jobs and week.

## 7. Make it yours (in the app)

- **Salon → Stylists and hours:** each stylist's week (with breaks), time off and jobs;
  remove "Stylist 1" once your real stylists are in.
- **Salon → Styles and prices:** your real prices and times.
- **Salon → Home visits:** the ZIP codes you travel to and the travel time between visits.
- Book a test appointment as a customer, confirm it on the staff website, then cancel it.

## Good to know

- Who can sign in where: customers on the customer website only; you and your stylists on
  the staff website only. The database's rules (Row Level Security) decide what each person
  sees, whichever website they use.
- Only customers, you and the stylist doing the job see a customer's address.
- Customers pay their stylist on the day; the app takes no payments.
- Notifications are in the app only (the bell). No texts or emails are sent.
- Supabase's built-in email sends only a few emails an hour (sign-up confirmations). For
  more, connect your own email sender under **Authentication → Emails → SMTP**.
- Backups depend on your Supabase plan: check **Database → Backups**.
- When an update adds a new file to `supabase/migrations`, run only that new file.
  Don't run `starter-salon.sql` again.
